'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../contexts/ThemeContext';
import { createPortal } from 'react-dom';
import OutboundCallTaskDashboard from '../../../components/OutboundCallTaskDashboard';
import TaskCreationModal from '../../../components/TaskCreationModal';
import TaskExecutionMonitor from '../../../components/TaskExecutionMonitor';

export default function OutboundCallsPage() {
  const { theme } = useTheme();
  const [userName, setUserName] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, monitor, history
  const router = useRouter();

  // 获取用户信息
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUserName(userData.username);
      } else {
        setUserName('Admin');
      }
    } catch (err) {
      console.error('Error parsing user data:', err);
      setUserName('Admin');
    }
  }, [router]);

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  // 更新用户菜单位置
  const updateUserMenuPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setUserMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - 224,
    });
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 动态背景粒子效果 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      {/* 返回按钮 */}
      <div className="absolute top-6 left-6 z-20">
        <button 
          onClick={() => router.back()}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200 text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>返回</span>
        </button>
      </div>
      
      {/* 右上角账号信息 */}
      <div className="absolute top-6 right-6 z-20">
        {userName && (
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
                updateUserMenuPosition(e.currentTarget);
              }}
              className="flex items-center space-x-3 px-4 py-2 rounded-lg backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-200 text-white"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-medium text-white">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{userName}</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      <main className="relative z-10">
        <div className="px-6 py-8">
          {/* 页面标题 */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="text-4xl">🤖</div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI外呼机器人
              </h1>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </div>
            <p className="text-gray-300 text-lg">
              智能外呼任务管理 · 实时监控执行状态 · 数据分析洞察
            </p>
          </div>

          {/* 导航标签 */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-1 p-1 bg-gray-800/50 rounded-xl backdrop-blur-sm border border-gray-700/50">
              {[
                { id: 'dashboard', label: '任务总览', icon: '📊' },
                { id: 'monitor', label: '实时监控', icon: '⚡' },
                { id: 'history', label: '历史记录', icon: '📋' }
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

          {/* 快速操作按钮 */}
          <div className="flex justify-center mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-lg font-semibold">创建新任务</span>
            </button>
          </div>

          {/* 内容区域 */}
          <div className="space-y-8">
            {activeTab === 'dashboard' && <OutboundCallTaskDashboard />}
            {activeTab === 'monitor' && <TaskExecutionMonitor />}
            {activeTab === 'history' && <OutboundCallTaskDashboard showHistory={true} />}
          </div>
        </div>
      </main>

      {/* 任务创建模态框 */}
      {showCreateModal && (
        <TaskCreationModal 
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={() => {
            setShowCreateModal(false);
            // 刷新任务列表
          }}
        />
      )}

      {/* 用户菜单下拉框 */}
      {mounted && showUserMenu && createPortal(
        <div 
          className="fixed w-56 rounded-lg shadow-lg border backdrop-blur-sm bg-gray-900/90 border-gray-700 z-[9999] animate-slide-down"
          style={{
            top: `${userMenuPosition.top}px`,
            left: `${userMenuPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="text-sm font-medium text-white">
              {userName}
            </div>
            <div className="text-xs text-gray-400">
              管理员权限
            </div>
          </div>
          <div className="py-1">
            <button
              onClick={handleLogout}
              className="flex items-center w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出登录
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}