# leads_task_list 表字段匹配和写入方式梳理

## 表结构字段列表

根据 `02_call_tasks.sql` 定义，`leads_task_list` 表包含以下字段：
- `id` (主键，自增)
- `task_id` (任务ID)
- `leads_id` (线索ID)
- `leads_name` (线索名称)
- `leads_phone` (线索手机号)
- `call_time` (任务创建时间)
- `call_job_id` (电话任务ID)
- `reference_id` (参考ID，用于匹配)
- `call_conversation` (通话记录详情，JSON格式)
- `call_status` (呼叫状态)
- `planed_time` (任务执行时间)
- `call_task_id` (通话ID，用于获取录音)
- `calling_number` (主叫号码)
- `recording_url` (录音文件URL)
- `leads_follow_id` (线索跟进ID)
- `is_interested` (是否有意向：0=无法判断，1=有意向，2=无意向)

---

## 字段写入和匹配方式详解

### 1. **初始创建阶段** (`create_auto_call_task_service`)

**位置**: `auto_call_service.py:66-86`

**写入字段**:
```python
INSERT INTO leads_task_list 
(task_id, leads_id, leads_name, leads_phone, call_time, call_job_id, reference_id)
VALUES (%s, %s, %s, %s, %s, %s, %s)
```

**字段来源**:
- `task_id`: 从 `call_tasks` 表新插入的任务ID
- `leads_id`: 从 `dcc_leads` 表查询得到的 `leads_id`
- `leads_name`: 从 `dcc_leads` 表查询得到的 `leads_user_name`
- `leads_phone`: 从 `dcc_leads` 表查询得到的 `leads_user_phone`
- `call_time`: 当前时间 `datetime.now()`
- `call_job_id`: **初始为空字符串** `""`
- `reference_id`: **生成规则** = `f"{task_id}{organization_id}{lead['leads_id']}"`

**特点**: 
- 创建任务时批量插入，此时 `call_job_id` 为空
- `reference_id` 用于后续匹配阿里云返回的 job

---

### 2. **call_job_id 匹配和写入** (`sync_call_job_ids_from_group`)

**位置**: `auto_call_service.py:287-513`

**重要说明**: 
- ⚠️ **此函数只负责获取和写入 `call_job_id`，不获取 `call_conversation`**
- `call_conversation` 的获取是**独立的第二步**，见下文第3节

**匹配逻辑**:
1. **优先使用 `reference_id` 匹配**:
   - 从阿里云 `query_jobs_with_result` 接口获取 job 列表（分页，每页100条）
   - 提取每个 job 的 `ReferenceId` 和 `phoneNumber`
   - 通过 `reference_id` 匹配数据库记录
   ```sql
   UPDATE leads_task_list AS l
   JOIN (...) AS d
   ON l.task_id = d.task_id AND l.reference_id = d.reference_id
   SET l.call_job_id = d.job_id
   WHERE (l.call_job_id IS NULL OR l.call_job_id = '')
   ```

2. **回退到 `phone_number` 匹配**:
   - 如果 `reference_id` 匹配失败（0条），使用 `phone_number` 匹配
   ```sql
   UPDATE leads_task_list AS l
   JOIN (...) AS d
   ON l.task_id = d.task_id AND l.leads_phone = d.phone
   SET l.call_job_id = d.job_id
   WHERE (l.call_job_id IS NULL OR l.call_job_id = '')
   ```

3. **未匹配记录处理**:
   - 如果 `reference_id` 或 `leads_phone` 存在但未匹配到，设置 `call_status = 'Failed'`
   ```sql
   UPDATE leads_task_list
   SET call_status = 'Failed'
   WHERE task_id = %s
     AND (call_job_id IS NULL OR call_job_id = '')
     AND ((reference_id IS NOT NULL AND reference_id != '') 
          OR (leads_phone IS NOT NULL AND leads_phone != ''))
   ```

