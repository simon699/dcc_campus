'use client';

import { useState } from 'react';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'info' | 'error';
  leads?: LeadItem[];
}

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  customerLevel: string;
  lastFollowUp: string;
  nextFollowUp: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
}

interface MonitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  onStartCalling?: (leads: LeadItem[]) => void;
}

export default function MonitorDrawer({ isOpen, onClose, alerts, onStartCalling }: MonitorDrawerProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const handleViewLeadDetails = (alertId: string) => {
    setExpandedAlert(expandedAlert === alertId ? null : alertId);
  };

  const handleStartCalling = async (leads: LeadItem[]) => {
    try {
      // 获取访问令牌
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('未找到访问令牌');
        return;
      }

      // 提取线索ID
      const leadIds = leads.map(lead => parseInt(lead.id));

      // 构建请求参数
      const requestData = {
        "job_group_name": "客户回访任务",
        "job_group_description": "对重要客户进行回访",
        "strategy_json": {
          "RepeatBy": "once",
          "maxAttemptsPerDay": 3,
          "minAttemptInterval": 120
        },
        "lead_ids": [225,226],
        "extras": [
          {
            "key": "ServiceId",
            "value": ""
          },
          {
            "key": "TenantId",
            "value": ""
          }
        ]
      };

      // 调用外呼接口
      const response = await fetch('http://localhost:8000/api/create_outbound_call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('外呼任务创建成功:', result);
        // 可以在这里添加成功提示
        alert('外呼任务创建成功！');
      } else {
        throw new Error(result.message || '外呼任务创建失败');
      }
    } catch (error) {
      console.error('发起外呼失败:', error);
      alert('发起外呼失败，请重试');
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* 侧拉抽屉 */}
      <div className={`
        fixed top-0 right-0 h-full w-[600px] bg-white/10 backdrop-blur-xl border-l border-white/20
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">监控预警</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 抽屉内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 批量外呼按钮 */}
            <div className="mb-6">
              <button
                onClick={() => {
                  const allLeads = alerts.flatMap(alert => alert.leads || []);
                  handleStartCalling(allLeads);
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  批量外呼跟进 ({alerts.flatMap(alert => alert.leads || []).length} 个客户)
                </div>
              </button>
            </div>

            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        alert.type === 'warning' ? 'bg-yellow-400' : 
                        alert.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
                      }`}></div>
                      <h5 className="text-white font-medium">{alert.title}</h5>
                    </div>
                    <button
                      onClick={() => handleViewLeadDetails(alert.id)}
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {expandedAlert === alert.id ? '隐藏详情' : '查看详情'}
                    </button>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">{alert.description}</p>
                  
                                     {/* 线索详情 */}
                   {expandedAlert === alert.id && alert.leads && (
                     <div className="space-y-3">
                       {alert.leads.map((lead) => (
                         <div key={lead.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                           <div className="flex items-start justify-between mb-3">
                             <div className="flex-1">
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-white font-medium text-lg">{lead.name}</span>
                                 <span className={`text-xs px-2 py-1 rounded ${
                                   lead.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                   lead.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                   'bg-green-500/20 text-green-300'
                                 }`}>
                                   {lead.priority === 'high' ? '高优先级' : 
                                    lead.priority === 'medium' ? '中优先级' : '低优先级'}
                                 </span>
                               </div>
                               <div className="text-gray-300 text-sm mb-3">
                                 <div className="flex items-center mb-1">
                                   <span className="text-gray-400 w-16">手机号:</span>
                                   <span>{lead.phone}</span>
                                 </div>
                                 <div className="flex items-center mb-1">
                                   <span className="text-gray-400 w-16">客户等级:</span>
                                   <span className="text-blue-300">{lead.customerLevel}</span>
                                 </div>
                                 <div className="flex items-center mb-1">
                                   <span className="text-gray-400 w-16">最近跟进:</span>
                                   <span>{lead.lastFollowUp}</span>
                                 </div>
                                 <div className="flex items-center mb-1">
                                   <span className="text-gray-400 w-16">下次跟进:</span>
                                   <span className="text-yellow-300">{lead.nextFollowUp}</span>
                                 </div>
                                 <div className="flex items-start">
                                   <span className="text-gray-400 w-16 mt-1">备注:</span>
                                   <span className="text-gray-300 flex-1">{lead.notes}</span>
                                 </div>
                               </div>
                             </div>
                             <button
                               onClick={() => handleStartCalling([lead])}
                               className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex-shrink-0"
                             >
                               发起外呼
                             </button>
                           </div>
                         </div>
                       ))}
                       <button
                         onClick={() => handleStartCalling(alert.leads || [])}
                         className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
                       >
                         批量发起外呼 ({alert.leads?.length || 0} 个客户)
                       </button>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 