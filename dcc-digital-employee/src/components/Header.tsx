'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import { createPortal } from 'react-dom';

export default function Header() {
  const [systemStatus, setSystemStatus] = useState('在线');
  const [userName, setUserName] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  
  // 获取用户信息
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUserName(userData.username);
      } else {
        // 设置默认用户名用于演示，实际项目中可以重定向到登录页
        setUserName('Admin');
        // router.push('/login');
      }
    } catch (err) {
      console.error('Error parsing user data:', err);
      // 设置默认用户名
      setUserName('Admin');
    }
  }, [router]);
  
  // 获取系统安全状态
  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/health');
        if (response.ok) {
          const data = await response.json();
          
          // 根据状态设置显示
          if (data.status === 'ok') {
            setSystemStatus('在线');
          } else {
            setSystemStatus('离线');
          }
        } else {
          setSystemStatus('在线');
        }
      } catch (error) {
        setSystemStatus('在线');
      }
    };

    // 首次加载时获取状态
    fetchSystemStatus();
    
    // 设置定时器，每30秒更新一次状态
    const intervalId = setInterval(fetchSystemStatus, 30000);
    
    // 组件卸载时清除定时器
    return () => clearInterval(intervalId);
  }, []);
  
  // 处理退出登录
  const handleLogout = () => {
    // 清除用户信息
    localStorage.removeItem('user');
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // 重定向到登录页
    router.push('/login');
  };

  // 更新用户菜单位置
  const updateUserMenuPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setUserMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - 224, // 224px 是菜单的宽度
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className={`border-b transition-colors duration-200 ${
      theme === 'dark' 
        ? 'bg-gray-900 border-gray-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-end items-center">
          {/* Right side - Status and User */}
          <div className="flex items-center space-x-4">
            {/* System Status */}
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                系统状态:
              </span>
              <div className="flex items-center space-x-1.5">
                <span className={`text-sm font-medium ${
                  systemStatus === '在线' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {systemStatus}
                </span>
                <div className={`status-dot ${
                  systemStatus === '在线' ? 'status-dot-online' : 'status-dot-offline'
                }`}></div>
              </div>
            </div>
            
            {/* User Menu */}
            {userName && (
              <div className="relative">
                <button 
                  onClick={(e) => {
                    setShowUserMenu(!showUserMenu);
                    updateUserMenuPosition(e.currentTarget);
                  }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'hover:bg-gray-800 text-gray-300 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium text-white">
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
        </div>
      </div>
      
      {/* Notification */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-slide-down">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-medium">服务异常，请稍候重试</span>
          </div>
        </div>
      )}

      {/* User Menu Dropdown */}
      {mounted && showUserMenu && createPortal(
        <div 
          className={`fixed w-56 rounded-lg shadow-lg border z-[9999] animate-slide-down ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}
          style={{
            top: `${userMenuPosition.top}px`,
            left: `${userMenuPosition.left}px`,
          }}
        >
          <div className={`px-4 py-3 border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {userName}
            </div>
            <div className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              管理员权限
            </div>
          </div>
          <div className="py-1">
            <button
              onClick={handleLogout}
              className={`flex items-center w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                theme === 'dark' 
                  ? 'text-red-400 hover:bg-gray-700' 
                  : 'text-red-600 hover:bg-gray-50'
              }`}
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
    </header>
  );
}