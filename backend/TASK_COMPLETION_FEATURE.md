# 任务完成状态自动检查功能

## 功能概述

当查询到外呼数据时，如果任务中所有电话都是已接通的状态，则该任务自动完成，状态变更为"外呼完成"。

## 实现原理

### 1. 数据库表结构

- `call_tasks`: 外呼任务表，包含任务状态字段 `task_type`
  - `task_type = 1`: 已创建
  - `task_type = 2`: 开始外呼  
  - `task_type = 3`: 外呼完成
  - `task_type = 4`: 已删除

- `outbound_call_records`: 外呼记录表，包含通话状态字段 `call_status`
  - `Connected`: 已接通
  - `Succeeded`: 成功
  - `SucceededFinish`: 成功完成
  - `SucceededTransferByIntent`: 成功转接
  - `Failed`: 失败
  - `NotConnected`: 未接通
  - `Busy`: 忙线
  - `NoAnswer`: 无人接听

### 2. 自动检查逻辑

系统在以下情况下会自动检查任务完成状态：

1. **外呼记录更新时** (`update_outbound_call_records`)
2. **查询任务跟进记录时** (`get_task_followup_records`)
3. **手动检查任务完成状态时** (`check_task_completion`)

### 3. 检查规则

- 查询任务关联的所有外呼记录
- 统计已接通状态的通话数量
- 如果所有通话都是已接通状态，则更新任务状态为完成（`task_type = 3`）

## 代码实现

### 核心函数

#### `check_and_update_task_completion(job_group_id: str)`

```python
async def check_and_update_task_completion(job_group_id: str):
    """
    检查任务完成状态并自动更新
    
    Args:
        job_group_id: 外呼任务组ID
    """
    # 1. 查询该任务组关联的所有call_tasks
    # 2. 对每个任务检查其所有通话记录
    # 3. 统计已接通状态的通话数量
    # 4. 如果所有通话都是已接通状态，则更新任务为完成状态
```

#### 已接通状态判断

```python
# 检查是否为已接通状态
if call_status in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"]:
    connected_calls += 1
```

### 触发点

1. **外呼记录更新后自动触发**
   ```python
   # 在 update_outbound_call_records 函数末尾
   await check_and_update_task_completion(job_group_id)
   ```

2. **查询任务跟进记录时自动检查**
   ```python
   # 在 get_task_followup_records 函数中
   if is_completed and task_info['task_type'] != 3:
       # 自动更新任务状态为完成
   ```

3. **手动检查API**
   ```python
   # POST /check_task_completion
   # GET /check_task_completion/{task_id}
   ```

## API接口

### 1. 检查任务完成状态 (POST)

**接口**: `POST /check_task_completion`

**请求参数**:
```json
{
    "task_id": 123,
    "task_type": 2
}
```

**响应**:
```json
{
    "status": "success",
    "code": 200,
    "message": "任务已完成，所有通话都已接通",
    "data": {
        "task_id": 123,
        "task_type": 3,
        "is_completed": true,
        "total_calls": 5,
        "connected_calls": 5
    }
}
```

### 2. 检查任务完成状态 (GET)

**接口**: `GET /check_task_completion/{task_id}`

**响应**: 同上

### 3. 获取任务跟进记录

**接口**: `GET /task_followup_records/{task_id}`

**功能**: 获取任务跟进记录，同时自动检查任务完成状态

## 测试

运行测试脚本验证功能：

```bash
python test_task_completion.py
```

测试内容包括：
1. 创建测试任务和线索
2. 创建部分接通的外呼记录
3. 验证任务状态未完成
4. 更新所有通话为已接通
5. 验证任务状态自动更新为完成

## 注意事项

1. **性能考虑**: 自动检查逻辑在每次外呼记录更新时都会执行，对于大量数据的任务可能需要优化
2. **并发安全**: 多个外呼记录同时更新时，需要确保状态检查的一致性
3. **错误处理**: 检查过程中出现异常不会影响外呼记录的正常更新
4. **日志记录**: 所有状态变更都会记录详细的日志信息

## 扩展功能

未来可以考虑添加的功能：

1. **批量检查**: 支持批量检查多个任务的完成状态
2. **定时检查**: 添加定时任务定期检查所有进行中的任务
3. **通知机制**: 任务完成时发送通知给相关人员
4. **统计报表**: 提供任务完成情况的统计报表 