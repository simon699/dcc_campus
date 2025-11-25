'use client';

import { useState, useEffect, useCallback } from 'react';
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

const PAGE_SIZE = 12;

export default function TaskSelectionModal({ 
  isOpen, 
  onClose, 
  onTaskSelect 
}: TaskSelectionModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTasks = useCallback(async (pageToLoad: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      // 使用新分页接口 /task_list，获取第一页
      const response = await tasksAPI.getTaskListPaged(pageToLoad, PAGE_SIZE, { taskTypes: [2, 3, 4, 5] });
      if (response.status === 'success') {
        const apiData = response?.data || {};
        const apiItems = apiData.items || [];
        const pagination = apiData.pagination || {};

        // 仅保留 2(外呼中)、3(跟进中)、4(跟进完成)、5(已暂停)
        const filtered = apiItems.filter((t: any) => [2,3,4,5].includes(t.task_type));
        setTasks(filtered);

        const total = typeof pagination.total_count === 'number'
          ? pagination.total_count
          : typeof pagination.total === 'number'
            ? pagination.total
            : filtered.length;
        const totalPageCount = typeof pagination.total_pages === 'number'
          ? pagination.total_pages
          : Math.max(1, Math.ceil(total / PAGE_SIZE));

        setTotalCount(total);
        setTotalPages(totalPageCount);
      } else {
        setError(response.message || '获取任务列表失败');
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
      setError('获取任务列表失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPage(1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    fetchTasks(page);
  }, [fetchTasks, isOpen, page]);

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

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    setPage(nextPage);
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
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-4xl h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">跟进Agent · 选择任务</h2>
              <p className="text-gray-400 text-sm mt-1">
                当前仅展示外呼中、跟进中、跟进完成、已暂停的任务，共 {totalCount} 个
              </p>
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

          <div className="flex-1 overflow-y-auto pr-1">
            {/* 加载状态 */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
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
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>暂无相关任务</p>
                    <p className="text-xs mt-2">请等待任务开始执行后再查看</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                      <div 
                        key={task.id}
                        onClick={() => handleTaskSelect(task)}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 pr-2">
                            <h3 className="text-white font-medium line-clamp-2">{task.task_name}</h3>
                            <p className="text-gray-400 text-sm mt-1">创建时间：{new Date(task.create_time).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-col items-end space-y-2">
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
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部分页与操作 */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-400">
                第 <span className="text-white">{page}</span> / {totalPages} 页
                <span className="ml-2 text-gray-500">（每页 {PAGE_SIZE} 条）</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className={`px-3 py-2 rounded-lg border border-white/10 text-sm transition-colors ${page <= 1 || loading ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-white/10'}`}
                >
                  上一页
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className={`px-3 py-2 rounded-lg border border-white/10 text-sm transition-colors ${page >= totalPages || loading ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-white/10'}`}
                >
                  下一页
                </button>
                <button
                  onClick={onClose}
                  className="ml-4 px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 