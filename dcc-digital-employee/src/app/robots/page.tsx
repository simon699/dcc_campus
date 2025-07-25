'use client';

import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import RobotManagementGrid from '../../components/RobotManagementGrid';

export default function RobotsPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      theme === 'dark' 
        ? 'bg-gray-900' 
        : 'bg-gray-50'
    }`}>
      <Header />
      <Sidebar activeMenu="robots" />
      
      <main className="ml-64 transition-all duration-200">
        <div className="px-6 py-8">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className={`text-3xl font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              机器人管理
            </h1>
            <p className={`mt-2 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              管理数字员工，查看任务状态，创建自动化任务
            </p>
          </div>

          <RobotManagementGrid />
        </div>
      </main>
    </div>
  );
}