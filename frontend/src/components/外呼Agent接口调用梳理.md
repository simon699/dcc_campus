# 外呼Agent → MonitorDrawer → CallStatusDrawer 接口调用梳理

## 调用链路概览

```
外呼Agent (page.tsx)
    ↓
MonitorDrawer (MonitorDrawer.tsx)
    ↓
CallStatusDrawer (CallStatusDrawer.tsx)
```

---

## 1. 外呼Agent (page.tsx)

### 触发时机
用户点击"外呼Agent"卡片时触发

### 调用接口

#### 1.1 获取任务列表
- **接口**: `tasksAPI.getTaskListPaged()`
- **位置**: ```424:428:frontend/src/app/page.tsx```
- **参数**:
  - `page: 1`
  - `pageSize: 50`
  - `options: { taskTypes: [2, 3, 5] }` (筛选执行中、已完成、已暂停的任务)
- **后端接口**: `GET /task_list?page=1&page_size=50&task_types=2,3,5`
- **返回数据**: 任务列表，包含 `task_type`、`task_name`、`leads_count` 等字段
- **用途**: 获取外呼中、外呼完成或已暂停的任务列表，用于显示在 MonitorDrawer 中

### 数据流转
- 获取到的任务列表转换为 `CallingTask[]` 格式
- 通过 `callingTasks` prop 传递给 `MonitorDrawer`
- 设置 `showMonitorDrawer = true` 打开监控抽屉

---

## 2. MonitorDrawer (MonitorDrawer.tsx)

### 触发时机
1. 组件打开时（从外呼Agent传入任务列表）
2. 用户点击任务卡片时
3. 用户点击暂停/重启按钮时
4. 刷新任务详情时

### 调用接口

#### 2.1 获取任务组进度信息
- **接口**: `tasksAPI.describeJobGroup()`
- **位置**: ```49:49:frontend/src/components/MonitorDrawer.tsx```
- **触发时机**: 用户点击任务卡片时
- **参数**:
  - `{ task_id: parseInt(task.id) }`
- **后端接口**: `POST /describe-job-group`
- **请求体**:
  ```json
  {
    "task_id": 123
  }
  ```
- **返回数据**: 任务组进度信息，包含 `progress`、`status` 等字段
- **用途**: 获取任务组进度数据，传递给 CallStatusDrawer 作为初始数据，避免重复请求

#### 2.2 暂停/重启任务
- **接口**: `tasksAPI.suspendResumeTask()`
- **位置**: ```83:83:frontend/src/components/MonitorDrawer.tsx```
- **触发时机**: 用户点击暂停或重启按钮时
- **参数**:
  - `taskId: parseInt(task.id)`
  - `action: 'suspend' | 'resume'`
- **后端接口**: `POST /suspend-resume-task`
- **请求体**:
  ```json
  {
    "action": "suspend",  // 或 "resume"
    "task_id": 123
  }
  ```
- **返回数据**: 更新后的任务信息，包含 `task_type` 字段
- **用途**: 暂停或重启外呼任务

#### 2.3 查询任务执行情况（失败时）
- **接口**: `tasksAPI.queryTaskExecution()`
- **位置**: ```107:107:frontend/src/components/MonitorDrawer.tsx``` 和 ```128:128:frontend/src/components/MonitorDrawer.tsx```
- **触发时机**: 暂停/重启任务操作失败后，用于查询任务最新状态
- **参数**:
  - `taskId: parseInt(task.id)`
- **后端接口**: `POST /query-task-execution`
- **请求体**:
  ```json
  {
    "task_id": 123,
    "page": 1,
    "page_size": 20,
    "skip_recording": true,
    "only_followed": false,
    "apply_update": false
  }
  ```
- **用途**: 操作失败后验证任务状态，如果任务状态不是2或5，则关闭弹窗

#### 2.4 刷新任务详情
- **接口**: `tasksAPI.getCallTaskDetails()`
- **位置**: ```69:69:frontend/src/components/MonitorDrawer.tsx```
- **触发时机**: 调用 `handleRefreshTaskDetails` 时
- **参数**:
  - `taskId: selectedTask.id`
- **后端接口**: `GET /tasks`
- **用途**: 重新获取任务详情，包括 `leads_task_list` 数据

