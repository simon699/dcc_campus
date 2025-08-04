'use client';

import { useState, useEffect } from 'react';
import { tasksAPI } from '../services/api';

interface FollowupRecord {
  id: string;
  leadName: string;
  phone: string;
  followupTime: string;
  followupType: 'call' | 'message' | 'visit';
  status: 'success' | 'pending' | 'failed';
  content: string;
  nextFollowup?: string;
  notes?: string;
}

interface TaskInfo {
  id: number;
  task_name: string;
  task_type: number;
  create_time: string;
  leads_count: number;
  is_completed: boolean;
}

interface CallStatistics {
  total_calls: number;
  connected_calls: number;
  failed_calls: number;
  busy_calls: number;
  no_answer_calls: number;
  success_rate: number;
}

interface TaskCompletionStatus {
  total_leads: number;
  connected_leads: number;
  completion_rate: number;
  is_completed: boolean;
}

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTaskId?: number;
}

export default function FollowupModal({ 
  isOpen, 
  onClose, 
  selectedTaskId
}: FollowupModalProps) {
  const [followupRecords, setFollowupRecords] = useState<FollowupRecord[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [callStatistics, setCallStatistics] = useState<CallStatistics | null>(null);
  const [taskCompletion, setTaskCompletion] = useState<TaskCompletionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');

  // 当弹窗打开且有选中的任务时，获取任务跟进记录
  useEffect(() => {
    if (isOpen && selectedTaskId) {
      fetchTaskFollowupRecords();
    }
  }, [isOpen, selectedTaskId]);

  const fetchTaskFollowupRecords = async () => {
    if (!selectedTaskId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await tasksAPI.getTaskFollowupRecords(selectedTaskId);
      
      if (response.status === 'success') {
        const data = response.data;
        setTaskInfo(data.task_info);
        setCallStatistics(data.call_statistics);
        setFollowupRecords(data.followup_records || []);
        
        // 计算任务完成状态
        if (data.call_statistics) {
          const completion: TaskCompletionStatus = {
            total_leads: data.task_info.leads_count,
            connected_leads: data.call_statistics.connected_calls,
            completion_rate: Math.round((data.call_statistics.connected_calls / data.task_info.leads_count) * 100),
            is_completed: data.call_statistics.connected_calls === data.task_info.leads_count
          };
          setTaskCompletion(completion);
        }
      } else {
        setError(response.message || '获取任务跟进记录失败');
      }
    } catch (error) {
      console.error('获取任务跟进记录失败:', error);
      setError('获取任务跟进记录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getFollowupTypeColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'text-blue-400 bg-blue-500/20';
      case 'message':
        return 'text-green-400 bg-green-500/20';
      case 'visit':
        return 'text-purple-400 bg-purple-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getFollowupTypeText = (type: string) => {
    switch (type) {
      case 'call':
        return '电话跟进';
      case 'message':
        return '消息跟进';
      case 'visit':
        return '上门拜访';
      default:
        return '未知类型';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-500/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '跟进成功';
      case 'pending':
        return '跟进中';
      case 'failed':
        return '跟进失败';
      default:
        return '未知状态';
    }
  };

  const getTaskStatusText = (taskType: number, isCompleted: boolean) => {
    if (isCompleted) return '已完成';
    switch (taskType) {
      case 1:
        return '已创建';
      case 2:
        return '开始外呼';
      case 3:
        return '外呼完成';
      case 4:
        return '已删除';
      default:
        return '未知状态';
    }
  };

  const getTaskStatusColor = (taskType: number, isCompleted: boolean) => {
    if (isCompleted) return 'text-green-400 bg-green-500/20';
    switch (taskType) {
      case 1:
        return 'text-blue-400 bg-blue-500/20';
      case 2:
        return 'text-yellow-400 bg-yellow-500/20';
      case 3:
        return 'text-green-400 bg-green-500/20';
      case 4:
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-white">跟进记录Agent</h2>
              <p className="text-gray-400 text-sm mt-1">任务跟进记录和完成情况</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 弹窗内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 加载状态 */}
            {loading && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <span className="text-blue-400 ml-2">正在加载任务信息...</span>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* 任务信息 */}
            {taskInfo && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{taskInfo.task_name}</h3>
                    <p className="text-gray-400 text-sm">创建时间：{taskInfo.create_time}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* 外呼状态指示器 */}
                    {taskInfo.task_type === 2 && (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-blue-400 text-sm">外呼进行中</span>
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded text-sm ${getTaskStatusColor(taskInfo.task_type, taskInfo.is_completed)}`}>
                      {getTaskStatusText(taskInfo.task_type, taskInfo.is_completed)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">线索数量：</span>
                    <span className="text-white">{taskInfo.leads_count}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">任务状态：</span>
                    <span className="text-white">{taskInfo.is_completed ? '已完成' : '进行中'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">外呼状态：</span>
                    <span className={taskInfo.task_type === 2 ? 'text-blue-400' : 'text-green-400'}>
                      {taskInfo.task_type === 2 ? '进行中' : '已完成'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 标签页切换 */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'overview'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  任务概览
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'records'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  跟进记录
                </button>
              </div>
            </div>

            {/* 任务概览 */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 任务完成状态 */}
                {taskCompletion && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <h4 className="text-white font-medium mb-4">任务完成情况</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-blue-400 font-semibold text-lg">{taskCompletion.total_leads}</div>
                        <div className="text-gray-400 text-xs">总线索</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-green-400 font-semibold text-lg">{taskCompletion.connected_leads}</div>
                        <div className="text-gray-400 text-xs">已接通</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className={`font-semibold text-lg ${taskCompletion.is_completed ? 'text-green-400' : 'text-yellow-400'}`}>
                          {taskCompletion.completion_rate}%
                        </div>
                        <div className="text-gray-400 text-xs">完成率</div>
                      </div>
                    </div>
                    
                    {/* 完成状态指示器 */}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">任务状态</span>
                      <span className={`px-3 py-1 rounded text-sm ${
                        taskCompletion.is_completed 
                          ? 'text-green-400 bg-green-500/20' 
                          : 'text-yellow-400 bg-yellow-500/20'
                      }`}>
                        {taskCompletion.is_completed ? '已完成' : '进行中'}
                      </span>
                    </div>
                    
                    {/* 完成条件说明 */}
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start">
                        <svg className="w-4 h-4 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-blue-300 text-sm">
                          <p className="font-medium mb-1">完成条件</p>
                          <p>当任务下的所有电话都处于接通状态时，任务视为已完成。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 通话统计信息 */}
                {callStatistics && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <h4 className="text-white font-medium mb-4">通话统计详情</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-blue-400 font-semibold text-lg">{callStatistics.total_calls}</div>
                        <div className="text-gray-400 text-xs">总通话</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-green-400 font-semibold text-lg">{callStatistics.connected_calls}</div>
                        <div className="text-gray-400 text-xs">已接通</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-yellow-400 font-semibold text-lg">{callStatistics.success_rate}%</div>
                        <div className="text-gray-400 text-xs">接通率</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">失败通话：</span>
                        <span className="text-red-400">{callStatistics.failed_calls}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">占线通话：</span>
                        <span className="text-yellow-400">{callStatistics.busy_calls}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">无人接听：</span>
                        <span className="text-orange-400">{callStatistics.no_answer_calls}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 跟进记录列表 */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">跟进记录</h3>
                {followupRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>暂无跟进记录</p>
                  </div>
                ) : (
                  followupRecords.map((record) => (
                    <div key={record.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-white font-medium">{record.leadName}</h4>
                          <p className="text-gray-400 text-sm">{record.phone}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs ${getFollowupTypeColor(record.followupType)}`}>
                            {getFollowupTypeText(record.followupType)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-gray-300 text-sm">{record.content}</p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>跟进时间：{record.followupTime}</span>
                        {record.nextFollowup && (
                          <span>下次跟进：{record.nextFollowup}</span>
                        )}
                      </div>
                      
                      {record.notes && (
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                          <p className="text-yellow-300 text-xs">{record.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 