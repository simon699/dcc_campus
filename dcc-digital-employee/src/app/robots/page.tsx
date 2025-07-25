'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../contexts/ThemeContext';
import { createPortal } from 'react-dom';
import IntelligentRobotWorkspace from '../../components/IntelligentRobotWorkspace';

// 添加线索统计卡片组件
function LeadsStatsCards() {
  const router = useRouter();
  const [leadsStats, setLeadsStats] = useState({
    todayPending: 0,
    overdue: 0,
    totalLeads: 0
  });
  const [animatedValues, setAnimatedValues] = useState({
    todayPending: 0,
    overdue: 0,
    totalLeads: 0
  });

  // 获取线索统计数据
  const fetchLeadsStats = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      
      // 获取今日待跟进线索
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const todayPendingResponse = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          page: 1,
          page_size: 1000,
          next_follow_time_start: `${todayStr} 00:00:00`,
          next_follow_time_end: `${todayStr} 23:59:59`,
        }),
      });
      
      // 获取逾期线索
      const overdueResponse = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          page: 1,
          page_size: 1000,
          next_follow_time_end: `${todayStr} 00:00:00`,
        }),
      });
      
      // 获取总线索数
      const totalResponse = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          page: 1,
          page_size: 1,
        }),
      });
      
      const todayData = await todayPendingResponse.json();
      const overdueData = await overdueResponse.json();
      const totalData = await totalResponse.json();
      
      const stats = {
        todayPending: todayData?.data?.total_count || 0,
        overdue: overdueData?.data?.total_count || 0,
        totalLeads: totalData?.data?.total_count || 0
      };
      
      setLeadsStats(stats);
      
      // 动画效果
      const duration = 1500;
      const steps = 60;
      const stepDuration = duration / steps;
      
      for (let i = 0; i <= steps; i++) {
        setTimeout(() => {
          const progress = i / steps;
          setAnimatedValues({
            todayPending: Math.floor(stats.todayPending * progress),
            overdue: Math.floor(stats.overdue * progress),
            totalLeads: Math.floor(stats.totalLeads * progress)
          });
        }, i * stepDuration);
      }
      
    } catch (error) {
      console.error('获取线索统计失败:', error);
      // 使用模拟数据
      const mockStats = {
        todayPending: 23,
        overdue: 8,
        totalLeads: 156
      };
      setLeadsStats(mockStats);
      setAnimatedValues(mockStats);
    }
  };

  useEffect(() => {
    fetchLeadsStats();
  }, []);

  // 处理卡片点击事件
  const handleCardClick = (type: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (type) {
      case 'todayPending':
        // 今日待跟进：下次跟进时间在今天
        router.push(`/leads?nextFollowTimeStart=${todayStr}&nextFollowTimeEnd=${todayStr}`);
        break;
      case 'overdue':
        // 逾期线索：下次跟进时间早于今天
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        router.push(`/leads?nextFollowTimeEnd=${yesterdayStr}`);
        break;
      case 'totalLeads':
        // 总线索：不带任何筛选条件
        router.push('/leads');
        break;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* 今日待跟进 */}
      <div 
        onClick={() => handleCardClick('todayPending')}
        className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-xl p-6 border border-blue-500/30 backdrop-blur-xl cursor-pointer hover:from-blue-800/40 hover:to-cyan-800/40 transition-all duration-300 hover:scale-105 hover:shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-xl">
              📅
            </div>
            <div>
              <h3 className="text-white font-semibold">今日待跟进</h3>
              <p className="text-gray-400 text-sm">需要及时处理</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-400">{animatedValues.todayPending}</div>
            <div className="text-xs text-gray-400">条线索</div>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-1000" style={{ width: '75%' }} />
        </div>
        <div className="mt-3 text-xs text-blue-300 opacity-75">点击查看详情 →</div>
      </div>

      {/* 逾期线索 */}
      <div 
        onClick={() => handleCardClick('overdue')}
        className="bg-gradient-to-br from-red-900/30 to-pink-900/30 rounded-xl p-6 border border-red-500/30 backdrop-blur-xl cursor-pointer hover:from-red-800/40 hover:to-pink-800/40 transition-all duration-300 hover:scale-105 hover:shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-xl animate-pulse">
              ⚠️
            </div>
            <div>
              <h3 className="text-white font-semibold">逾期线索</h3>
              <p className="text-gray-400 text-sm">需要紧急处理</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-red-400">{animatedValues.overdue}</div>
            <div className="text-xs text-gray-400">条线索</div>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full transition-all duration-1000 animate-pulse" style={{ width: '25%' }} />
        </div>
        <div className="mt-3 text-xs text-red-300 opacity-75">点击查看详情 →</div>
      </div>

      {/* 总线索数 */}
      <div 
        onClick={() => handleCardClick('totalLeads')}
        className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-500/30 backdrop-blur-xl cursor-pointer hover:from-purple-800/40 hover:to-indigo-800/40 transition-all duration-300 hover:scale-105 hover:shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-xl">
              📈
            </div>
            <div>
              <h3 className="text-white font-semibold">总线索数</h3>
              <p className="text-gray-400 text-sm">累计管理</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-400">{animatedValues.totalLeads}</div>
            <div className="text-xs text-gray-400">条线索</div>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: '90%' }} />
        </div>
        <div className="mt-3 text-xs text-purple-300 opacity-75">点击查看详情 →</div>
      </div>
    </div>
  );
}

export default function RobotsPage() {
  const { theme } = useTheme();
  const [userName, setUserName] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
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
          {/* 智能化页面标题 */}
          <div className="mb-12 text-center">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                智能工作伙伴
              </h1>
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse delay-500" />
            </div>
            <p className="text-gray-300 text-lg">
              让AI机器人成为您的得力助手，自动化处理繁重工作
            </p>
          </div>

           {/* 线索统计卡片 */}
          <LeadsStatsCards />

          <IntelligentRobotWorkspace />

         

          
        </div>
      </main>

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