### 数据流转
- 点击任务卡片时，调用 `describeJobGroup` 获取进度数据
- 将进度数据通过 `initialJobGroupProgress` prop 传递给 `CallStatusDrawer`
- 设置 `showCallStatus = true` 打开 CallStatusDrawer

---

## 3. CallStatusDrawer (CallStatusDrawer.tsx)

### 触发时机
1. 组件打开时（从 MonitorDrawer 传入任务ID和初始进度数据）
2. 用户点击刷新按钮时
3. 用户翻页时
4. 用户点击暂停/重启按钮时

### 调用接口

#### 3.1 获取任务组进度信息
- **接口**: `tasksAPI.describeJobGroup()`
- **位置**: ```137:137:frontend/src/components/CallStatusDrawer.tsx```
- **触发时机**: 
  - 组件打开时（如果未传入 `initialJobGroupProgress`）
  - 用户点击刷新按钮时
- **参数**:
  - `{ task_id: parseInt(taskId) }`
- **后端接口**: `POST /describe-job-group`
- **请求体**:
  ```json
  {
    "task_id": 123
  }
  ```
- **返回数据**: 任务组进度信息，包含：
  - `progress.total_jobs`: 总任务数
  - `progress.total_completed`: 已完成数
  - `progress.failed`: 失败数
  - `progress.executing`: 执行中数
  - `progress.scheduling`: 调度中数
  - `status`: 任务组状态
- **用途**: 获取任务组进度概览数据，用于显示在任务状态概览区域

#### 3.2 查询任务执行情况（分页）
- **接口**: `tasksAPI.queryTaskExecution()`
- **位置**: ```182:182:frontend/src/components/CallStatusDrawer.tsx```
- **触发时机**: 
  - 组件打开时（初始加载）
  - 用户点击刷新按钮时
  - 用户翻页时
  - 暂停/重启任务后刷新时
- **参数**:
  - `taskId: parseInt(taskId, 10)`
  - `page: number` (默认1，翻页时传入目标页码)
  - `pageSize: number` (默认20，后端可能返回新的 page_size)
- **后端接口**: `POST /query-task-execution`
- **请求体**:
  ```json
  {
    "task_id": 123,
    "page": 1,
    "page_size": 20,
    "skip_recording": true,
    "only_followed": false,
    "apply_update": false
  }
  ```
- **返回数据**: 任务执行情况，包含：
  - `jobs_data`: 外呼任务详情列表（分页）
  - `task_stats`: 任务统计信息
    - `is_completed`: 是否已完成
    - `total_calls`: 总外呼数
    - `connected_calls`: 已接通数
    - `not_connected_calls`: 未接通数
  - `pagination`: 分页信息
    - `page`: 当前页码
    - `page_size`: 每页大小
    - `total_pages`: 总页数
    - `total_count`: 总记录数
  - `total_jobs`: 总任务数
  - `query_time`: 查询时间
- **用途**: 
  - 获取外呼任务详情列表（分页显示）
  - 获取任务统计信息（用于概览显示）
  - 支持分页浏览外呼记录

#### 3.3 暂停/重启任务
- **接口**: `tasksAPI.suspendResumeTask()`
- **位置**: ```686:686:frontend/src/components/CallStatusDrawer.tsx```
- **触发时机**: 用户点击暂停或重启按钮时
- **参数**:
  - `taskId: parseInt(taskId)`
  - `action: 'suspend' | 'resume'`
- **后端接口**: `POST /suspend-resume-task`
- **请求体**:
  ```json
  {
    "action": "suspend",  // 或 "resume"
    "task_id": 123
  }
  ```
- **返回数据**: 更新后的任务信息，包含 `task_type` 字段
- **用途**: 暂停或重启外呼任务，操作成功后刷新任务状态

#### 3.4 查询任务执行情况（失败时）
- **接口**: `tasksAPI.queryTaskExecution()`
- **位置**: ```702:702:frontend/src/components/CallStatusDrawer.tsx``` 和 ```723:723:frontend/src/components/CallStatusDrawer.tsx```
- **触发时机**: 暂停/重启任务操作失败后，用于查询任务最新状态
- **参数**:
  - `taskId: parseInt(taskId)`
  - `page: 1`
  - `pageSize: 20`
- **后端接口**: `POST /query-task-execution`
- **用途**: 操作失败后验证任务状态，如果任务状态不是2或5，则关闭弹窗

