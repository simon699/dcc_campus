'use client';

import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../contexts/ThemeContext';

interface TaskStats {
  todayTasks: number;
  overdueTasks: number;
  totalTasks: number;
  completedTasks: number;
  statusDistribution: { name: string; value: number }[];
  typeDistribution: { name: string; value: number }[];
}

export default function TasksDataDashboard({ onViewTasks }: { onViewTasks: () => void }) {
  const { theme } = useTheme();
  const [taskStats, setTaskStats] = useState<TaskStats>({
    todayTasks: 0,
    overdueTasks: 0,
    totalTasks: 0,
    completedTasks: 0,
    statusDistribution: [],
    typeDistribution: []
  });

  // 获取任务统计数据
  const fetchTaskStats = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/tasks/stats', {
        headers: {
          'access-token': accessToken || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTaskStats(data);
      }
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  useEffect(() => {
    fetchTaskStats();
  }, []);

  // 任务状态分布图配置
  const statusChartOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      borderColor: theme === 'dark' ? '#6B7280' : '#E5E7EB',
      textStyle: {
        color: theme === 'dark' ? '#F9FAFB' : '#111827'
      }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: taskStats.statusDistribution,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
      {/* 标题区域 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center space-x-3">
            <span className="text-3xl">📋</span>
            <span>任务数据中心</span>
          </h2>
          <p className="text-gray-400">实时监控任务执行状态，智能分析任务分布</p>
        </div>
        <button
          onClick={onViewTasks}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
        >
          <span>📋</span>
          <span>查看任务列表</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 关键指标卡片 */}
        <div className="space-y-6">
          {/* 今日任务 */}
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📅</span>
                <span className="text-white font-medium">今日任务</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{taskStats.todayTasks}</div>
            <div className="text-xs text-gray-400">个任务</div>
          </div>
          
          {/* 逾期任务 */}
          <div className="bg-gradient-to-br from-red-900/30 to-pink-900/30 rounded-xl p-6 border border-red-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⚠️</span>
                <span className="text-white font-medium">逾期任务</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{taskStats.overdueTasks}</div>
            <div className="text-xs text-gray-400">个任务</div>
          </div>
          
          {/* 总任务数 */}
          <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📊</span>
                <span className="text-white font-medium">总任务数</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">{taskStats.totalTasks}</div>
            <div className="text-xs text-gray-400">个任务</div>
          </div>
        </div>

        {/* 任务状态分布图 */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-6 border border-gray-600/30 h-full">
            <h3 className="text-white font-semibold mb-6 flex items-center space-x-2">
              <span>📈</span>
              <span>任务状态分布</span>
            </h3>
            
            <div className="h-80">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}