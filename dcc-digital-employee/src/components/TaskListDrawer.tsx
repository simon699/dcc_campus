'use client';

import React, { useState } from 'react';
import TaskCreationDrawer from './TaskCreationDrawer';
import { tasksAPI } from '../services/api';

interface Task {
  id: string;
  name: string;
  createdAt: string;
  conditions: any[];
  filteredCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  organization_id?: string;
  create_name?: string;
  scene_id?: string;
  task_type?: number; // 1:已创建；2:开始外呼；3:外呼完成；4:已删除
  size_desc?: any;
}

interface TaskListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks?: Task[];
  onViewTaskDetails?: (taskDetails: any) => void;
}

// 筛选条件英文到中文的映射
const filterConditionMap: { [key: string]: string } = {
  'leads_product': '线索产品',
  'leads_type': '线索等级',
  'first_follow': '首次跟进时间区间',
  'latest_follow': '最近跟进时间区间',
  'next_follow': '下次跟进时间区间',
  'first_arrive': '首次到店时间区间',
  'is_arrive': '是否到店',
};

export default function TaskListDrawer({ isOpen, onClose, tasks = [], onViewTaskDetails }: TaskListDrawerProps) {
  const [showTaskCreation, setShowTaskCreation] = useState(false);
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [loading, setLoading] = useState(false);

  // 根据task_type获取状态信息
  const getTaskStatusInfo = (taskType?: number) => {
    switch (taskType) {
      case 1:
        return { text: '已创建', color: 'bg-blue-500/20 text-blue-300' };
      case 2:
        return { text: '开始外呼', color: 'bg-green-500/20 text-green-300' };
      case 3:
        return { text: '外呼完成', color: 'bg-purple-500/20 text-purple-300' };
      case 4:
        return { text: '已删除', color: 'bg-red-500/20 text-red-300' };
      default:
        return { text: '未知状态', color: 'bg-gray-500/20 text-gray-300' };
    }
  };

  // 转换筛选条件为中文显示
  const formatFilterConditions = (conditions: any[] | undefined, sizeDesc: any) => {
    if (conditions && conditions.length > 0) {
      return conditions.map((condition, index) => {
        if (typeof condition === 'string') {
          return condition;
        }
        const label = condition.label || condition.key || '';
        const value = condition.value || condition.val || '';
        const chineseLabel = filterConditionMap[label] || label;
        return `${chineseLabel}: ${value}`;
      });
    } else if (sizeDesc) {
      const formattedConditions: string[] = [];
      
      // 处理时间区间字段
      const timeRanges: { [key: string]: { start?: string; end?: string; label: string } } = {};
      
      Object.entries(sizeDesc).forEach(([key, value]) => {
        const chineseKey = filterConditionMap[key] || key;
        
        // 处理时间区间字段
        if (key.includes('_start') || key.includes('_end')) {
          const baseKey = key.replace(/_start$|_end$/, '');
          const timeRangeKey = baseKey;
          
          if (!timeRanges[timeRangeKey]) {
            timeRanges[timeRangeKey] = {
              label: filterConditionMap[timeRangeKey] || baseKey,
              start: undefined,
              end: undefined
            };
          }
          
          if (key.endsWith('_start')) {
            timeRanges[timeRangeKey].start = String(value);
          } else if (key.endsWith('_end')) {
            timeRanges[timeRangeKey].end = String(value);
          }
        } else {
          // 非时间区间字段直接显示
          if (key === 'is_arrive') {
            const boolValue = value === '1' || value === 1 || value === true ? '是' : '否';
            formattedConditions.push(`${chineseKey}: ${boolValue}`);
          } else {
            formattedConditions.push(`${chineseKey}: ${String(value)}`);
          }
        }
      });
      
      // 处理时间区间显示
      Object.values(timeRanges).forEach(range => {
        if (range.start || range.end) {
          if (range.start && range.end) {
            formattedConditions.push(`${range.label}: ${range.start} 至 ${range.end}`);
          } else if (range.start) {
            formattedConditions.push(`${range.label}: ${range.start} 起`);
          } else if (range.end) {
            formattedConditions.push(`${range.label}: 至 ${range.end}`);
          }
        }
      });
      
      return formattedConditions;
    }
    return [];
  };

  // 当外部tasks更新时，同步到本地状态
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // 处理查看详情
  const handleViewDetails = async (taskId: string) => {
    try {
      setLoading(true);
      const response = await tasksAPI.getCallTaskDetails(taskId);
      if (response.status === 'success' && response.data) {
        onViewTaskDetails?.(response.data);
      } else {
        alert('获取任务详情失败：' + (response.message || '未知错误'));
      }
    } catch (error) {
      console.error('获取任务详情失败:', error);
      alert('获取任务详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-7xl w-full mx-4 h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 overflow-y-auto p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">任务Agent</h2>
                <p className="text-gray-300">管理和查看已创建的任务</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 创建任务按钮 */}
            <div className="mb-6">
              <button
                onClick={() => setShowTaskCreation(true)}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  创建新任务
                </div>
              </button>
            </div>

            {/* 任务列表 */}
            {localTasks.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">暂无任务</h3>
                <p className="text-gray-400">点击上方按钮创建您的第一个任务</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localTasks.map((task) => {
                  const filterConditions = formatFilterConditions(task.conditions, task.size_desc);
                  
                  return (
                    <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-medium">{task.name}</h3>
                        <div className={`px-2 py-1 rounded-full text-xs ${getTaskStatusInfo(task.task_type).color}`}>
                          {getTaskStatusInfo(task.task_type).text}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm text-gray-300">
                          <span className="font-medium">筛选条件:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {filterConditions.length > 0 ? (
                              filterConditions.map((condition, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                  {condition}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-xs">无筛选条件</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">目标线索:</span>
                          <span className="text-green-400 font-bold">{task.filteredCount}</span>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                          创建时间: {task.createdAt}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex space-x-2 mt-3">
                        <button 
                          onClick={() => handleViewDetails(task.id)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                        >
                          {loading ? '加载中...' : '查看详情'}
                        </button>
                        <button className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors">
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务创建抽屉 */}
      <TaskCreationDrawer
        isOpen={showTaskCreation}
        onClose={() => setShowTaskCreation(false)}
        onTaskCreated={(taskData: any) => {
          // 创建新任务对象，使用API返回的数据
          const newTask: Task = {
            id: taskData.id?.toString() || `task-${Date.now()}`,
            name: taskData.name,
            createdAt: new Date().toLocaleString(),
            conditions: taskData.conditions || [],
            filteredCount: taskData.filteredCount || 0,
            status: 'pending'
          };
          
          // 添加到本地任务列表
          setLocalTasks(prev => [newTask, ...prev]);
          
          // 关闭任务创建抽屉
          setShowTaskCreation(false);
          
          console.log('任务创建完成:', taskData);
          
          // 显示成功提示
          alert(`任务创建成功！\n任务ID: ${taskData.id}\n任务名称: ${taskData.name}\n线索数量: ${taskData.filteredCount}`);
        }}
      />
    </>
  );
} 