**触发时机**:
- 任务开始外呼后 (`start_call_task_service:264`) - 异步执行
- 监控器检测到缺少 `call_job_id` 的记录时 (`auto_task_monitor.check_and_update_tasks:288`)

**执行流程**:
```
开始外呼 → 创建 job_group → 异步执行 sync_call_job_ids_from_group
  ↓
分页调用 query_jobs_with_result (每页100条)
  ↓
批量匹配并写入 call_job_id
  ↓
完成（此时 call_conversation 仍为空）
```

---

### 3. **call_conversation 获取和更新** (`_query_task_execution_core` / `update_task_execution`)

**位置**: 
- `auto_call_api.py:468-1076` (`_query_task_execution_core`)
- `auto_task_monitor.py:344-698` (`update_task_execution`)

**重要说明**: 
- ✅ **这是获取 `call_conversation` 的独立步骤**
- ⚠️ **前提条件**: 数据库中必须已有 `call_job_id`（`call_job_id IS NOT NULL AND call_job_id != ''`）
- 📋 **查询条件**: 只查询已有 `call_job_id` 的记录，不会查询 `call_job_id` 为空的记录

**执行流程**:
```
1. 从数据库查询已有的 call_job_id 列表（分页）
   SELECT call_job_id FROM leads_task_list 
   WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
   LIMIT %s OFFSET %s

2. 调用阿里云 list_jobs 接口，传入这些 call_job_id
   ListJobsSample.main([], job_ids=paginated_call_job_ids)

3. 从返回结果中提取 call_conversation 等信息
   conversation = last_task.get('Conversation')

4. 批量更新数据库
   UPDATE leads_task_list SET call_conversation = %s, ...
```

**匹配逻辑**:
1. **通过 `call_job_id` 匹配**:
   - 从数据库查询当前页的 `call_job_id` 列表
   - 调用阿里云 `list_jobs` 接口获取任务状态（传入 `call_job_id` 列表）
   - 通过 `reference_id` 和 `phone_number` 双重匹配，建立 `JobId` -> `call_job_id` 映射
   - 如果匹配失败，该 `call_job_id` 不会更新

2. **批量更新字段**:
```sql
UPDATE leads_task_list AS l
JOIN (...) AS d
ON l.task_id = d.task_id AND l.call_job_id = d.call_job_id
SET l.call_status = d.call_status,
    l.planed_time = d.planed_time,
    l.call_task_id = d.call_task_id,
    l.call_conversation = d.call_conversation,
    l.calling_number = d.calling_number,
    l.recording_url = d.recording_url
```

**字段来源** (从阿里云 `list_jobs` 返回):
- `call_status`: `job_data.get('Status')` (如 'Succeeded', 'Failed', 'Paused' 等)
- `planed_time`: `last_task.get('PlanedTime')` 转换为 datetime
- `call_task_id`: `last_task.get('TaskId')`
- `call_conversation`: `last_task.get('Conversation')` 序列化为 JSON ⭐ **关键字段**
- `calling_number`: `last_task.get('CallingNumber')`
- `recording_url`: 
  - 如果 `skip_recording=False` 且 `job_status='Succeeded'`，调用 `download_recording` 获取
  - 否则使用数据库中已有的值

**更新条件**:
- 仅当数据有变化时才更新（比较当前值与新值）
- `apply_update=True` 时才执行数据库更新

**触发时机**:
1. **手动查询**: 前端调用 `/query-task-execution` 接口
2. **自动触发**:
   - 任务开始后2秒 (`start_auto_check_after_creation:258`)
   - 监控器定时检查 (`check_and_update_tasks:339`)
   - 轻量后台循环 (`_lightweight_background_loop:175`) - 每10秒扫描一次

**关键点**:
- ⚠️ **必须先有 `call_job_id`，才能获取 `call_conversation`**
- ⚠️ **`call_conversation` 可能为空**（如果外呼未接通或阿里云未返回）
- ✅ **分页查询**，避免一次性查询过多数据

