# 组件文档

本文档描述了 `src/components` 目录下各个组件的功能和对应的界面。

## 主要组件

### 1. Header.tsx
**功能**: 页面顶部导航栏组件
**对应界面**: 所有页面的顶部导航栏
**功能说明**: 
- 显示DCC数字员工logo和标题
- 用户信息下拉菜单
- 解绑DCC账号功能
- 退出登录功能

### 2. TaskCreationDrawer.tsx
**功能**: 任务创建侧拉抽屉
**对应界面**: 任务Agent卡片点击后的任务创建界面
**功能说明**:
- 创建新的外呼任务
- 设置任务名称、目标客户数量
- 选择场景和筛选条件
- 配置话术模板

### 3. TaskSelectionDrawer.tsx
**功能**: 任务选择侧拉抽屉
**对应界面**: 话术生成Agent卡片点击后的任务选择界面
**功能说明**:
- 显示待生成话术的任务列表
- 选择特定任务进行话术生成

### 4. TaskDetailDrawer.tsx
**功能**: 任务详情侧拉抽屉
**对应界面**: 任务选择后的任务详情查看界面
**功能说明**:
- 显示选中任务的详细信息
- 配置话术生成参数
- 开始外呼功能

### 5. ScriptGenerationDrawer.tsx
**功能**: 话术生成侧拉抽屉
**对应界面**: 话术生成配置界面
**功能说明**:
- 配置话术生成参数
- 选择话术模板
- 生成个性化话术

### 6. MonitorDrawer.tsx
**功能**: 外呼监控侧拉抽屉
**对应界面**: 外呼Agent卡片点击后的监控界面
**功能说明**:
- 实时监控外呼任务进度
- 显示外呼状态和统计信息
- 查看通话记录

### 7. FollowupModal.tsx
**功能**: 跟进记录弹窗
**对应界面**: 跟进记录Agent卡片点击后的跟进记录查看界面
**功能说明**:
- 显示选定任务的跟进记录
- 查看通话结果和客户反馈
- 导出跟进报告

### 8. TaskLeadsDrawer.tsx
**功能**: 任务线索侧拉抽屉
**对应界面**: 任务详情中的客户线索查看界面
**功能说明**:
- 显示任务关联的客户线索
- 查看客户信息和通话状态
- 刷新任务详情

### 9. TaskListDrawer.tsx
**功能**: 任务列表侧拉抽屉
**对应界面**: 任务管理界面
**功能说明**:
- 显示所有任务的列表
- 查看任务状态和进度
- 管理任务生命周期

### 10. TaskSelectionModal.tsx
**功能**: 任务选择模态框
**对应界面**: 跟进记录Agent的任务选择界面
**功能说明**:
- 模态框形式显示任务列表
- 选择要查看跟进记录的任务

### 11. DccBindModal.tsx
**功能**: DCC账号绑定弹窗
**对应界面**: 首次使用时的DCC账号绑定界面
**功能说明**:
- 绑定DCC账号
- 验证账号有效性
- 设置绑定状态

### 12. CallRecordDrawer.tsx
**功能**: 通话记录侧拉抽屉
**对应界面**: 通话记录查看界面
**功能说明**:
- 显示通话记录列表
- 查看通话详情和结果
- 导出通话记录

### 13. UnbindConfirmModal.tsx
**功能**: 解绑确认弹窗
**对应界面**: 用户解绑DCC账号时的确认界面
**功能说明**:
- 确认解绑操作
- 显示解绑后果提示

## 辅助组件

### 14. CallStatusDrawer.tsx
**功能**: 通话状态侧拉抽屉
**对应界面**: MonitorDrawer内部的通话状态查看界面
**功能说明**:
- 显示特定任务的通话状态
- 实时更新通话进度
- 查看通话统计

### 15. SceneSelectionDrawer.tsx
**功能**: 场景选择侧拉抽屉
**对应界面**: TaskCreationDrawer内部的场景选择界面
**功能说明**:
- 选择外呼场景
- 配置场景参数
- 设置筛选条件

## Workflow组件

### 16. workflow/WorkflowSteps.tsx
**功能**: 工作流步骤组件
**对应界面**: 手动分析页面的步骤导航
**功能说明**:
- 显示工作流步骤
- 步骤状态指示
- 步骤切换功能

### 17. workflow/ContentArea.tsx
**功能**: 工作流内容区域
**对应界面**: 手动分析页面的主要内容区域
**功能说明**:
- 显示当前步骤的内容
- 处理用户交互
- 数据展示和操作

### 18. workflow/ConfirmModal.tsx
**功能**: 工作流确认弹窗
**对应界面**: 手动分析页面的确认操作界面
**功能说明**:
- 确认重要操作
- 显示操作后果
- 用户确认流程

### 19. workflow/utils.ts
**功能**: 工作流工具函数
**对应界面**: 手动分析页面的工具函数
**功能说明**:
- 工作流状态管理
- 数据计算和处理
- 工具函数集合

## 已删除的无用组件

以下组件在当前四个Agent卡片功能下未被使用，已被删除：

### 20. ConfigModal.tsx (已删除)
**原功能**: 配置模态框
**删除原因**: 仅在手动分析页面使用，与四个Agent卡片功能无关

### 21. QualityDrawer.tsx (已删除)
**原功能**: 质量评估侧拉抽屉
**删除原因**: 在当前四个Agent卡片功能中未被使用

### 22. ReportDrawer.tsx (已删除)
**原功能**: 报告侧拉抽屉
**删除原因**: 在当前四个Agent卡片功能中未被使用

## 组件使用关系

### 四个Agent卡片对应的组件：

1. **任务Agent** → TaskCreationDrawer
2. **话术生成Agent** → TaskSelectionDrawer → TaskDetailDrawer → ScriptGenerationDrawer
3. **外呼Agent** → MonitorDrawer → CallStatusDrawer
4. **跟进记录Agent** → TaskSelectionModal → FollowupModal

### 通用组件：
- Header: 所有页面
- DccBindModal: 首次使用
- UnbindConfirmModal: 用户解绑
- CallRecordDrawer: 通话记录查看
- TaskListDrawer: 任务管理
- TaskLeadsDrawer: 任务线索查看

### 辅助组件：
- SceneSelectionDrawer: 被TaskCreationDrawer使用
- CallStatusDrawer: 被MonitorDrawer使用
- workflow/*: 仅用于手动分析页面 