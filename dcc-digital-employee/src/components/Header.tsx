'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UnbindConfirmModal from './UnbindConfirmModal';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showUnbindModal, setShowUnbindModal] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const handleUnbind = () => {
    setShowUnbindModal(true);
    setIsDropdownOpen(false);
  };

  const handleUnbindConfirm = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/dcc/disassociate', {
        method: 'DELETE',
        headers: {
          'access-token': accessToken || '',
        },
      });

      if (!response.ok) {
        throw new Error('解绑失败');
      }

      const result = await response.json();

      if (result.status === 'success') {
        // 更新本地存储的用户信息
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.dcc_user = null;
          localStorage.setItem('user', JSON.stringify(user));
          setUser(user);
        }

        // 设置需要重新绑定的标记
        sessionStorage.setItem('needBindDcc', 'true');
        
        // 关闭弹窗
        setShowUnbindModal(false);
        
        // 刷新页面以显示绑定弹窗
        window.location.reload();
      } else {
        throw new Error(result.message || '解绑失败');
      }
    } catch (err) {
      console.error('Unbind error:', err);
      alert('解绑失败，请重试');
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/10 border-b border-white/20">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">
              DCC 数字员工
            </h1>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* User menu */}
            <div className="relative">
              <button 
                onClick={toggleDropdown}
                className="flex items-center space-x-2 p-2 rounded-lg transition-colors duration-200 text-gray-300 hover:text-white hover:bg-white/10"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {user?.username || '用户'}
                </span>
                <svg className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-1 backdrop-blur-xl bg-white/10 border border-white/20">
                  {/* DCC账号信息 */}
                  {user?.dcc_user && (
                    <div className="px-4 py-3 border-b border-white/10">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-xs text-gray-400">DCC账号</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-300 truncate">
                          {user.dcc_user}
                        </span>
                        <button
                          onClick={handleUnbind}
                          className="ml-2 px-2 py-1 text-xs bg-red-600/50 hover:bg-red-500/50 text-red-200 hover:text-white rounded transition-colors duration-200"
                        >
                          解绑
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* 用户信息 */}
                  <div className="px-4 py-2 border-b border-white/10">
                    <div className="text-xs text-gray-400 mb-1">用户名</div>
                    <div className="text-sm font-medium text-white">
                      {user?.username || '未知用户'}
                    </div>
                  </div>
                  
                  {/* 退出登录 */}
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm transition-colors duration-200 text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 解绑确认弹窗 */}
      <UnbindConfirmModal
        isOpen={showUnbindModal}
        onClose={() => setShowUnbindModal(false)}
        onConfirm={handleUnbindConfirm}
        dccUser={user?.dcc_user || ''}
      />
    </header>
  );
} 