---

### 4. **录音URL补充** (`_lightweight_background_loop`)

**位置**: `auto_task_monitor.py:46-223`

**更新逻辑**:
```sql
SELECT l.task_id, l.call_job_id, l.call_task_id
FROM leads_task_list l
WHERE l.call_status = 'Succeeded'
  AND (l.recording_url IS NULL OR l.recording_url = '')
  AND l.call_task_id IS NOT NULL AND l.call_task_id != ''
```

**更新方式**:
```sql
UPDATE leads_task_list
SET recording_url = %s
WHERE task_id = %s AND call_job_id = %s
```

**特点**:
- 轻量后台循环，每10秒扫描一次
- 仅处理已接通 (`call_status='Succeeded'`) 但缺少录音的记录
- 批量处理，每次最多50条

---

### 5. **跟进记录关联** (`get_leads_follow_id`)

**位置**: `auto_call_api.py:1447-1701`

**更新字段**:
```sql
UPDATE leads_task_list 
SET leads_follow_id = %s, is_interested = %s
WHERE call_job_id = %s
```

**字段来源**:
- `leads_follow_id`: 从 `dcc_leads_follow` 表插入后返回的 `follow_id`
- `is_interested`: 
  - 有会话时：通过 AI 分析得到（0/1/2）
  - 无会话且 `call_status='Failed'`：固定为 `0`
  - 无会话且 `call_status` 为空：固定为 `0`

**触发时机**:
- 外呼完成且有会话内容时，自动触发 AI 分析
- 外呼完成但无会话时，创建基本跟进记录
- 监控器检测到缺少跟进记录时

**更新条件**:
- 仅当 `leads_follow_id` 为空时创建新记录
- 如果已存在跟进记录，仅更新 `is_interested`（在更新跟进时）

---

### 6. **跟进记录更新** (`get_leads_follow_id` 更新模式)

**位置**: `auto_call_api.py:1620-1655`

**更新逻辑**:
```sql
UPDATE dcc_leads_follow
SET leads_remark = %s,
    new_follow_time = %s,
    next_follow_time = %s
WHERE id = %s
```

**同步更新**:
```sql
UPDATE leads_task_list
SET is_interested = %s
WHERE call_job_id = %s
```

**特点**:
- 当已存在跟进记录时，更新跟进内容并同步 `is_interested`

---

## 字段匹配优先级总结

### call_job_id 匹配优先级：
1. **reference_id 匹配** (最高优先级)
   - 格式：`{task_id}{organization_id}{leads_id}`
   - 匹配条件：`l.reference_id = d.reference_id`
   
2. **phone_number 匹配** (回退方案)
   - 当 `reference_id` 匹配失败时使用
   - 匹配条件：`l.leads_phone = d.phone`
   
3. **JobId 直接匹配** (兜底方案)
   - 如果 `JobId` 在请求列表中，直接使用

### 数据更新流程：

```
创建任务
  ↓
批量插入 leads_task_list (call_job_id 为空)
  ↓
开始外呼 → 调用阿里云创建 job_group
  ↓
同步 call_job_id (通过 reference_id/phone 匹配)
  ↓
定时查询外呼状态 → 更新 call_status, call_conversation 等
  ↓
外呼完成 → 触发 AI 分析 → 创建跟进记录 → 更新 leads_follow_id, is_interested
```

---

## 关键匹配点

### 1. reference_id 生成规则
```python
reference_id = f"{task_id}{organization_id}{lead['leads_id']}"
```
- 用于唯一标识一个任务下的线索
- 在调用阿里云 `assign_jobs` 时作为 `referenceId` 传递

### 2. call_job_id 匹配策略
- **优先**: `reference_id` 精确匹配
- **回退**: `phone_number` 匹配
- **兜底**: `JobId` 直接匹配

