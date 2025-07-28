'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import LeadDetailSidebar from './LeadDetailSidebar';

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
    clues_status: number;
    client_level: number;
  }>;
}

export default function TaskDetailSidebar({ isOpen, onClose, taskId }: TaskDetailSidebarProps) {
  const { theme } = useTheme();
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false);
  const [showAddFollowForm, setShowAddFollowForm] = useState(false);

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

  // 线索状态映射
  const getLeadStatusText = (status: number): string => {
    const statusMap: { [key: number]: string } = {
      0: '已战败',
      1: '未跟进',
      2: '跟进中',
      3: '已成交'
    };
    return statusMap[status] || '未知';
  };

  // 客户等级映射
  const getClientLevelText = (level: number): string => {
    const levelMap: { [key: number]: string } = {
      1: 'H级',
      2: 'A级',
      3: 'B级',
      4: 'C级',
      5: 'N级',
      6: 'O级',
      7: 'F级'
    };
    return levelMap[level] || 'N级';
  };

  // 获取任务详情
  const fetchTaskDetail = async () => {
    if (!taskId) return;
    
    setLoading(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/task_detail/${taskId}`, {
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

  // 处理查看线索详情
  const handleViewLeadDetail = (lead: any) => {
    setSelectedLeadId(lead.id);
    setShowAddFollowForm(false);
    setIsLeadDetailOpen(true);
  };

  // 处理发起外呼
  const handleOutboundCall = (leadId: number) => {
    console.log('发起外呼:', leadId);
    // TODO: 实现外呼逻辑
    alert(`正在为线索 ${leadId} 发起外呼...`);
  };

  // 处理跟进
  const handleFollowUp = (leadId: number) => {
    console.log('跟进:', leadId);
    setSelectedLeadId(leadId);
    setShowAddFollowForm(true);
    setIsLeadDetailOpen(true);
  };

  // 处理线索详情侧拉抽屉关闭
  const handleLeadDetailClose = () => {
    setIsLeadDetailOpen(false);
    setSelectedLeadId(null);
    setShowAddFollowForm(false);
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
      <div className={`fixed right-0 top-0 h-full w-[800px] z-[1004] transform transition-transform duration-300 ${
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
        <div className="flex h-full">
          {/* 左侧内容区域 */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : taskDetail ? (
              <div className="p-6 space-y-6">
                {/* 任务基本信息 */}
                <div className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                }`}>
                  <h3 className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    任务基本信息
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        任务名称
                      </label>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        taskDetail.status === 3 ? 'bg-green-100 text-green-800' :
                        taskDetail.status === 4 ? 'bg-red-100 text-red-800' :
                        taskDetail.status === 2 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
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
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        更新时间
                      </label>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {taskDetail.update_time}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 线索列表 */}
                <div>
                  <h3 className={`text-lg font-semibold mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    关联线索 ({taskDetail.lead_count}个)
                  </h3>
                  <div className="space-y-3">
                    {taskDetail.leads && taskDetail.leads.length > 0 ? (
                      taskDetail.leads.map((lead) => (
                        <div key={lead.id} className={`p-4 rounded-lg border ${
                          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                        } hover:shadow-md transition-shadow cursor-pointer`}
                        onClick={() => handleViewLeadDetail(lead)}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="flex-1">
                                  <p className={`font-medium ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>
                                    {lead.client_name}
                                  </p>
                                  <p className={`text-sm mt-1 ${
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                    📞 {lead.phone}
                                  </p>
                                  <p className={`text-sm ${
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                    📦 {lead.product}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    lead.clues_status === 3 ? 'bg-green-100 text-green-800' :
                                    lead.clues_status === 0 ? 'bg-red-100 text-red-800' :
                                    lead.clues_status === 2 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {getLeadStatusText(lead.clues_status)}
                                  </span>
                                  <p className={`text-xs mt-1 ${
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                  }`}>
                                    {getClientLevelText(lead.client_level)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOutboundCall(lead.id);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  theme === 'dark' 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                title="发起外呼"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollowUp(lead.id);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  theme === 'dark' 
                                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                                title="跟进"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={`text-center py-8 ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-2 text-sm">暂无关联线索</p>
                      </div>
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

          {/* 右侧固定操作按钮 */}
          <div className={`w-48 border-l ${
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          } p-4`}>
            <div className="sticky top-4">
              <h4 className={`text-sm font-medium mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                操作面板
              </h4>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (taskDetail?.leads && taskDetail.leads.length > 0) {
                      // 为所有线索发起外呼
                      taskDetail.leads.forEach(lead => handleOutboundCall(lead.id));
                    }
                  }}
                  disabled={!taskDetail?.leads || taskDetail.leads.length === 0}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    taskDetail?.leads && taskDetail.leads.length > 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  批量外呼
                </button>
                
                <button
                  onClick={() => {
                    if (taskDetail?.leads && taskDetail.leads.length > 0) {
                      // 为所有线索跟进
                      taskDetail.leads.forEach(lead => handleFollowUp(lead.id));
                    }
                  }}
                  disabled={!taskDetail?.leads || taskDetail.leads.length === 0}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    taskDetail?.leads && taskDetail.leads.length > 0
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  批量跟进
                </button>
              </div>

              {/* 任务统计信息 */}
              {taskDetail && (
                <div className={`mt-6 p-4 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-white'
                } border ${
                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  <h5 className={`text-xs font-medium mb-3 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    任务统计
                  </h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        总线索数
                      </span>
                      <span className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {taskDetail.lead_count}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        已成交
                      </span>
                      <span className="text-green-600 font-medium">
                        {taskDetail.leads?.filter(lead => lead.clues_status === 3).length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        跟进中
                      </span>
                      <span className="text-yellow-600 font-medium">
                        {taskDetail.leads?.filter(lead => lead.clues_status === 2).length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        已战败
                      </span>
                      <span className="text-red-600 font-medium">
                        {taskDetail.leads?.filter(lead => lead.clues_status === 0).length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 线索详情侧拉抽屉 */}
      <LeadDetailSidebar 
        isOpen={isLeadDetailOpen} 
        onClose={handleLeadDetailClose} 
        leadId={selectedLeadId}
        showAddFollowForm={showAddFollowForm}
      />
    </div>
  );
}