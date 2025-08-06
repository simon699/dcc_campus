# 自动化任务功能使用说明

## 功能概述

自动化任务功能实现了以下核心功能：

1. **创建任务后自动检查**：在创建自动外呼任务（`/create-autoCall-tasks`）成功后，自动启动检查流程
2. **定期监控任务状态**：每5分钟检查一次任务状态，更新外呼任务执行情况
3. **自动更新跟进记录**：当检测到`leads_follow_id`为空时，自动调用`/query-task-execution`查询外呼任务并更新数据
4. **自动更新任务状态**：当同一任务下所有线索的`leads_follow_id`都不为空时，将任务状态更新为4（跟进完成）

## 使用条件

- 只有在`call_tasks`表中`task_type = 2`（开始外呼）的任务才会被检查
- 只有在`leads_task_list`表中`leads_follow_id`为空的记录才会被处理

## API接口

### 1. 控制自动化任务

**接口地址**：`POST /auto-task`

**请求参数**：
```json
{
    "action": "start|stop|check"
}
```

**参数说明**：
- `start`: 启动自动化任务监控
- `stop`: 停止自动化任务监控  
- `check`: 立即执行一次任务检查

**响应示例**：
```json
{
    "status": "success",
    "code": 200,
    "message": "自动化任务监控已启动",
    "data": {
        "is_running": true,
        "action": "start"
    }
}
```

## 启动方式

### 方式一：自动启动（推荐）
项目启动后会自动启动自动化任务监控，无需手动操作。

```bash
python main.py
```

启动后会看到以下日志：
```
🚀 DCC数字员工服务启动中...
✅ 自动化任务监控已启动
```

### 方式二：通过API控制
```bash
# 启动监控
curl -X POST "http://your-api-domain/auto-task" \
  -H "Content-Type: application/json" \
  -H "access-token: your-token" \
  -d '{"action": "start"}'

# 停止监控
curl -X POST "http://your-api-domain/auto-task" \
  -H "Content-Type: application/json" \
  -H "access-token: your-token" \
  -d '{"action": "stop"}'

# 立即执行一次检查
curl -X POST "http://your-api-domain/auto-task" \
  -H "Content-Type: application/json" \
  -H "access-token: your-token" \
  -d '{"action": "check"}'
```

### 方式三：独立脚本启动
```bash
python start_auto_monitor.py
```

## 工作流程

1. **服务启动阶段**：
   - 项目启动时自动启动自动化任务监控
   - 监控器开始运行，每5分钟检查一次任务状态

2. **任务创建阶段**：
   - 用户调用`/create-autoCall-tasks`创建任务
   - 任务创建成功后，自动启动检查流程

3. **监控检查阶段**：
   - 每5分钟检查一次所有`task_type = 2`的任务
   - 检查每个任务下是否有`leads_follow_id`为空的记录

4. **数据更新阶段**：
   - 如果发现`leads_follow_id`为空的记录，调用`/query-task-execution`查询外呼任务状态
   - 更新`leads_task_list`表中的通话记录、录音URL等信息
   - 自动创建跟进记录，更新`leads_follow_id`和`is_interested`字段

5. **状态更新阶段**：
   - 当所有外呼任务完成时，检查所有线索的`leads_follow_id`
   - 如果所有线索的`leads_follow_id`都不为空，将`task_type`更新为4（跟进完成）
   - 如果还有线索的`leads_follow_id`为空，将`task_type`更新为3（外呼完成）

6. **服务关闭阶段**：
   - 项目关闭时自动停止自动化任务监控

## 数据库表结构

### call_tasks表
- `task_type`: 任务类型
  - 1: 已创建
  - 2: 开始外呼
  - 3: 外呼完成（所有外呼任务完成，但可能还有线索未跟进）
  - 4: 跟进完成（所有线索的跟进记录都已创建）

### leads_task_list表
- `leads_follow_id`: 线索跟进ID（为空时需要处理）
- `call_job_id`: 电话任务ID
- `call_conversation`: 通话记录详情
- `recording_url`: 录音文件URL
- `is_interested`: 客户意向（0-无法判断，1-有意向，2-无意向）

## 错误处理

- 监控过程中出现异常时，会记录错误日志并继续运行
- AI接口调用失败时，会使用默认值创建跟进记录
- 网络异常时，会等待1分钟后重试

## 注意事项

1. 确保数据库连接正常
2. 确保AI接口配置正确
3. 监控脚本需要持续运行
4. 建议在生产环境中使用进程管理工具（如supervisor）来管理监控脚本

## 日志输出

监控脚本会输出以下日志：
- 监控启动/停止信息
- 任务检查进度
- 数据更新结果
- 错误信息

示例：
```
自动化任务监控器已启动
检查任务: 测试任务 (ID: 123)
任务 123 的跟进记录创建成功
任务 测试任务 (ID: 123) 所有线索跟进完成，状态更新为4
``` 