### 3. 数据一致性保证
- 批量更新使用 `UNION ALL + JOIN` 方式，保证原子性
- 更新前检查数据是否有变化，避免无效更新
- 未匹配记录设置 `call_status='Failed'`，避免遗漏

---

## 注意事项

1. **call_job_id 为空的情况**:
   - 初始创建时为空字符串
   - 同步失败时可能仍为空
   - 查询时会过滤掉 `call_job_id IS NULL OR call_job_id = ''` 的记录

2. **reference_id 的重要性**:
   - 是匹配阿里云返回 job 的主要依据
   - 必须保证唯一性（task_id + organization_id + leads_id）

3. **批量更新性能**:
   - 使用 `UNION ALL + JOIN` 批量更新，避免逐条更新
   - 失败时回退为逐条更新

4. **异步处理**:
   - AI 分析在后台线程执行，不阻塞主流程
   - 录音下载在轻量后台循环中异步补充

---

## ⭐ call_job_id 与 call_conversation 获取流程总结

### 核心问题：是先获取所有 call_job_id 再请求 call_conversation，还是写入 call_job_id 后立即请求？

**答案：先批量获取所有 call_job_id 并写入数据库，然后通过定时任务或手动查询，使用已有的 call_job_id 去请求 call_conversation。**

### 详细流程：

```
┌─────────────────────────────────────────────────────────────┐
│ 第一步：获取 call_job_id (sync_call_job_ids_from_group)      │
├─────────────────────────────────────────────────────────────┤
│ 1. 调用 query_jobs_with_result 接口（分页，每页100条）       │
│ 2. 通过 reference_id/phone 匹配数据库记录                   │
│ 3. 批量更新 call_job_id                                     │
│ 4. 完成（此时 call_conversation 仍为空）                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 第二步：获取 call_conversation (_query_task_execution_core) │
├─────────────────────────────────────────────────────────────┤
│ 前提：数据库中已有 call_job_id                              │
│                                                             │
│ 1. 查询数据库中已有的 call_job_id 列表（分页）              │
│    WHERE call_job_id IS NOT NULL AND call_job_id != ''      │
│                                                             │
│ 2. 调用 list_jobs 接口，传入这些 call_job_id               │
│    ListJobsSample.main([], job_ids=[...])                  │
│                                                             │
│ 3. 从返回结果中提取 call_conversation                       │
│    conversation = last_task.get('Conversation')            │
│                                                             │
│ 4. 批量更新数据库                                           │
│    UPDATE ... SET call_conversation = %s                    │
└─────────────────────────────────────────────────────────────┘
```

### 关键点：

1. **两个步骤是分离的**：
   - `sync_call_job_ids_from_group` 只负责获取 `call_job_id`
   - `_query_task_execution_core` / `update_task_execution` 负责获取 `call_conversation`

2. **使用的接口不同**：
   - 获取 `call_job_id`: `query_jobs_with_result` (通过 `job_group_id` 查询)
   - 获取 `call_conversation`: `list_jobs` (通过 `call_job_id` 列表查询)

3. **触发时机**：
   - `call_job_id` 获取：任务开始外呼后立即异步执行
   - `call_conversation` 获取：
     - 任务开始后2秒自动触发
     - 监控器定时检查（每5分钟）
     - 轻量后台循环（每10秒）
     - 前端手动查询

4. **数据依赖关系**：
   - ⚠️ **必须先有 `call_job_id`，才能获取 `call_conversation`**
   - 查询 `call_conversation` 时会过滤掉 `call_job_id` 为空的记录
   - 如果 `call_job_id` 同步失败，该记录无法获取 `call_conversation`

5. **性能优化**：
   - `call_job_id` 同步：分页处理（每页100条），避免一次性查询过多
   - `call_conversation` 获取：分页查询（默认每页20条），支持手动调整 `page_size`
   - 批量更新：使用 `UNION ALL + JOIN` 批量更新，避免逐条更新

