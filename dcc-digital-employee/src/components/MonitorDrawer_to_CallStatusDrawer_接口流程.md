# MonitorDrawer → CallStatusDrawer 接口请求流程文档

## 概述

本文档详细梳理了从 `MonitorDrawer.tsx` 组件点击任务到 `CallStatusDrawer.tsx` 组件请求接口的完整流程，包括所有接口调用的顺序、触发条件和参数。

---

## 一、组件关系

### 1.1 组件层级

```
Home (page.tsx)
  └── MonitorDrawer
      └── CallStatusDrawer (条件渲染)
```

### 1.2 组件职责

- **MonitorDrawer**: 外呼Agent监控抽屉，显示任务列表和总体统计
- **CallStatusDrawer**: 电话拨打情况抽屉，显示单个任务的详细拨打记录

---

## 二、完整流程

### 2.1 阶段一：MonitorDrawer 初始化

#### 2.1.1 组件打开时

**触发时机**: `MonitorDrawer` 的 `isOpen` 从 `false` 变为 `true`

**执行流程**:
1. `useEffect` 监听 `callingTasks` 变化，同步更新本地状态
2. **不再自动轮询** - 已移除定时刷新逻辑

**重要变更**:
- ❌ **已移除**: 自动定时刷新任务状态的功能
- ❌ **已移除**: 打开组件时的延迟查询
- ❌ **已移除**: 每 60 秒的定时器轮询
- ✅ **保留**: 从父组件传入的 `callingTasks` 数据同步显示

**说明**: 
- MonitorDrawer 现在只负责展示任务列表，不主动请求接口
- 所有数据查询都在用户点击任务卡片后，由 CallStatusDrawer 组件负责

---

### 2.2 阶段二：用户点击任务

#### 2.2.1 点击事件触发

**触发位置**: `MonitorDrawer.tsx` 第 403 行

```typescript
onClick={() => handleTaskClick(task)}
```

**执行函数**: `handleTaskClick` (第 167-174 行)

```typescript
const handleTaskClick = useCallback((task: CallingTask) => {
  // 1. 设置选中的任务
  setSelectedTask(task);
  
  // 2. 打开 CallStatusDrawer
  setShowCallStatus(true);
  
  // 3. 更新最后检查时间，防止定时器重复查询
  lastCheckRef.current[task.id] = Date.now();
}, []);
```

**关键点**:
- ❌ **不发起接口请求** - 直接显示抽屉，由 CallStatusDrawer 自己负责加载数据
- ✅ **设置选中任务** - 用于传递给 CallStatusDrawer 组件
- ✅ **打开抽屉** - 设置 `showCallStatus = true`，触发 CallStatusDrawer 渲染

---

### 2.3 阶段三：CallStatusDrawer 初始加载

#### 2.3.1 组件渲染与初始化

**触发时机**: `CallStatusDrawer` 的 `isOpen` 从 `false` 变为 `true`

**执行流程**: `useEffect` (第 356-385 行)

```typescript
useEffect(() => {
  if (isOpen && taskId) {
    // 1. 重置状态
    setPage(1);
    setHasMore(true);
    setCallJobs([]);
    setTotalCount(0);
    
    // 2. 清除之前的请求锁和定时器
    pendingFetchRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // 3. 初始加载（不防抖，立即加载）
    fetchCallStatus(false, true);
  }
}, [isOpen, taskId]);
```

#### 2.3.2 数据加载函数: `fetchCallStatus`

**函数位置**: `CallStatusDrawer.tsx` 第 150-346 行

**调用参数**:
- `append: false` - 首次加载，替换现有数据
- `skipIntervalCheck: true` - 跳过时间间隔检查（初始加载时立即执行）

**执行流程**:

1. **防重复请求检查** (第 156-163 行)
   ```typescript
   if (!append && pendingFetchRef.current) {
     console.log('已有请求正在进行，跳过重复请求');
     await pendingFetchRef.current;
     return;
   }
   ```

