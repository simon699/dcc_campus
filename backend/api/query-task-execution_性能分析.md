# `/api/query-task-execution` 接口性能分析

## 一、接口概述

**接口路径**: `POST /api/query-task-execution`  
**文件位置**: `backend/api/auto_call_api.py` (第 994-1487 行)  
**主要功能**: 查询外呼任务执行情况，包括任务状态、对话记录、录音URL等

---

## 二、性能瓶颈分析

### 2.1 主要性能问题

#### 🔴 **问题 1: 查询所有 call_job_id 后才分页（最严重）**

**代码位置**: 第 1065-1082 行

```python
# 1. 在leads_task_list中找到对应task_id的call_job_id
leads_query = """
    SELECT call_job_id
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
"""

leads_result = execute_query(leads_query, (request.task_id,))  # ❌ 查询所有记录

# 提取所有call_job_id
call_job_ids = [lead['call_job_id'] for lead in leads_result if lead['call_job_id']]

# 计算分页切片
start_idx = (page - 1) * page_size
end_idx = start_idx + page_size
paginated_call_job_ids = call_job_ids[start_idx:end_idx]  # ❌ 在内存中分页
```

**性能影响**:
- ⚠️ **严重**: 如果任务有 10,000 条记录，即使只需要 20 条，也会查询所有 10,000 条
- ⚠️ **数据库负载**: 大量数据传输和处理
- ⚠️ **内存占用**: 将所有 call_job_id 加载到内存

**优化建议**:
```python
# ✅ 在数据库层面分页
leads_query = """
    SELECT call_job_id
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
    ORDER BY id
    LIMIT %s OFFSET %s
"""
offset = (page - 1) * page_size
leads_result = execute_query(leads_query, (request.task_id, page_size, offset))

# 如果需要总数，单独查询
count_query = """
    SELECT COUNT(*) as total
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
"""
total_result = execute_query(count_query, (request.task_id,))
total_jobs = total_result[0]['total'] if total_result else 0
```

---

#### 🔴 **问题 2: 循环中的 N+1 数据库查询**

**代码位置**: 第 1234-1390 行

**问题描述**: 在 `for job_data in jobs_data` 循环中，每个 job 都执行多次数据库查询：

```python
for job_data in jobs_data:  # 假设 20 个 job
    job_id = job_data.get('JobId')
    
    # ❌ 查询 1: 检查当前数据状态（第 1250-1255 行）
    current_data_query = """
        SELECT call_status, planed_time, call_task_id, call_conversation, 
               calling_number, recording_url
        FROM leads_task_list 
        WHERE task_id = %s AND call_job_id = %s
    """
    current_data_result = execute_query(current_data_query, (request.task_id, job_id))
    
    # ❌ 查询 2: 检查录音URL（如果跳过录音，第 1207-1217 行）
    check_recording_query = """
        SELECT recording_url 
        FROM leads_task_list 
        WHERE task_id = %s AND call_job_id = %s
    """
    recording_result = execute_query(check_recording_query, (request.task_id, job_id))
    
    # ❌ 查询 3: 检查是否需要AI处理（第 1334-1346 行）
    guard_rows = execute_query(
        """
        SELECT is_interested, leads_follow_id
        FROM leads_task_list
        WHERE task_id = %s AND call_job_id = %s
        """,
        (request.task_id, job_id)
    )
    
    # ❌ 查询 4: 检查跟进记录（第 1363-1368 行）
    check_follow_query = """
        SELECT leads_follow_id 
        FROM leads_task_list 
        WHERE call_job_id = %s
    """
    follow_result = execute_query(check_follow_query, (job_id,))
    
    # ❌ 查询 5: 获取 is_interested 和 follow_data（第 1423-1456 行）
    leads_query = """
        SELECT is_interested, leads_follow_id
        FROM leads_task_list 
        WHERE call_job_id = %s
    """
    leads_result = execute_query(leads_query, (job_id,))
    
    if leads_follow_id:
        follow_query = """
            SELECT id, leads_id, follow_time, leads_remark, 
                   frist_follow_time, new_follow_time, next_follow_time,
                   is_arrive, frist_arrive_time
            FROM dcc_leads_follow 
            WHERE id = %s
        """
        follow_result = execute_query(follow_query, (leads_follow_id,))
```

**性能影响**:
- ⚠️ **严重**: 如果有 20 个 job，每个 job 执行 5-6 次查询，总共 100-120 次数据库查询
- ⚠️ **数据库连接**: 频繁建立和释放数据库连接
- ⚠️ **网络延迟**: 每次查询都有网络往返时间

