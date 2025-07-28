'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TaskDetail {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  progress: number;
  totalCalls: number;
  completedCalls: number;
  successRate: number;
  createdAt: string;
  scheduledAt: string;
  estimatedCompletion: string;
  priority: 'high' | 'medium' | 'low';
  type: 'marketing' | 'followup' | 'survey' | 'reminder';
  description: string;
  callScriptScene: string;
  maxRetries: number;
  callInterval: number;
  customerConditions: {
    customerLevels: string[];
    lastFollowUpDays: string;
    remarkKeywords: string;
  };
  timeSettings: {
    startDate: string;
    endDate: string;
    workingHours: {
      start: string;
      end: string;
    };
    workingDays: string[];
  };
}

interface CallRecord {
  id: number;
  customerName: string;
  phoneNumber: string;
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'rejected';
  callTime: string;
  duration: string;
  result: string;
  retryCount: number;
}

interface TaskDetailModalProps {
  task: TaskDetail | null;
  onClose: () => void;
}

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, calls, settings
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [callStats, setCallStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    noAnswer: 0,
    busy: 0,
    rejected: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  // 抽屉显示动画
  useEffect(() => {
    if (task) {
      setIsVisible(true);
    }
  }, [task]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (task) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [task]);

  // 模拟获取电话记录数据
  useEffect(() => {
    if (task) {
      const mockCallRecords: CallRecord[] = [
        {
          id: 1,
          customerName: '张三',
          phoneNumber: '138****1234',
          status: 'completed',
          callTime: '2024-01-15 10:30',
          duration: '2:15',
          result: '客户表示感兴趣，已记录需求',
          retryCount: 0
        },
        {
          id: 2,
          customerName: '李四',
          phoneNumber: '139****5678',
          status: 'no_answer',
          callTime: '2024-01-15 10:35',
          duration: '0:00',
          result: '无人接听',
          retryCount: 1
        },
        {
          id: 3,
          customerName: '王五',
          phoneNumber: '137****9012',
          status: 'completed',
          callTime: '2024-01-15 10:40',
          duration: '1:45',
          result: '客户拒绝，表示暂时不需要',
          retryCount: 0
        },
        {
          id: 4,
          customerName: '赵六',
          phoneNumber: '136****3456',
          status: 'pending',
          callTime: '',
          duration: '',
          result: '',
          retryCount: 0
        },
        {
          id: 5,
          customerName: '钱七',
          phoneNumber: '135****7890',
          status: 'busy',
          callTime: '2024-01-15 10:50',
          duration: '0:00',
          result: '电话占线',
          retryCount: 2
        }
      ];

      setCallRecords(mockCallRecords);

      // 计算统计数据
      const stats = {
        total: mockCallRecords.length,
        completed: mockCallRecords.filter(c => c.status === 'completed').length,
        failed: mockCallRecords.filter(c => c.status === 'failed').length,
        pending: mockCallRecords.filter(c => c.status === 'pending').length,
        noAnswer: mockCallRecords.filter(c => c.status === 'no_answer').length,
        busy: mockCallRecords.filter(c => c.status === 'busy').length,
        rejected: mockCallRecords.filter(c => c.status === 'rejected').length
      };
      setCallStats(stats);
    }
  }, [task]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500/30', text: '执行中', icon: '⚡' };
      case 'pending':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', text: '待执行', icon: '⏳' };
      case 'completed':
        return { color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/30', text: '已完成', icon: '✅' };
      case 'paused':
        return { color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30', text: '已暂停', icon: '⏸️' };
      case 'failed':
        return { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/30', text: '失败', icon: '❌' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/20', border: 'border-gray-500/30', text: '未知', icon: '❓' };
    }
  };

  const getCallStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'text-green-400', bg: 'bg-green-900/20', text: '已完成', icon: '✅' };
      case 'pending':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', text: '待拨打', icon: '⏳' };
      case 'calling':
        return { color: 'text-blue-400', bg: 'bg-blue-900/20', text: '拨打中', icon: '📞' };
      case 'failed':
        return { color: 'text-red-400', bg: 'bg-red-900/20', text: '失败', icon: '❌' };
      case 'no_answer':
        return { color: 'text-orange-400', bg: 'bg-orange-900/20', text: '无人接听', icon: '🔇' };
      case 'busy':
        return { color: 'text-purple-400', bg: 'bg-purple-900/20', text: '占线', icon: '📴' };
      case 'rejected':
        return { color: 'text-red-400', bg: 'bg-red-900/20', text: '拒接', icon: '🚫' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/20', text: '未知', icon: '❓' };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { color: 'text-red-400', bg: 'bg-red-900/20', text: '高' };
      case 'medium':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', text: '中' };
      case 'low':
        return { color: 'text-green-400', bg: 'bg-green-900/20', text: '低' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/20', text: '未知' };
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!task) return null;

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* 任务基本信息 */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-3xl">🤖</div>
            <div>
              <h3 className="text-white font-semibold text-xl">{task.name}</h3>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                  {statusConfig.icon} {statusConfig.text}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityConfig.bg} ${priorityConfig.color}`}>
                  优先级: {priorityConfig.text}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{task.progress}%</div>
            <div className="text-gray-400 text-sm">完成度</div>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="mb-6">
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
        
        {/* 任务统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">外呼进度</div>
            <div className="text-white font-medium">{task.completedCalls}/{task.totalCalls}</div>
          </div>
          <div>
            <div className="text-gray-400">成功率</div>
            <div className="text-white font-medium">{task.successRate}%</div>
          </div>
          <div>
            <div className="text-gray-400">计划时间</div>
            <div className="text-white font-medium">{task.scheduledAt}</div>
          </div>
          <div>
            <div className="text-gray-400">预计完成</div>
            <div className="text-white font-medium">{task.estimatedCompletion}</div>
          </div>
        </div>
      </div>

      {/* 任务描述 */}
      {task.description && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h4 className="text-white font-semibold mb-3 flex items-center space-x-2">
            <span>📝</span>
            <span>任务描述</span>
          </h4>
          <p className="text-gray-300">{task.description}</p>
        </div>
      )}

      {/* 外呼配置概览 */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
          <span>⚙️</span>
          <span>外呼配置</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-gray-400 text-sm">话术场景</div>
            <div className="text-white font-medium">{task.callScriptScene || '未设置'}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">最大重试次数</div>
            <div className="text-white font-medium">{task.maxRetries} 次</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">呼叫间隔</div>
            <div className="text-white font-medium">{task.callInterval} 秒</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCalls = () => (
    <div className="space-y-6">
      {/* 电话统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: '总计', value: callStats.total, color: 'from-blue-500 to-cyan-500' },
          { label: '已完成', value: callStats.completed, color: 'from-green-500 to-emerald-500' },
          { label: '待拨打', value: callStats.pending, color: 'from-yellow-500 to-orange-500' },
          { label: '失败', value: callStats.failed, color: 'from-red-500 to-pink-500' },
          { label: '无人接听', value: callStats.noAnswer, color: 'from-orange-500 to-red-500' },
          { label: '占线', value: callStats.busy, color: 'from-purple-500 to-pink-500' },
          { label: '拒接', value: callStats.rejected, color: 'from-red-500 to-orange-500' }
        ].map((stat, index) => (
          <div key={index} className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-xl p-4 border border-gray-700/50">
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
            <div className={`w-full h-1 mt-2 rounded-full bg-gradient-to-r ${stat.color} opacity-60`} />
          </div>
        ))}
      </div>

      {/* 电话记录列表 */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50">
        <div className="p-4 border-b border-gray-700/50">
          <h4 className="text-white font-semibold flex items-center space-x-2">
            <span>📞</span>
            <span>电话记录</span>
          </h4>
        </div>
        
        <div className="p-4">
          <div className="space-y-3">
            {callRecords.map((call) => {
              const callStatusConfig = getCallStatusConfig(call.status);
              
              return (
                <div key={call.id} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                        {call.customerName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-medium">{call.customerName}</div>
                        <div className="text-gray-400 text-sm">{call.phoneNumber}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${callStatusConfig.bg} ${callStatusConfig.color}`}>
                        {callStatusConfig.icon} {callStatusConfig.text}
                      </span>
                      {call.retryCount > 0 && (
                        <div className="text-gray-400 text-xs mt-1">重试 {call.retryCount} 次</div>
                      )}
                    </div>
                  </div>
                  
                  {call.status !== 'pending' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400">拨打时间</div>
                        <div className="text-white">{call.callTime}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">通话时长</div>
                        <div className="text-white">{call.duration}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-gray-400">通话结果</div>
                        <div className="text-white">{call.result}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      {/* 客户筛选条件 */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
          <span>🎯</span>
          <span>客户筛选条件</span>
        </h4>
        
        <div className="space-y-4">
          <div>
            <div className="text-gray-400 text-sm mb-2">客户等级</div>
            <div className="flex flex-wrap gap-2">
              {task.customerConditions.customerLevels.length > 0 ? (
                task.customerConditions.customerLevels.map((level) => (
                  <span key={level} className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-sm border border-blue-500/30">
                    {level}级客户
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">未设置</span>
              )}
            </div>
          </div>
          
          <div>
            <div className="text-gray-400 text-sm mb-2">最新跟进时间</div>
            <div className="text-white">
              {task.customerConditions.lastFollowUpDays ? 
                `超过 ${task.customerConditions.lastFollowUpDays} 天` : 
                '未设置'
              }
            </div>
          </div>
          
          <div>
            <div className="text-gray-400 text-sm mb-2">备注关键词</div>
            <div className="text-white">
              {task.customerConditions.remarkKeywords || '未设置'}
            </div>
          </div>
        </div>
      </div>

      {/* 时间设置 */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
          <span>⏰</span>
          <span>时间设置</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-gray-400 text-sm mb-2">执行时间</div>
            <div className="text-white">
              {task.timeSettings.startDate} 至 {task.timeSettings.endDate}
            </div>
          </div>
          
          <div>
            <div className="text-gray-400 text-sm mb-2">工作时间</div>
            <div className="text-white">
              {task.timeSettings.workingHours.start} - {task.timeSettings.workingHours.end}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <div className="text-gray-400 text-sm mb-2">工作日</div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '1', label: '周一' },
                { value: '2', label: '周二' },
                { value: '3', label: '周三' },
                { value: '4', label: '周四' },
                { value: '5', label: '周五' },
                { value: '6', label: '周六' },
                { value: '7', label: '周日' }
              ].map((day) => (
                <span
                  key={day.value}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    task.timeSettings.workingDays.includes(day.value)
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                      : 'bg-gray-700/50 text-gray-400 border-gray-600/50'
                  }`}
                >
                  {day.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" onClick={handleClose}>
      {/* 侧拉抽屉 */}
      <div 
        className={`absolute right-0 top-0 h-full w-full sm:w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 max-w-5xl bg-gradient-to-br from-gray-900 to-gray-800 border-l border-gray-700 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <span>📋</span>
              <span>任务详情</span>
            </h2>
            <span className="text-gray-400 text-sm">点击背景或按 ESC 关闭</span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-gray-700/50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 导航标签 */}
        <div className="px-6 pt-4">
          <div className="flex space-x-1 p-1 bg-gray-800/50 rounded-xl backdrop-blur-sm border border-gray-700/50">
            {[
              { id: 'overview', label: '任务概览', icon: '📊' },
              { id: 'calls', label: '电话记录', icon: '📞' },
              { id: 'settings', label: '任务设置', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-300
                  ${activeTab === tab.id 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'calls' && renderCalls()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </div>
    </div>,
    document.body
  );
} 