### 数据流转
- 打开时：如果传入了 `initialJobGroupProgress`，直接使用；否则并行调用 `describeJobGroup` 和 `queryTaskExecution`
- 刷新时：并行调用 `describeJobGroup` 和 `queryTaskExecution`，然后调用 `onRefresh()` 回调
- 翻页时：只调用 `queryTaskExecution`，不更新概览数据
- 暂停/重启时：调用 `suspendResumeTask`，成功后刷新任务状态

### 缓存机制
- 使用 `statusCache` Map 缓存 `queryTaskExecution` 的响应数据
- 缓存键格式：`task_execution_{taskId}_{page}_{pageSize}`
- 缓存时长：10秒（10000ms）
- 刷新时清除当前任务的所有分页缓存

### 防抖机制
- 使用 `lastFetchTimeRef` 记录上次请求时间
- 最小请求间隔：3秒（3000ms）
- 使用 `pendingFetchRef` 防止并发请求

---

## 接口调用时序图

### 场景1: 打开外呼Agent监控
```
用户点击外呼Agent卡片
    ↓
page.tsx: getTaskListPaged() [GET /task_list]
    ↓
打开 MonitorDrawer
    ↓
用户点击任务卡片
    ↓
MonitorDrawer: describeJobGroup() [POST /describe-job-group]
    ↓
打开 CallStatusDrawer
    ↓
CallStatusDrawer: queryTaskExecution() [POST /query-task-execution] (并行)
    ↓
显示外呼详情
```

### 场景2: 刷新外呼详情
```
用户点击刷新按钮
    ↓
CallStatusDrawer: 清除缓存
    ↓
CallStatusDrawer: describeJobGroup() [POST /describe-job-group] (并行)
CallStatusDrawer: queryTaskExecution() [POST /query-task-execution] (并行)
    ↓
更新显示数据
    ↓
调用 onRefresh() 回调
```

### 场景3: 暂停/重启任务
```
用户点击暂停/重启按钮
    ↓
MonitorDrawer 或 CallStatusDrawer: suspendResumeTask() [POST /suspend-resume-task]
    ↓
操作成功 → 刷新任务状态
操作失败 → queryTaskExecution() 验证状态
    ↓
如果状态不是2或5 → 关闭弹窗
```

---

## 接口汇总表

| 组件 | 接口方法 | 后端路径 | 请求方法 | 主要用途 |
|------|---------|---------|---------|---------|
| page.tsx | `getTaskListPaged` | `/task_list` | GET | 获取任务列表（筛选类型2,3,5） |
| MonitorDrawer | `describeJobGroup` | `/describe-job-group` | POST | 获取任务组进度信息 |
| MonitorDrawer | `suspendResumeTask` | `/suspend-resume-task` | POST | 暂停/重启任务 |
| MonitorDrawer | `queryTaskExecution` | `/query-task-execution` | POST | 查询任务执行情况（失败时验证） |
| MonitorDrawer | `getCallTaskDetails` | `/tasks` | GET | 刷新任务详情 |
| CallStatusDrawer | `describeJobGroup` | `/describe-job-group` | POST | 获取任务组进度信息 |
| CallStatusDrawer | `queryTaskExecution` | `/query-task-execution` | POST | 查询任务执行情况（分页） |
| CallStatusDrawer | `suspendResumeTask` | `/suspend-resume-task` | POST | 暂停/重启任务 |

---

## 注意事项

1. **数据传递优化**: MonitorDrawer 在打开 CallStatusDrawer 前先获取 `describeJobGroup` 数据，通过 `initialJobGroupProgress` prop 传递，避免 CallStatusDrawer 重复请求。

2. **并行请求**: CallStatusDrawer 打开时，如果没有初始数据，会并行调用 `describeJobGroup` 和 `queryTaskExecution`，提高加载速度。

3. **缓存机制**: `queryTaskExecution` 使用10秒缓存，减少重复请求。刷新时会清除缓存。

4. **防抖机制**: 使用3秒最小间隔和请求锁，防止频繁请求。

5. **错误处理**: 暂停/重启操作失败后，会调用 `queryTaskExecution` 验证任务状态，如果状态已变化则关闭弹窗。

6. **分页处理**: `queryTaskExecution` 支持分页，翻页时只请求列表数据，不更新概览数据。