**优化建议**:
```python
# ✅ 批量查询所有需要的数据
job_ids = [job.get('JobId') for job in jobs_data]

# 一次性查询所有 job 的当前状态
placeholders = ','.join(['%s'] * len(job_ids))
batch_query = f"""
    SELECT call_job_id, call_status, planed_time, call_task_id, 
           call_conversation, calling_number, recording_url,
           is_interested, leads_follow_id
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IN ({placeholders})
"""
batch_result = execute_query(batch_query, (request.task_id, *job_ids))

# 构建字典，O(1) 查找
current_data_map = {row['call_job_id']: row for row in batch_result}

# 批量查询跟进数据
follow_ids = [row['leads_follow_id'] for row in batch_result if row.get('leads_follow_id')]
if follow_ids:
    follow_placeholders = ','.join(['%s'] * len(follow_ids))
    follow_batch_query = f"""
        SELECT id, leads_id, follow_time, leads_remark, 
               frist_follow_time, new_follow_time, next_follow_time,
               is_arrive, frist_arrive_time
        FROM dcc_leads_follow 
        WHERE id IN ({follow_placeholders})
    """
    follow_batch_result = execute_query(follow_batch_query, follow_ids)
    follow_data_map = {row['id']: row for row in follow_batch_result}
else:
    follow_data_map = {}

# 在循环中使用字典查找，而不是查询数据库
for job_data in jobs_data:
    job_id = job_data.get('JobId')
    current_data = current_data_map.get(job_id, {})
    follow_id = current_data.get('leads_follow_id')
    follow_data = follow_data_map.get(follow_id) if follow_id else None
    # ... 使用 current_data 和 follow_data
```

---

#### 🟡 **问题 3: 外部 API 调用阻塞**

**代码位置**: 第 1106-1119 行

```python
jobs_data = ListJobsSample.main(
    [],
    job_ids=paginated_call_job_ids  # 同步调用外部 API
)
```

**性能影响**:
- ⚠️ **中等**: 调用阿里云 API，网络延迟可能 100-500ms
- ⚠️ **阻塞**: 同步调用，等待响应后才能继续

**优化建议**:
- ✅ 使用异步调用（如果阿里云 SDK 支持）
- ✅ 增加请求超时设置
- ✅ 考虑缓存机制（短期内相同 job_id 的查询结果可能相同）

---

#### 🟡 **问题 4: 录音 URL 获取非常耗时**

**代码位置**: 第 1197-1224 行

```python
if not request.skip_recording and job_status == 'Succeeded' and call_task_id:
    # 检查当前recording_url状态
    # ...
    # 获取新的录音URL（这是最耗时的操作）
    try:
        new_recording_url = DownloadRecordingSample.main([], task_id=call_task_id)  # ❌ 非常慢
        # ...
```

**性能影响**:
- 🔴 **极严重**: 每个录音 URL 的获取可能需要 1-3 秒
- 🔴 **串行执行**: 如果有 20 个成功的任务，可能需要 20-60 秒

**优化建议**:
- ✅ **默认跳过**: 前端已设置 `skip_recording=true`，这是正确的
- ✅ **异步获取**: 如果确实需要录音 URL，使用后台任务异步获取
- ✅ **缓存机制**: 录音 URL 一旦获取，通常不会改变，可以永久缓存

---

#### 🟡 **问题 5: 数据库更新操作串行**

**代码位置**: 第 1308-1328 行

```python
for job_data in jobs_data:
    # ...
    update_query = """
        UPDATE leads_task_list 
        SET call_status = %s,
            planed_time = %s,
            call_task_id = %s,
            call_conversation = %s,
            calling_number = %s,
            recording_url = %s
        WHERE task_id = %s AND call_job_id = %s
    """
    affected_rows = execute_update(update_query, update_params)  # ❌ 逐个更新
```

**性能影响**:
- ⚠️ **中等**: 每个 UPDATE 操作都有开销
- ⚠️ **事务**: 如果有多个更新，应该使用事务批量提交

**优化建议**:
```python
# ✅ 批量更新（如果数据库支持）
# MySQL/MariaDB 可以使用 ON DUPLICATE KEY UPDATE
update_values = []
for job_data in jobs_data:
    # 准备更新数据
    update_values.append((job_status, plan_time, call_task_id, ...))

# 使用批量更新
if update_values:
    batch_update_query = """
        UPDATE leads_task_list 
        SET call_status = VALUES(call_status),
            planed_time = VALUES(planed_time),
            ...
        WHERE (task_id, call_job_id) IN (...)
    """
    # 执行批量更新
```

