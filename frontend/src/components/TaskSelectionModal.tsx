'use client';

import { useState, useEffect } from 'react';
import { tasksAPI } from '../services/api';

interface Task {
  id: number;
  task_name: string;
  task_type: number;
  create_time: string;
  leads_count: number;
}

interface TaskSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSelect: (task: Task) => void;
}

export default function TaskSelectionModal({ 
  isOpen, 
  onClose, 
  onTaskSelect 
}: TaskSelectionModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      // 使用新分页接口 /task_list，获取第一页
      const response = await tasksAPI.getTaskListPaged(1, 20);
      if (response.status === 'success') {
        const apiItems = response?.data?.items || [];
        // 仅保留 2(外呼中)、3(跟进中)、4(跟进完成)、5(已暂停)
        const filtered = apiItems.filter((t: any) => [2,3,4,5].includes(t.task_type));
        setTasks(filtered);
      } else {
        setError(response.message || '获取任务列表失败');
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
      setError('获取任务列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getTaskStatusText = (taskType: number) => {
    switch (taskType) {
      case 1:
        return '已创建';
      case 2:
        return '外呼进行中';
      case 3:
        return '跟进中';
      case 4:
        return '跟进完成';
      case 5:
        return '已暂停';
      default:
        return '未知状态';
    }
  };

  const getTaskStatusColor = (taskType: number) => {
    switch (taskType) {
      case 1:
        return 'text-blue-400 bg-blue-500/20';
      case 2:
        return 'text-yellow-400 bg-yellow-500/20';
      case 3:
        return 'text-blue-400 bg-blue-500/20';
      case 4:
        return 'text-green-400 bg-green-500/20';
      case 5:
        return 'text-yellow-400 bg-yellow-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const handleTaskSelect = (task: Task) => {
    onTaskSelect(task);
    onClose();
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          onClick={onClose}
        />
      )}

      {/* 模态框 */}
      <div className={`
        fixed inset-0 flex items-center justify-center z-50
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        transition-opacity duration-300
      `}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg p-6 w-[500px] max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">选择任务</h2>
              <p className="text-gray-400 text-sm mt-1">查看外呼进行中、已完成和跟进完成的任务</p>
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

          {/* 加载状态 */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="text-blue-400 ml-3">正在加载任务列表...</span>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400">{error}</span>
              </div>
            </div>
          )}

          {/* 任务列表 */}
          {!loading && !error && (
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>暂无相关任务</p>
                  <p className="text-xs mt-2">请等待任务开始执行后再查看</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div 
                    key={task.id}
                    onClick={() => handleTaskSelect(task)}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{task.task_name}</h3>
                        <p className="text-gray-400 text-sm">创建时间：{new Date(task.create_time).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* 外呼状态指示器 - 只对外呼进行中的任务显示 */}
                        {task.task_type === 2 && (
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mr-1 animate-pulse"></div>
                            <span className="text-blue-400 text-xs">外呼中</span>
                          </div>
                        )}
                        <span className={`px-2 py-1 rounded text-xs ${getTaskStatusColor(task.task_type)}`}>
                          {getTaskStatusText(task.task_type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">线索数量：{task.leads_count}</span>
                      <span className="text-blue-400 text-xs">点击查看执行记录</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 底部按钮 */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 