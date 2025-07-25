'use client';

import { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useRouter } from 'next/navigation'; // 导入 useRouter
import Header from '../components/Header';
import RobotGrid from '../components/RobotGrid';
import LeadCard from '../components/LeadCard';
import Sidebar from '../components/Sidebar';

export default function Home() {
  const { theme } = useTheme();
  const router = useRouter(); // 使用 useRouter
  
  useEffect(() => {
    console.log("Home page mounted");
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      theme === 'dark' 
        ? 'bg-gray-900' 
        : 'bg-gray-50'
    }`}>
      <Header />
      <Sidebar activeMenu="" />
      
      <main className="ml-64 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className={`text-3xl font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              数字员工管理平台
            </h1>
            <p className={`mt-2 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              管理和监控您的数字员工，提升工作效率
            </p>
          </div>

          <div className="space-y-8">
            <LeadCard 
              todayNewLeads={12} 
              overdueLeads={3} 
              unfollowedLeads={8} 
              onViewLeadsList={() => router.push('/leads')} // 修改这里，实现跳转到线索管理页面
            />
            <RobotGrid />
          </div>
        </div>
      </main>
    </div>
  );
}