或者使用事务 + 批量执行：
```python
# ✅ 使用事务批量提交
with db.transaction():
    for update_query, update_params in update_list:
        execute_update(update_query, update_params)
```

---

#### 🟢 **问题 6: 不必要的任务状态更新查询**

**代码位置**: 第 1395-1447 行

```python
# 检查所有任务是否都完成
if task_statuses and all(status in ['Succeeded', 'Failed'] for status in task_statuses):
    # 检查该任务下是否所有线索的leads_follow_id都不为空
    check_follow_query = """
        SELECT COUNT(*) as total_count,
               SUM(CASE WHEN leads_follow_id IS NULL THEN 1 ELSE 0 END) as empty_count
        FROM leads_task_list 
        WHERE task_id = %s
    """
    follow_result = execute_query(check_follow_query, (request.task_id,))
    # ...
```

**性能影响**:
- 🟢 **轻微**: 这个查询影响较小，但可以考虑优化

**优化建议**:
- ✅ 只在确实需要时才执行（例如：当前页所有任务都完成时才检查）
- ✅ 可以考虑使用缓存或异步更新任务状态

---

### 2.2 性能问题汇总表

| 问题 | 严重程度 | 预估耗时 | 优化后预估耗时 | 优化难度 |
|-----|---------|---------|--------------|---------|
| 查询所有 call_job_id 后分页 | 🔴 严重 | 100-500ms | 10-50ms | 简单 |
| 循环中的 N+1 查询 | 🔴 严重 | 200-1000ms | 20-50ms | 中等 |
| 外部 API 调用阻塞 | 🟡 中等 | 100-500ms | 100-500ms | 困难 |
| 录音 URL 获取 | 🔴 极严重 | 20-60s | 0ms (跳过) | 简单 |
| 数据库更新串行 | 🟡 中等 | 50-200ms | 10-50ms | 中等 |
| 任务状态更新查询 | 🟢 轻微 | 10-50ms | 10-50ms | 简单 |

---

## 三、性能优化方案

### 3.1 立即优化（简单且有效）

#### 优化 1: 数据库层面分页 ✅

**影响**: 减少 80-95% 的数据传输量  
**难度**: ⭐ 简单  
**预计提升**: 50-90% 的响应时间

```python
# 修改前: 查询所有记录
leads_query = """
    SELECT call_job_id
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
"""

# 修改后: 在数据库层面分页
leads_query = """
    SELECT call_job_id, 
           COUNT(*) OVER() as total_count
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
    ORDER BY id
    LIMIT %s OFFSET %s
"""
```

#### 优化 2: 批量查询当前数据状态 ✅

**影响**: 将 N 次查询减少到 2 次  
**难度**: ⭐⭐ 中等  
**预计提升**: 60-80% 的响应时间

```python
# 修改前: 循环中逐个查询
for job_data in jobs_data:
    current_data_result = execute_query(current_data_query, (request.task_id, job_id))

# 修改后: 批量查询
job_ids = [job.get('JobId') for job in jobs_data]
batch_query = f"""
    SELECT call_job_id, call_status, planed_time, call_task_id, 
           call_conversation, calling_number, recording_url,
           is_interested, leads_follow_id
    FROM leads_task_list 
    WHERE task_id = %s AND call_job_id IN ({','.join(['%s'] * len(job_ids))})
"""
batch_result = execute_query(batch_query, (request.task_id, *job_ids))
current_data_map = {row['call_job_id']: row for row in batch_result}
```

#### 优化 3: 批量查询跟进数据 ✅

**影响**: 减少额外的数据库查询  
**难度**: ⭐⭐ 中等  
**预计提升**: 10-20% 的响应时间

```python
# 批量查询所有跟进数据
follow_ids = [row['leads_follow_id'] for row in batch_result if row.get('leads_follow_id')]
if follow_ids:
    follow_batch_query = f"""
        SELECT id, leads_id, follow_time, leads_remark, 
               frist_follow_time, new_follow_time, next_follow_time,
               is_arrive, frist_arrive_time
        FROM dcc_leads_follow 
        WHERE id IN ({','.join(['%s'] * len(follow_ids))})
    """
    follow_batch_result = execute_query(follow_batch_query, follow_ids)
    follow_data_map = {row['id']: row for row in follow_batch_result}
```

---

### 3.2 中期优化（需要更多改动）

#### 优化 4: 批量更新数据库 ✅

**影响**: 减少数据库写操作开销  
**难度**: ⭐⭐⭐ 复杂  
**预计提升**: 20-30% 的响应时间