2. **缓存检查** (第 168-218 行)
   ```typescript
   const cacheKey = `task_execution_${taskId}_1_${pageSize}`;
   if (isCacheValid(cacheKey, 10000)) { // 10秒缓存
     const cachedData = getCachedData(cacheKey);
     if (cachedData && cachedData.status === 'success') {
       // 使用缓存数据，不发起新请求
       // ... 处理缓存数据并返回
     }
   }
   ```
   - **缓存时长**: 10 秒
   - **缓存键格式**: `task_execution_{taskId}_{page}_{pageSize}`
   - **如果缓存有效**: 直接使用缓存数据，**不发起接口请求**

3. **时间间隔检查** (第 223-225 行)
   ```typescript
   // 初始加载时跳过时间间隔检查（skipIntervalCheck = true）
   if (!skipIntervalCheck && !append && now - lastFetchTimeRef.current < minFetchInterval) {
     return; // minFetchInterval = 3000ms
   }
   ```

4. **设置加载状态** (第 227-232 行)
   ```typescript
   if (append) {
     setLoadingMore(true);
   } else {
     setLoading(true);
     setError(null);
   }
   ```

5. **发起接口请求** (第 234-247 行)

#### 2.3.3 接口调用详情

**接口**: `tasksAPI.queryTaskExecution`

**调用位置**: `CallStatusDrawer.tsx` 第 239 行

**接口路径**: `POST /query-task-execution`

**请求参数**:
```json
{
  "task_id": number,      // 任务ID（从 props.taskId 获取，转换为 number）
  "page": 1,              // 初始加载第一页
  "page_size": 20,        // 每页20条
  "skip_recording": true  // 跳过录音获取（可选，默认 true）
}
```

**接口定义**: `services/api.ts` 第 297-307 行

```typescript
queryTaskExecution: async (taskId: number, page: number = 1, pageSize: number = 20, skipRecording: boolean = true) => {
  return apiRequest('/query-task-execution', {
    method: 'POST',
    body: JSON.stringify({
      task_id: taskId,
      page: page,
      page_size: pageSize,
      skip_recording: skipRecording
    })
  });
}
```

**响应数据格式**:
```typescript
{
  status: 'success',
  data: {
    total_jobs: number,              // 总任务数
    jobs_data: Array<JobData>,       // 当前页的任务数据
    pagination: {
      page: number,                  // 当前页码
      page_size: number,             // 每页数量
      total_pages: number            // 总页数
    },
    query_time: string,              // 查询时间
    task_type: number,               // 任务类型
    error_count: number              // 错误数量
  }
}
```

**缓存处理** (第 235-242 行):
```typescript
const executionCacheKey = `task_execution_${taskId}_${currentPage}_${pageSize}`;
let executionResponse;

if (isCacheValid(executionCacheKey, 10000)) {
  executionResponse = getCachedData(executionCacheKey);
} else {
  executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId), currentPage, pageSize);
  if (executionResponse.status === 'success') {
    setCachedData(executionCacheKey, executionResponse, 10000); // 缓存10秒
  }
}
```

**数据处理** (第 252-346 行):

1. **更新总数和分页信息**:
   ```typescript
   const totalJobs = taskData.total_jobs || 0;
   setTotalCount(totalJobs);
   
   if (taskData.pagination) {
     const { page: currentPageNum, total_pages } = taskData.pagination;
     setHasMore(currentPageNum < total_pages);
     setPage(2); // 首次加载后，下次加载第二页
   }
   ```

2. **计算任务状态** (首次加载时):
   ```typescript
   const succeededJobs = jobsData.filter((job: any) => job.Status === "Succeeded").length;
   const connectedCount = succeededJobs;
   const notConnectedCount = jobsData.length - connectedCount;
   
   setTaskStatus({
     is_completed: false,
     total_calls: totalJobs,
     connected_calls: connectedCount,
     not_connected_calls: notConnectedCount,
     query_time: taskData.query_time
   });
   ```

