'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CallStatusDrawer from './CallStatusDrawer';
import { tasksAPI } from '../services/api';

interface CallingTask {
  id: string;
  name: string;
  targetCount: number;
  createdAt: string;
  status: string;
  task_type?: number;
  total_jobs?: number;
  updated_count?: number;
  error_count?: number;
}

interface MonitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  callingTasks: CallingTask[];
  onTasksUpdate?: (tasks: CallingTask[]) => void;
  onRefreshTaskDetails?: (taskId: string) => void; // 添加刷新任务详情的回调
}

export default function MonitorDrawer({ isOpen, onClose, callingTasks, onTasksUpdate, onRefreshTaskDetails }: MonitorDrawerProps) {
  const [showCallStatus, setShowCallStatus] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CallingTask | null>(null);
  const [tasks, setTasks] = useState<CallingTask[]>(callingTasks);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<{ [key: string]: number }>({});

  // 当callingTasks更新时，同步更新本地状态
  useEffect(() => {
    setTasks(callingTasks);
  }, [callingTasks]);

  // 定期检查任务状态 - 优化版本
  useEffect(() => {
    if (!isOpen) {
      // 关闭抽屉时清除定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkTaskStatus = async () => {
      // 防止重复调用
      if (isLoading) return;
      
      setIsLoading(true);
      try {
        const currentTime = Date.now();
        const updatedTasks = await Promise.all(
          tasks.map(async (task) => {
            // 检查是否需要更新（每个任务至少间隔60秒才更新一次）
            const lastCheck = lastCheckRef.current[task.id] || 0;
            if (currentTime - lastCheck < 60000) {
              return task; // 跳过更新
            }

            try {
              const response = await tasksAPI.queryTaskExecution(parseInt(task.id));
              if (response.status === 'success') {
                const taskData = response.data;
                // 更新最后检查时间
                lastCheckRef.current[task.id] = currentTime;
                
                // 根据jobs_data中的Status字段判断任务状态
                const jobsData = taskData.jobs_data || [];
                const succeededJobs = jobsData.filter((job: any) => job.Status === "Succeeded").length;
                const schedulingJobs = jobsData.filter((job: any) => job.Status === "Scheduling").length;
                const totalJobs = jobsData.length;
                
                // 如果所有任务都是Succeeded状态，则认为任务完成
                const isCompleted = totalJobs > 0 && succeededJobs === totalJobs;
                const hasError = taskData.error_count > 0;
                
                console.log(`任务 ${task.id} 状态计算:`, {
                  totalJobs,
                  succeededJobs,
                  schedulingJobs,
                  isCompleted,
                  originalTaskType: taskData.task_type
                });
                
                // 使用API返回的task_type，如果没有则根据完成状态推断
                const newTaskType = taskData.task_type || (isCompleted ? 3 : 2);
                
                return {
                  ...task,
                  status: isCompleted ? 'completed' : (newTaskType === 1 ? 'pending' : 'calling'),
                  task_type: newTaskType,
                  total_jobs: totalJobs,
                  updated_count: succeededJobs,
                  error_count: taskData.error_count,
                  // 确保保持其他重要字段
                  targetCount: task.targetCount,
                  name: task.name,
                  createdAt: task.createdAt
                };
              }
            } catch (error) {
              console.error(`查询任务 ${task.id} 执行情况失败:`, error);
              // 在API调用失败时，保持原有状态
              return task;
            }
          })
        );
        
        // 只有当有实际更新时才设置状态
        const hasChanges = updatedTasks.some((task, index) => {
          const currentTask = tasks[index];
          if (!task || !currentTask) return false;
          const changed = task.task_type !== currentTask.task_type || 
                 task.status !== currentTask.status;
          if (changed) {
            console.log('DEBUG - Task changed:', currentTask.id, 'from', currentTask.task_type, 'to', task.task_type);
          }
          return changed;
        });
        
        if (hasChanges) {
          const validTasks = updatedTasks.filter((task): task is CallingTask => task !== undefined);
          console.log('DEBUG - Task status updated:', validTasks.length, 'tasks');
          setTasks(validTasks);
          // 通知父组件任务状态已更新
          if (onTasksUpdate) {
            onTasksUpdate(validTasks);
          }
        }
      } catch (error) {
        console.error('批量检查任务状态失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // 立即检查一次
    checkTaskStatus();

    // 每60秒检查一次任务状态（减少间隔以提高响应性）
    intervalRef.current = setInterval(checkTaskStatus, 60000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, tasks, isLoading, onTasksUpdate]);

  const handleTaskClick = useCallback(async (task: CallingTask) => {
    try {
      // 先请求最新数据
      const executionResponse = await tasksAPI.queryTaskExecution(parseInt(task.id));
      if (executionResponse.status === 'success') {
        const taskData = executionResponse.data;
        console.log('任务执行情况:', taskData);
        
        // 根据jobs_data中的Status字段判断任务状态
        const jobsData = taskData.jobs_data || [];
        const succeededJobs = jobsData.filter((job: any) => job.Status === "Succeeded").length;
        const schedulingJobs = jobsData.filter((job: any) => job.Status === "Scheduling").length;
        const totalJobs = jobsData.length;
        
        // 如果所有任务都是Succeeded状态，则认为任务完成
        const isCompleted = totalJobs > 0 && succeededJobs === totalJobs;
        
        console.log(`点击任务 ${task.id} 状态计算:`, {
          totalJobs,
          succeededJobs,
          schedulingJobs,
          isCompleted,
          originalTaskType: taskData.task_type
        });
        // 使用API返回的task_type，如果没有则根据完成状态推断
        const newTaskType = taskData.task_type || (isCompleted ? 3 : 2);
        const updatedTask = {
          ...task,
          status: isCompleted ? 'completed' : 'calling',
          task_type: newTaskType,
          total_jobs: totalJobs,
          updated_count: succeededJobs,
          error_count: taskData.error_count
        };
        
        // 更新本地任务状态
        setTasks(prevTasks => 
          prevTasks.map(t => t.id === task.id ? updatedTask : t)
        );
        
        // 通知父组件任务状态已更新
        if (onTasksUpdate) {
          const updatedTasks = tasks.map(t => t.id === task.id ? updatedTask : t);
          onTasksUpdate(updatedTasks);
        }
        
        // 使用更新后的任务数据
        setSelectedTask(updatedTask);
      } else {
        // 如果请求失败，使用原始任务数据
        setSelectedTask(task);
      }
      
      setShowCallStatus(true);
    } catch (error) {
      console.error('查询任务执行情况失败:', error);
      // 即使查询失败，也继续显示任务详情
      setSelectedTask(task);
      setShowCallStatus(true);
    }
  }, [tasks, onTasksUpdate]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 刷新任务详情数据
  const handleRefreshTaskDetails = useCallback(async () => {
    if (!selectedTask) return;
    
    try {
      // 重新获取任务详情，包括 leads_task_list 数据
      const response = await tasksAPI.getCallTaskDetails(selectedTask.id);
      if (response.status === 'success') {
        console.log('任务详情已刷新:', response.data);
        // 调用父组件的回调函数，通知刷新任务详情
        onRefreshTaskDetails?.(selectedTask.id);
      }
    } catch (error) {
      console.error('刷新任务详情失败:', error);
    }
  }, [selectedTask, onRefreshTaskDetails]);

  // 暂停/重启任务处理函数
  const handleSuspendResumeTask = useCallback(async (task: CallingTask, action: 'suspend' | 'resume') => {
    try {
      const response = await tasksAPI.suspendResumeTask(parseInt(task.id), action);
      if (response.status === 'success') {
        console.log(`${action === 'suspend' ? '暂停' : '重启'}任务成功:`, response.data);
        
        // 更新本地任务状态
        const updatedTask = {
          ...task,
          task_type: response.data.task_type
        };
        
        setTasks(prevTasks => 
          prevTasks.map(t => t.id === task.id ? updatedTask : t)
        );
        
        // 通知父组件任务状态已更新
        if (onTasksUpdate) {
          const updatedTasks = tasks.map(t => t.id === task.id ? updatedTask : t);
          onTasksUpdate(updatedTasks);
        }
      } else {
        console.error(`${action === 'suspend' ? '暂停' : '重启'}任务失败:`, response.message);
        
        // 操作失败时，立即查询任务最新状态
        try {
          const executionResponse = await tasksAPI.queryTaskExecution(parseInt(task.id));
          if (executionResponse.status === 'success') {
            const taskData = executionResponse.data;
            console.log('操作失败后查询任务状态:', taskData);
            
            // 如果任务状态不是2或5，则关闭弹窗
            if (taskData.task_type !== 2 && taskData.task_type !== 5) {
              console.log('任务状态已变化，关闭弹窗');
              onClose();
              return;
            }
          }
        } catch (queryError) {
          console.error('查询任务状态失败:', queryError);
        }
      }
    } catch (error) {
      console.error(`${action === 'suspend' ? '暂停' : '重启'}任务失败:`, error);
      
      // 操作失败时，立即查询任务最新状态
      try {
        const executionResponse = await tasksAPI.queryTaskExecution(parseInt(task.id));
        if (executionResponse.status === 'success') {
          const taskData = executionResponse.data;
          console.log('操作失败后查询任务状态:', taskData);
          
          // 如果任务状态不是2或5，则关闭弹窗
          if (taskData.task_type !== 2 && taskData.task_type !== 5) {
            console.log('任务状态已变化，关闭弹窗');
            onClose();
            return;
          }
        }
      } catch (queryError) {
        console.error('查询任务状态失败:', queryError);
      }
    }
  }, [tasks, onTasksUpdate, onClose]);

  // 使用useMemo优化计算，减少重复渲染
  const displayTasks = useMemo(() => {
    // 显示 task_type = 2、3 或 5 的任务
    const filtered = tasks.filter(task => task.task_type === 2 || task.task_type === 3 || task.task_type === 5);
    console.log('DEBUG - displayTasks:', filtered.length, 'from total tasks:', tasks.length);
    return filtered;
  }, [tasks]);
  
  // 统计数据基于所有任务计算
  const executingTasks = useMemo(() => {
    const count = tasks.filter(task => task.task_type === 2).length;
    console.log('DEBUG - executingTasks:', count, 'tasks:', tasks);
    return count;
  }, [tasks]);
  const completedTasks = useMemo(() => {
    const count = tasks.filter(task => task.task_type === 3).length;
    console.log('DEBUG - completedTasks:', count);
    return count;
  }, [tasks]);
  const totalLeads = useMemo(() => {
    const sum = tasks.reduce((sum, task) => sum + (task.targetCount || 0), 0);
    console.log('DEBUG - totalLeads:', sum, 'tasks with targetCount:', tasks.map(t => ({ id: t.id, targetCount: t.targetCount })));
    return sum;
  }, [tasks]);
  
  // 修复任务进度计算逻辑
  const taskProgress = useMemo(() => {
    const totalTasks = executingTasks + completedTasks;
    if (totalTasks === 0) return 0;
    return Math.round((completedTasks / totalTasks) * 100);
  }, [executingTasks, completedTasks]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[70] pt-4" 
        onClick={handleClose}
      >
        <div 
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 h-[80vh] flex flex-col" 
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部区域 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">外呼Agent监控</h2>
              <p className="text-gray-300">实时监控外呼Agent的工作状态和任务执行情况</p>
            </div>
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 可滚动内容区域 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6">
              {/* 外呼Agent状态 */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-400 rounded-full mr-3"></div>
                    <h3 className="text-lg font-semibold text-white">外呼Agent状态</h3>
                  </div>
                  <span className="text-blue-300 text-sm font-medium">
                    {executingTasks > 0 ? '工作中' : '空闲中'}
                  </span>
                </div>
                
                {/* 总体进度 */}
                {executingTasks > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-300">总体进度</span>
                      <span className="text-blue-300 font-medium">{taskProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${taskProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* 统计信息 */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-400 font-bold text-lg">
                      {executingTasks}
                    </div>
                    <div className="text-gray-400 text-xs">执行中任务</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-green-400 font-bold text-lg">
                      {completedTasks}
                    </div>
                    <div className="text-gray-400 text-xs">已完成任务</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-purple-400 font-bold text-lg">
                      {totalLeads}
                    </div>
                    <div className="text-gray-400 text-xs">总线索数</div>
                  </div>
                </div>
              </div>

              {/* 任务列表 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">任务列表</h3>
                
                {displayTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">暂无外呼任务</h3>
                    <p className="text-gray-400">
                      {tasks.length === 0 ? '当前没有任务' : '当前没有执行中或已完成的外呼任务'}
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                      调试信息: 总任务数 {tasks.length}, 显示任务数 {displayTasks.length}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                            <h4 className="text-white font-medium">{task.name}</h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            {task.task_type === 3 ? (
                              <>
                                <span className="text-green-300 text-sm font-medium">已完成</span>
                                <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              </>
                            ) : task.task_type === 2 ? (
                              <>
                                <span className="text-blue-300 text-sm font-medium">执行中</span>
                                <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                              </>
                            ) : task.task_type === 5 ? (
                              <>
                                <span className="text-yellow-300 text-sm font-medium">已暂停</span>
                                <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </>
                            ) : task.task_type === 1 ? (
                              <>
                                <span className="text-gray-300 text-sm font-medium">已创建</span>
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </>
                            ) : (
                              <>
                                <span className="text-red-300 text-sm font-medium">未知状态</span>
                                <svg className="w-4 h-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">目标线索:</span>
                            <span className="text-white ml-2 font-medium">{task.targetCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">创建时间:</span>
                            <span className="text-white ml-2">{task.createdAt}</span>
                          </div>
                        </div>
                        
                        {/* 任务统计信息 */}
                        {task.total_jobs !== undefined && (
                          <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                            <div>
                              <span className="text-gray-400">总任务:</span>
                              <span className="text-white ml-2">{task.total_jobs}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">已完成:</span>
                              <span className="text-green-300 ml-2">{task.updated_count || 0}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">进行中:</span>
                              <span className="text-blue-300 ml-2">{task.total_jobs - (task.updated_count || 0)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">错误数:</span>
                              <span className={`ml-2 ${task.error_count && task.error_count > 0 ? 'text-red-300' : 'text-gray-300'}`}>
                                {task.error_count || 0}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* 任务进度 */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">任务进度</span>
                            <span className="text-blue-300">
                              {task.task_type === 3 ? '100%' : 
                               task.task_type === 2 && task.total_jobs && task.updated_count !== undefined ? 
                               `${Math.round((task.updated_count / task.total_jobs) * 100)}%` : 
                               task.task_type === 2 ? '进行中' : '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                task.task_type === 3 ? 'bg-green-500' : 
                                task.task_type === 2 ? 'bg-blue-500' : 'bg-gray-500'
                              }`}
                              style={{ 
                                width: task.task_type === 3 ? '100%' : 
                                       task.task_type === 2 && task.total_jobs && task.updated_count !== undefined ? 
                                       `${Math.round((task.updated_count / task.total_jobs) * 100)}%` : 
                                       task.task_type === 2 ? '50%' : '0%' 
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-blue-400">
                            点击查看电话拨打情况
                          </div>
                          <div className="flex space-x-2">
                            {task.task_type === 2 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSuspendResumeTask(task, 'suspend');
                                }}
                                className="px-3 py-1 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded text-xs transition-colors"
                              >
                                暂停
                              </button>
                            )}
                            {task.task_type === 5 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSuspendResumeTask(task, 'resume');
                                }}
                                className="px-3 py-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded text-xs transition-colors"
                              >
                                重启
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 底部按钮区域 */}
          <div className="p-6 border-t border-white/10 flex-shrink-0">
            <div className="flex justify-end space-x-3">
              <button 
                onClick={handleClose} 
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 电话拨打情况抽屉 */}
      {selectedTask && (
        <CallStatusDrawer
          isOpen={showCallStatus}
          onClose={() => {
            setShowCallStatus(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.id}
          taskName={selectedTask.name}
          onRefresh={handleRefreshTaskDetails}
          taskType={selectedTask.task_type}
          onTaskTypeChange={(newTaskType) => {
            // 更新选中的任务状态
            const updatedTask = { ...selectedTask, task_type: newTaskType };
            setSelectedTask(updatedTask);
            
            // 更新本地任务列表
            setTasks(prevTasks => 
              prevTasks.map(t => t.id === selectedTask.id ? updatedTask : t)
            );
            
            // 通知父组件任务状态已更新
            if (onTasksUpdate) {
              const updatedTasks = tasks.map(t => t.id === selectedTask.id ? updatedTask : t);
              onTasksUpdate(updatedTasks);
            }
          }}
        />
      )}
    </>
  );
} 