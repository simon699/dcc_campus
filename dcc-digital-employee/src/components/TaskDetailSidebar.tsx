'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface TaskDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number | null;
}

interface TaskDetail {
  id: number;
  task_name: string;
  task_mode: number;
  task_type: number;
  execution_time: string;
  status: number;
  creator: string;
  create_time: string;
  update_time: string;
  lead_count: number;
  leads: Array<{
    id: number;
    client_name: string;
    phone: string;
    product: string;
    clues_status_text: string;
    client_level_text: string;
  }>;
}

export default function TaskDetailSidebar({ isOpen, onClose, taskId }: TaskDetailSidebarProps) {
  const { theme } = useTheme();
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 状态映射
  const getStatusText = (status: number): string => {
    const statusMap: { [key: number]: string } = {
      1: '未开始',
      2: '执行中', 
      3: '已结束',
      4: '已暂停'
    };
    return statusMap[status] || '未知';
  };

  const getTaskModeText = (mode: number): string => {
    return mode === 1 ? '手动' : '自动';
  };

  const getTaskTypeText = (type: number): string => {
    return type === 1 ? '通知类' : '触达类';
  };

  // 获取任务详情
  const fetchTaskDetail = async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/tasks/task_detail/${taskId}`, {
        headers: {
          'access-token': accessToken || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data) {
          setTaskDetail(data.data);
        }
      } else {
        console.error('Failed to fetch task detail');
      }
    } catch (error) {
      console.error('Error fetching task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetail();
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  return (
    <div>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[1003]" 
        onClick={onClose}
      />
      
      {/* 侧边栏 */}
      <div className={`fixed right-0 top-0 h-full w-96 z-[1004] transform transition-transform duration-300 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      } shadow-xl`}>
        {/* 头部 */}
        <div className={`p-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              任务详情
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-gray-800 text-gray-400' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto h-full pb-20">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : taskDetail ? (
            // 在现有基本信息基础上增加更多详情
            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <h3 className={`text-md font-medium mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  基本信息
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      任务名称
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {taskDetail.task_name}
                    </p>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      任务类型
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {getTaskTypeText(taskDetail.task_type)}
                    </p>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      任务方式
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {getTaskModeText(taskDetail.task_mode)}
                    </p>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      任务状态
                    </label>
                    <span className={`badge ${
                      taskDetail.status === 3 ? 'badge-success' :
                      taskDetail.status === 4 ? 'badge-error' :
                      taskDetail.status === 2 ? 'badge-warning' :
                      'badge-gray'
                    }`}>
                      {getStatusText(taskDetail.status)}
                    </span>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      执行时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {taskDetail.execution_time || '-'}
                    </p>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      创建人
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {taskDetail.creator}
                    </p>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      创建时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {taskDetail.create_time}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 关联线索 */}
              <div>
                <h3 className={`text-md font-medium mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  关联线索 ({taskDetail.lead_count}个)
                </h3>
                <div className="space-y-3">
                  {taskDetail.leads && taskDetail.leads.length > 0 ? (
                    taskDetail.leads.map((lead) => (
                      <div key={lead.id} className={`p-3 rounded-lg border ${
                        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {lead.client_name}
                            </p>
                            <p className={`text-sm mt-1 ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {lead.phone}
                            </p>
                            <p className={`text-sm ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {lead.product}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`badge ${
                              lead.clues_status_text === '已成交' ? 'badge-success' :
                              lead.clues_status_text === '已战败' ? 'badge-error' :
                              lead.clues_status_text === '跟进中' ? 'badge-warning' :
                              'badge-gray'
                            }`}>
                              {lead.clues_status_text}
                            </span>
                            <p className={`text-xs mt-1 ${
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {lead.client_level_text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm text-center py-4 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      暂无关联线索
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-center py-8 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              暂无任务详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}