3. **处理 jobs_data**:
   ```typescript
   const processedJobs = taskData.jobs_data.map((job: any) => {
     return {
       job_id: job.JobId || '未知',
       job_group_id: job.JobGroupId || '未知',
       status: job.Status || '未知',
       priority: job.Priority || 0,
       created_time: new Date().toISOString(),
       modified_time: new Date().toISOString(),
       raw_data: job // 将整个 job 对象作为 raw_data
     };
   });
   
   setCallJobs(processedJobs); // 首次加载，替换数据
   ```

---

### 2.4 阶段四：滚动加载更多

#### 2.4.1 滚动监听

**触发位置**: `CallStatusDrawer.tsx` 第 388-407 行

```typescript
useEffect(() => {
  const scrollContainer = scrollContainerRef.current;
  if (!scrollContainer || !isOpen || !hasMore) return;

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    // 当滚动到距离底部100px时开始加载
    if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore && !loading) {
      loadMore();
    }
  };

  scrollContainer.addEventListener('scroll', handleScroll);
  return () => scrollContainer.removeEventListener('scroll', handleScroll);
}, [isOpen, hasMore, loadingMore, loading, loadMore]);
```

#### 2.4.2 加载更多函数

**函数位置**: `CallStatusDrawer.tsx` 第 348-352 行

```typescript
const loadMore = useCallback(() => {
  if (!loadingMore && hasMore && !loading) {
    fetchCallStatus(true); // append = true
  }
}, [loadingMore, hasMore, loading]);
```

#### 2.4.3 追加模式接口调用

**调用参数**:
- `append: true` - 追加模式，将新数据追加到现有数据
- `skipIntervalCheck: false` - 需要检查时间间隔

**执行流程**:

1. **时间间隔检查** (第 223-225 行)
   ```typescript
   if (!skipIntervalCheck && !append && now - lastFetchTimeRef.current < minFetchInterval) {
     return; // 追加模式不检查，直接执行
   }
   ```

2. **设置加载状态** (第 227 行)
   ```typescript
   setLoadingMore(true);
   ```

3. **获取当前页码** (第 234 行)
   ```typescript
   const currentPage = append ? page : 1; // 使用 state 中的 page 值
   ```

4. **接口调用** (第 239 行)
   ```typescript
   executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId), currentPage, pageSize);
   ```
   - **page**: 从 state 获取（首次加载后为 2，后续递增）
   - **pageSize**: 固定 20

5. **数据追加** (第 324-332 行)
   ```typescript
   if (append) {
     // 追加模式：将新数据追加到现有数据
     setCallJobs(prev => [...prev, ...processedJobs]);
     setPage(currentPageNum + 1); // 设置下一页
   }
   ```

---

### 2.5 阶段五：手动刷新

#### 2.5.1 刷新按钮触发

**触发位置**: `CallStatusDrawer.tsx` 第 533 行

```typescript
onClick={() => {
  debouncedFetchCallStatus(); // 使用防抖刷新
}}
```

**防抖函数**: `debouncedFetchCallStatus` (第 128-148 行)

```typescript
const debouncedFetchCallStatus = useCallback((isInitial: boolean = false) => {
  if (isInitial && pendingFetchRef.current) {
    return; // 初始加载时已有请求在进行，跳过
  }
  
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }

  if (isInitial) {
    fetchCallStatus(false, true); // 初始加载，立即执行
  } else {
    debounceTimerRef.current = setTimeout(() => {
      fetchCallStatus(); // 延迟 500ms 执行
    }, 500);
  }
}, []);
```

**刷新执行**:
- **防抖延迟**: 500ms
- **调用参数**: `fetchCallStatus(false, false)`
  - `append: false` - 替换现有数据
  - `skipIntervalCheck: false` - 需要检查时间间隔（最小3秒）

---

### 2.6 阶段六：暂停/重启任务

#### 2.6.1 暂停/重启按钮

**触发位置**: `CallStatusDrawer.tsx` 第 540 行（暂停）和第 560 行（重启）

```typescript
const handleSuspendResumeTask = async (action: 'suspend' | 'resume') => {
  // ... 执行暂停/重启操作
}
```

#### 2.6.2 接口调用

**接口**: `tasksAPI.suspendResumeTask`

