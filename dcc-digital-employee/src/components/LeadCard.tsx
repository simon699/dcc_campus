'use client';

import { useState } from 'react';
import Image from 'next/image';
import LeadSidebar from './LeadSidebar';
import { useTheme } from '../contexts/ThemeContext';

type Lead = {
  id: number;
  name: string;
  phone: string;
  product: string;
  level: string;
  status: string;
  source: string;
};

type LeadCardProps = {
  todayNewLeads: number;
  overdueLeads: number;
  unfollowedLeads: number;
  onViewLeadsList: () => void;
};

export default function LeadCard({
  todayNewLeads,
  overdueLeads,
  unfollowedLeads,
  onViewLeadsList
}: LeadCardProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const { theme } = useTheme();

  const handleAddLead = (newLead: Omit<Lead, 'id'>) => {
    const leadWithId = {
      ...newLead,
      id: Date.now(),
    };
    setLeads(prevLeads => [...prevLeads, leadWithId]);
    setIsSidebarOpen(false);
  };

  return (
    <div className="saas-card">
      {/* 线索概览和按钮区域 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            线索概览
          </h3>
          <p className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            管理和跟踪您的销售线索
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onViewLeadsList}
            className="btn-outline"
          >
            查看线索列表
          </button>
          
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn-primary flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增线索
          </button>
        </div>
      </div>
      
      {/* 数据指标区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                今日新增线索
              </p>
              <p className={`text-2xl font-bold mt-2 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {todayNewLeads}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                逾期线索
              </p>
              <p className={`text-2xl font-bold mt-2 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              }`}>
                {overdueLeads}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                超期未跟进
              </p>
              <p className={`text-2xl font-bold mt-2 ${
                theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`}>
                {unfollowedLeads}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Sidebar */}
      <LeadSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onAddLead={handleAddLead}
        userName="管理员"
      />
    </div>
  );
}