```python
# 收集所有需要更新的数据
update_list = []
for job_data in jobs_data:
    # ... 准备更新数据
    update_list.append((job_status, plan_time, call_task_id, ...))

# 批量更新
if update_list:
    # 使用 ON DUPLICATE KEY UPDATE 或批量 INSERT ... ON DUPLICATE KEY UPDATE
    batch_update_query = """
        INSERT INTO leads_task_list 
        (task_id, call_job_id, call_status, planed_time, ...)
        VALUES %s
        ON DUPLICATE KEY UPDATE
        call_status = VALUES(call_status),
        planed_time = VALUES(planed_time),
        ...
    """
    execute_batch_update(batch_update_query, update_list)
```

#### 优化 5: 增加数据库索引 ✅

**影响**: 加速查询速度  
**难度**: ⭐ 简单  
**预计提升**: 10-50% 的查询时间

```sql
-- 在 leads_task_list 表上创建索引
CREATE INDEX idx_task_id_job_id ON leads_task_list(task_id, call_job_id);
CREATE INDEX idx_task_id_status ON leads_task_list(task_id, call_status);
CREATE INDEX idx_job_id_follow ON leads_task_list(call_job_id, leads_follow_id);
```

---

### 3.3 长期优化（架构层面）

#### 优化 6: 缓存机制 ✅

**影响**: 减少重复查询  
**难度**: ⭐⭐⭐ 复杂  
**预计提升**: 90%+ 的重复查询响应时间

```python
# 使用 Redis 缓存查询结果
import redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)

# 缓存 key: task_execution_{task_id}_{page}_{page_size}
cache_key = f"task_execution_{request.task_id}_{request.page}_{request.page_size}"
cached_result = redis_client.get(cache_key)

if cached_result:
    return json.loads(cached_result)

# 执行查询...
result = {...}

# 缓存结果（5分钟）
redis_client.setex(cache_key, 300, json.dumps(result))
return result
```

#### 优化 7: 异步处理非关键操作 ✅

**影响**: 减少主流程阻塞  
**难度**: ⭐⭐⭐⭐ 复杂  
**预计提升**: 用户体验显著提升

```python
# 使用 Celery 或类似工具异步处理
from celery import Celery

@celery_app.task
def update_job_status_async(job_id, status_data):
    # 异步更新数据库
    pass

@celery_app.task
def fetch_recording_url_async(call_task_id):
    # 异步获取录音 URL
    pass

# 主流程中
for job_data in jobs_data:
    # 立即返回，后台处理
    update_job_status_async.delay(job_id, status_data)
    if need_recording:
        fetch_recording_url_async.delay(call_task_id)
```

---

## 四、优化优先级建议

### 🔥 高优先级（立即实施）

1. **数据库层面分页** - 影响最大，实现最简单
2. **批量查询当前数据状态** - 显著减少数据库查询次数
3. **批量查询跟进数据** - 消除 N+1 查询问题

### 🔶 中优先级（1-2 周内）

4. **批量更新数据库** - 减少写操作开销
5. **增加数据库索引** - 加速查询

### 🔷 低优先级（1-2 月内）

6. **缓存机制** - 需要引入 Redis
7. **异步处理** - 需要引入消息队列

---

## 五、预期性能提升

### 当前性能（估算）

- **小任务** (20 条记录): 500-1000ms
- **中任务** (200 条记录): 2000-5000ms
- **大任务** (2000 条记录): 20000-50000ms

### 优化后性能（估算）

- **小任务** (20 条记录): 100-200ms (提升 80%)
- **中任务** (200 条记录): 200-400ms (提升 90%)
- **大任务** (2000 条记录): 500-1000ms (提升 95%)

---

## 六、实施建议

### 第一步：快速修复（1-2 天）

1. 实施优化 1: 数据库层面分页
2. 实施优化 2: 批量查询当前数据状态
3. 实施优化 3: 批量查询跟进数据

### 第二步：深度优化（1 周）

4. 实施优化 4: 批量更新数据库
5. 实施优化 5: 增加数据库索引

### 第三步：架构优化（1 月）

6. 实施优化 6: 缓存机制
7. 实施优化 7: 异步处理

---

## 七、监控建议

在优化前后，建议添加性能监控：

```python
import time
from functools import wraps

def performance_monitor(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = await func(*args, **kwargs)
            elapsed = time.time() - start_time
            print(f"[性能监控] {func.__name__} 耗时: {elapsed:.3f}s")
            return result
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[性能监控] {func.__name__} 失败，耗时: {elapsed:.3f}s, 错误: {str(e)}")
            raise
    return wrapper

@performance_monitor
async def query_task_execution(...):
    # ...
```

---

**文档版本**: v1.0  
**最后更新**: 2024年  
**作者**: 性能分析团队