**调用位置**: `CallStatusDrawer.tsx` 第 541 行

**接口路径**: `POST /suspend-resume-task`

**请求参数**:
```json
{
  "task_id": number,     // 任务ID
  "action": "suspend" | "resume"  // 操作类型
}
```

**接口定义**: `services/api.ts` 第 308-314 行

```typescript
suspendResumeTask: async (taskId: number, action: 'suspend' | 'resume') => {
  return apiRequest('/suspend-resume-task', {
    method: 'POST',
    body: JSON.stringify({
      action: action,
      task_id: taskId
    })
  });
}
```

**响应处理** (第 542-556 行):
```typescript
if (response.status === 'success') {
  // 1. 通知父组件任务类型已变化
  if (onTaskTypeChange) {
    onTaskTypeChange(response.data.task_type);
  }
  
  // 2. 刷新任务状态
  fetchCallStatus(); // 立即刷新
}
```

**失败处理** (第 557-585 行):
```typescript
// 操作失败时，立即查询任务最新状态
const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId), 1, 20);
if (executionResponse.status === 'success') {
  const taskData = executionResponse.data;
  
  // 如果任务状态不是2或5，则关闭弹窗
  if (taskData.task_type !== 2 && taskData.task_type !== 5) {
    onClose();
    return;
  }
}
```

---

## 三、接口调用总结

### 3.1 接口列表

| 接口路径 | 方法 | 触发时机 | 调用位置 | 参数 |
|---------|------|---------|---------|------|
| ~~`/query-task-execution`~~ | ~~POST~~ | ~~MonitorDrawer 定时刷新~~ | ~~已移除~~ | ~~已移除~~ |
| `/query-task-execution` | POST | CallStatusDrawer 初始加载 | CallStatusDrawer.tsx:239 | `task_id, page=1, page_size=20` |
| `/query-task-execution` | POST | 滚动加载更多 | CallStatusDrawer.tsx:239 | `task_id, page=N, page_size=20` |
| `/query-task-execution` | POST | 手动刷新 | CallStatusDrawer.tsx:533 | `task_id, page=1, page_size=20` |
| `/suspend-resume-task` | POST | 暂停/重启任务 | CallStatusDrawer.tsx:541 | `task_id, action` |
| `/query-task-execution` | POST | 暂停/重启失败后查询 | CallStatusDrawer.tsx:557 | `task_id, page=1, page_size=20` |

### 3.2 调用频率控制

| 场景 | 频率限制 | 实现方式 |
|-----|---------|---------|
| ~~MonitorDrawer 定时刷新~~ | ~~已移除~~ | ~~已移除~~ |
| ~~MonitorDrawer 单任务更新~~ | ~~已移除~~ | ~~已移除~~ |
| CallStatusDrawer 刷新 | 最小 3 秒 | `minFetchInterval = 3000` |
| CallStatusDrawer 手动刷新 | 防抖 500ms | `debounceTimerRef` |
| 防重复请求 | 请求锁 | `pendingFetchRef.current` |

### 3.3 缓存策略

| 缓存键格式 | 缓存时长 | 使用场景 |
|-----------|---------|---------|
| `task_execution_{taskId}_1_20` | 10 秒 | CallStatusDrawer 初始加载 |
| `task_execution_{taskId}_{page}_{pageSize}` | 10 秒 | 分页数据缓存 |

---

## 四、数据流转图

