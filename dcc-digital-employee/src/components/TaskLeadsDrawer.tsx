'use client';

import React from 'react';

interface TaskLead {
  id: number;
  task_id: number;
  leads_id: string;
  leads_name: string;
  leads_phone: string;
  call_type: number;
  call_time: string;
  call_job_id: string;
  call_id: string;
  call_user_id: string;
  call_conversation?: any;
}

interface TaskInfo {
  id: number;
  task_name: string;
  organization_id: string;
  create_name_id: string;
  create_name: string;
  create_time: string;
  leads_count: number;
  script_id?: string;
  task_type: number;
  size_desc?: any;
}

interface TaskLeadsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskInfo?: TaskInfo;
  taskLeads?: TaskLead[];
  onRefresh?: () => void; // 添加刷新回调函数
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

export default function TaskLeadsDrawer({ isOpen, onClose, taskInfo, taskLeads = [], onRefresh }: TaskLeadsDrawerProps) {
  // 格式化筛选条件显示
  const formatFilterConditions = (sizeDesc: any) => {
    if (!sizeDesc) return [];
    
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
  };

  if (!isOpen) return null;

  const filterConditions = taskInfo?.size_desc ? formatFilterConditions(taskInfo.size_desc) : [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-6xl w-full mx-4 h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">任务线索详情</h2>
              {taskInfo && (
                <div className="text-gray-300 space-y-1">
                  <p>任务名称: {taskInfo.task_name}</p>
                  <p>线索数量: {taskInfo.leads_count}</p>
                  {filterConditions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">筛选条件:</p>
                      <div className="flex flex-wrap gap-1">
                        {filterConditions.map((condition, index) => (
                          <span key={`condition-${index}-${condition}`} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {onRefresh && (
                <button 
                  onClick={onRefresh}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                >
                  刷新数据
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 线索列表 */}
          {taskLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">暂无线索</h3>
              <p className="text-gray-400">该任务下没有找到线索信息</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 线索列表标题 */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">筛选后的线索列表</h3>
                <span className="text-gray-300 text-sm">共 {taskLeads.length} 条线索</span>
              </div>

              {/* 线索表格 */}
              <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          序号
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          姓名
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          手机号
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          线索ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {taskLeads.map((lead, index) => (
                        <tr key={lead.id || `lead-${index}`} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-white font-medium">
                            {lead.leads_name || '未知'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {lead.leads_phone || '未知'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {lead.leads_id}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              lead.call_type === 0 
                                ? 'bg-gray-500/20 text-gray-300' 
                                : lead.call_type === 1 
                                ? 'bg-green-500/20 text-green-300'
                                : lead.call_type === 2 
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {lead.call_type === 0 ? '未开始' : 
                               lead.call_type === 1 ? '已接通' : 
                               lead.call_type === 2 ? '未接通' : '未知'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 