'use client';

import React, { useState } from 'react';

interface Task {
  id: string;
  name: string;
  conditions: any[];
  targetCount: number;
  createdAt: string;
  status: 'pending' | 'script_configured' | 'completed';
  organization_id?: string;
  create_name?: string;
  script_id?: string;
  task_type?: number; // 1:已创建；2:开始外呼；3:外呼完成；4:跟进完成
  size_desc?: any;
}

interface TaskSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSelect: (task: Task) => void;
  tasks?: Task[];
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

export default function TaskSelectionDrawer({ isOpen, onClose, onTaskSelect, tasks = [] }: TaskSelectionDrawerProps) {
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
      case 5:
        return { text: '已暂停', color: 'bg-yellow-500/20 text-yellow-300' };
      default:
        return { text: '未知状态', color: 'bg-gray-500/20 text-gray-300' };
    }
  };

  // 过滤任务：只显示待生成话术的任务（task_type=1）
  const filteredTasks = tasks.filter(task => task.task_type === 1);

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
      const timeRanges: { [key: string]: { start?: string; end?: string; label: string; ranges?: string[] } } = {};
      
      Object.entries(sizeDesc).forEach(([key, value]) => {
        // 跳过null值
        if (value === null) {
          return;
        }
        
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
        } else if (key.includes('_ranges') && Array.isArray(value)) {
          // 处理时间区间范围数组
          const baseKey = key.replace(/_ranges$/, '');
          const timeRangeKey = baseKey;
          
          if (!timeRanges[timeRangeKey]) {
            timeRanges[timeRangeKey] = {
              label: filterConditionMap[timeRangeKey] || baseKey,
              ranges: []
            };
          }
          
          timeRanges[timeRangeKey].ranges = value;
        } else {
          // 非时间区间字段处理
          if (key === 'is_arrive') {
            const boolValue = value === '1' || value === 1 || value === true ? '是' : '否';
            formattedConditions.push(`${chineseKey}: ${boolValue}`);
          } else if (Array.isArray(value)) {
            // 处理数组类型的多选值
            if (value.length > 0) {
              formattedConditions.push(`${chineseKey}: ${value.join('、')}`);
            }
          } else {
            formattedConditions.push(`${chineseKey}: ${String(value)}`);
          }
        }
      });
      
      // 处理时间区间显示
      Object.values(timeRanges).forEach(range => {
        if (range.ranges && range.ranges.length > 0) {
          // 显示时间区间范围数组
          const rangeTexts = range.ranges.map(r => {
            const [start, end] = r.split('_');
            return `${start} 至 ${end}`;
          });
          formattedConditions.push(`${range.label}: ${rangeTexts.join('、')}`);
        } else if (range.start || range.end) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-7xl w-full mx-4 h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">话术生成Agent</h2>
              <p className="text-gray-300">选择已创建的任务，配置个性化话术</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const filterConditions = formatFilterConditions(task.conditions, task.size_desc);
              
              return (
                <div 
                  key={task.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => onTaskSelect(task)}
                >
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
                            <span key={`condition-${index}-${condition}`} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
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
                      <span className="text-green-400 font-bold">{task.targetCount}</span>
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      创建时间: {task.createdAt}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">暂无已创建的任务</p>
              <p className="text-gray-400 text-sm">请先使用"任务Agent"创建任务</p>
            </div>
          )}
        </div>
        
        <div className="p-6 pt-0 border-t border-white/10">
          <div className="flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 