```
用户操作
   │
   ├─> 点击任务列表项
   │       │
   │       ├─> MonitorDrawer.handleTaskClick()
   │       │       │
   │       │       ├─> setSelectedTask(task)
   │       │       ├─> setShowCallStatus(true)
   │       │       └─> 更新 lastCheckRef[task.id]
   │       │
   │       └─> CallStatusDrawer 渲染
   │               │
   │               ├─> useEffect 监听 isOpen
   │               │       │
   │               │       └─> fetchCallStatus(false, true)
   │               │               │
   │               │               ├─> 检查缓存 (10秒)
   │               │               │       │
   │               │               │       ├─> 缓存有效 → 使用缓存数据
   │               │               │       └─> 缓存无效 → 调用接口
   │               │               │
   │               │               └─> POST /query-task-execution
   │               │                       │
   │               │                       └─> 处理响应数据
   │               │                               │
   │               │                               ├─> 更新 taskStatus
   │               │                               ├─> 更新 callJobs
   │               │                               └─> 设置分页信息
   │               │
   │               ├─> 滚动到底部
   │               │       │
   │               │       └─> loadMore()
   │               │               │
   │               │               └─> fetchCallStatus(true)
   │               │                       │
   │               │                       └─> POST /query-task-execution (page=N)
   │               │                               │
   │               │                               └─> 追加数据到 callJobs
   │               │
   │               ├─> 点击刷新按钮
   │               │       │
   │               │       └─> debouncedFetchCallStatus()
   │               │               │
   │               │               └─> fetchCallStatus() (延迟500ms)
   │               │
   │               └─> 点击暂停/重启
   │                       │
   │                       ├─> POST /suspend-resume-task
   │                       │       │
   │                       │       ├─> 成功 → fetchCallStatus() 刷新
   │                       │       └─> 失败 → POST /query-task-execution 查询状态
   │
     └─> MonitorDrawer 初始化
          │
          └─> 同步父组件传入的 callingTasks 数据
                  │
                  └─> 仅展示任务列表（不再主动请求接口）
```

---

## 五、关键优化点

### 5.1 性能优化

1. **缓存机制**: 10秒缓存减少重复请求
2. **防重复请求**: `pendingFetchRef` 防止并发请求
3. **时间间隔控制**: 最小3秒间隔防止频繁刷新
4. **防抖处理**: 手动刷新延迟500ms
5. **按需加载**: 移除了 MonitorDrawer 的自动轮询，只在用户点击任务时才查询，减少不必要的接口调用
6. **跳过录音**: CallStatusDrawer 中 `skip_recording=true` 加快响应

### 5.2 用户体验优化

1. **初始加载不防抖**: 打开抽屉时立即加载数据
2. **滚动加载**: 滚动到底部自动加载更多
3. **加载状态**: 区分初始加载和加载更多
4. **错误处理**: 失败时显示错误信息并重试
5. **状态同步**: 暂停/重启后自动刷新状态

---

## 六、注意事项

1. **taskId 类型转换**: `parseInt(taskId)` - 确保传递的是数字类型
2. **缓存键唯一性**: 使用 `taskId_page_pageSize` 组合确保唯一
3. **请求锁清理**: 组件卸载时清除 `pendingFetchRef`
4. **定时器清理**: useEffect 返回清理函数清除定时器
5. **状态更新**: 使用函数式更新避免闭包问题
6. **错误边界**: 所有接口调用都有 try-catch 处理

---

## 七、相关文件

- `dcc-digital-employee/src/components/MonitorDrawer.tsx`
- `dcc-digital-employee/src/components/CallStatusDrawer.tsx`
- `dcc-digital-employee/src/services/api.ts`
- `dcc-digital-employee/src/app/page.tsx`

---

---

## 八、重要变更记录

### v1.1 (最新)

**变更内容**:
- ❌ **移除**: MonitorDrawer 组件的自动轮询功能
- ❌ **移除**: 打开 MonitorDrawer 时的延迟查询（500ms）
- ❌ **移除**: 每 60 秒的定时任务状态刷新
- ✅ **优化**: 只在用户点击任务卡片时才查询接口，减少不必要的请求

**影响范围**:
- MonitorDrawer 组件不再主动请求 `/query-task-execution` 接口
- 任务状态数据完全依赖父组件传入的 `callingTasks` prop
- 所有数据查询由 CallStatusDrawer 组件负责

**代码变更**:
- 移除了 `checkTaskStatus` 函数和相关的 useEffect
- 移除了 `intervalRef`、`lastCheckRef`、`pendingRequestsRef` 等不再使用的 ref
- 移除了 `isLoading` 状态

---

**文档版本**: v1.1  
**最后更新**: 2024年
