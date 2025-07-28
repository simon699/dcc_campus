'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TaskDetailModal from './TaskDetailModal';

interface Task {
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

interface OutboundCallTaskDashboardProps {
  showHistory?: boolean;
}

export default function OutboundCallTaskDashboard({ showHistory = false }: OutboundCallTaskDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedToday: 0,
    totalCallsToday: 0,
    successRateToday: 0,
    avgCallDuration: '2:34'
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const router = useRouter();

  // 模拟数据
  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: 1,
        name: '新客户开发外呼',
        status: 'running',
        progress: 65,
        totalCalls: 200,
        completedCalls: 130,
        successRate: 23.5,
        createdAt: '2024-01-15 09:00',
        scheduledAt: '2024-01-15 09:30',
        estimatedCompletion: '2024-01-15 17:30',
        priority: 'high',
        type: 'marketing',
        description: '针对新客户进行产品介绍和需求挖掘，提高客户转化率',
        callScriptScene: 'new_customer_intro',
        maxRetries: 3,
        callInterval: 30,
        customerConditions: {
          customerLevels: ['N', 'C'],
          lastFollowUpDays: '30',
          remarkKeywords: '感兴趣,有意向'
        },
        timeSettings: {
          startDate: '2024-01-15',
          endDate: '2024-01-20',
          workingHours: {
            start: '09:00',
            end: '18:00'
          },
          workingDays: ['1', '2', '3', '4', '5']
        }
      },
      {
        id: 2,
        name: '客户满意度调研',
        status: 'pending',
        progress: 0,
        totalCalls: 150,
        completedCalls: 0,
        successRate: 0,
        createdAt: '2024-01-15 10:30',
        scheduledAt: '2024-01-15 14:00',
        estimatedCompletion: '2024-01-15 18:00',
        priority: 'medium',
        type: 'survey',
        description: '对现有客户进行满意度调研，收集客户反馈和建议',
        callScriptScene: 'satisfaction_survey',
        maxRetries: 2,
        callInterval: 45,
        customerConditions: {
          customerLevels: ['H', 'A', 'B'],
          lastFollowUpDays: '60',
          remarkKeywords: '活跃客户,重要客户'
        },
        timeSettings: {
          startDate: '2024-01-16',
          endDate: '2024-01-25',
          workingHours: {
            start: '10:00',
            end: '17:00'
          },
          workingDays: ['1', '2', '3', '4', '5']
        }
      },
      {
        id: 3,
        name: '老客户回访',
        status: 'completed',
        progress: 100,
        totalCalls: 80,
        completedCalls: 80,
        successRate: 87.5,
        createdAt: '2024-01-14 08:00',
        scheduledAt: '2024-01-14 09:00',
        estimatedCompletion: '2024-01-14 16:00',
        priority: 'medium',
        type: 'followup',
        description: '对老客户进行定期回访，维护客户关系，了解最新需求',
        callScriptScene: 'customer_followup',
        maxRetries: 3,
        callInterval: 30,
        customerConditions: {
          customerLevels: ['H', 'A'],
          lastFollowUpDays: '90',
          remarkKeywords: '老客户,重要客户'
        },
        timeSettings: {
          startDate: '2024-01-14',
          endDate: '2024-01-19',
          workingHours: {
            start: '09:00',
            end: '18:00'
          },
          workingDays: ['1', '2', '3', '4', '5']
        }
      }
    ];

    setTasks(showHistory ? mockTasks.filter(t => t.status === 'completed') : mockTasks);
    setStats({
      totalTasks: mockTasks.length,
      activeTasks: mockTasks.filter(t => t.status === 'running').length,
      completedToday: mockTasks.filter(t => t.status === 'completed').length,
      totalCallsToday: 456,
      successRateToday: 34.2,
      avgCallDuration: '2:34'
    });
  }, [showHistory]);

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

  return (
    <div className="space-y-8">
      {/* 统计卡片 */}
      {!showHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {[
            { label: '总任务数', value: stats.totalTasks, icon: '📋', color: 'from-blue-500 to-cyan-500' },
            { label: '执行中', value: stats.activeTasks, icon: '⚡', color: 'from-green-500 to-emerald-500' },
            { label: '今日完成', value: stats.completedToday, icon: '✅', color: 'from-purple-500 to-pink-500' },
            { label: '今日外呼', value: stats.totalCallsToday, icon: '📞', color: 'from-orange-500 to-red-500' },
            { label: '成功率', value: `${stats.successRateToday}%`, icon: '🎯', color: 'from-indigo-500 to-purple-500' },
            { label: '平均时长', value: stats.avgCallDuration, icon: '⏱️', color: 'from-teal-500 to-cyan-500' }
          ].map((stat, index) => (
            <div key={index} className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="text-2xl">{stat.icon}</div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} opacity-20`} />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 任务列表 */}
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50">
        <div className="p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>📋</span>
            <span>{showHistory ? '历史任务' : '任务列表'}</span>
          </h2>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {tasks.map((task) => {
              const statusConfig = getStatusConfig(task.status);
              const priorityConfig = getPriorityConfig(task.priority);
              
              return (
                <div 
                  key={task.id}
                  className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer"
                  onClick={() => {
                    setSelectedTask(task);
                    setShowTaskDetail(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">🤖</div>
                      <div>
                        <h3 className="text-white font-semibold text-lg">{task.name}</h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                            {statusConfig.icon} {statusConfig.text}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig.bg} ${priorityConfig.color}`}>
                            优先级: {priorityConfig.text}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{task.progress}%</div>
                      <div className="text-gray-400 text-sm">完成度</div>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="mb-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* 任务详情 */}
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
              );
            })}
          </div>
        </div>
      </div>

      {/* 任务详情模态框 */}
      {showTaskDetail && (
        <TaskDetailModal 
          task={selectedTask}
          onClose={() => {
            setShowTaskDetail(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}