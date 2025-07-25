'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactECharts from 'echarts-for-react';

// 线索数据接口
interface Lead {
  id: number;
  customer_level: string;
  created_at: string;
  // 其他字段...
}

interface LeadsData {
  levelDistribution: Array<{
    level: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  recentTrend: Array<{
    date: string;
    value: number;
  }>;
}

export default function LeadsDataDashboard() {
  const router = useRouter();
  const [leadsData, setLeadsData] = useState<LeadsData>({
    levelDistribution: [],
    recentTrend: []
  });
  const [loading, setLoading] = useState(true);

  // 获取线索数据
  const fetchLeadsData = async () => {
    try {
      setLoading(true);
      // 添加获取访问令牌
      const accessToken = localStorage.getItem('access_token');
      
      const response = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '', // 添加访问令牌到请求头
        },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        const leads: Lead[] = data.leads || [];
        
        // 处理客户等级分布
        const levelCounts = leads.reduce((acc, lead) => {
          const level = lead.customer_level || 'N级';
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const levelColors = {
          'H级': '#ef4444',
          'A级': '#f97316', 
          'B级': '#3b82f6',
          'C级': '#10b981',
          'N级': '#6b7280'
        };
        
        const totalLeads = leads.length;
        const levelDistribution = Object.entries(levelCounts).map(([level, count]) => ({
          level,
          count,
          percentage: Math.round((count / totalLeads) * 100),
          color: levelColors[level as keyof typeof levelColors] || '#6b7280'
        }));
        
        // 处理近7日趋势（按创建时间统计）
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date;
        });
        
        const recentTrend = last7Days.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const count = leads.filter(lead => {
            const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
            return leadDate === dateStr;
          }).length;
          
          return {
            date: index === 6 ? '今日' : `${date.getMonth() + 1}-${date.getDate()}`,
            value: count
          };
        });
        
        setLeadsData({
          levelDistribution,
          recentTrend
        });
      } else {
        // 使用模拟数据作为备选
        setLeadsData({
          levelDistribution: [
            { level: 'H级', count: 156, percentage: 35, color: '#ef4444' },
            { level: 'A级', count: 234, percentage: 28, color: '#f97316' },
            { level: 'B级', count: 189, percentage: 22, color: '#3b82f6' },
            { level: 'C级', count: 98, percentage: 12, color: '#10b981' },
            { level: 'N级', count: 45, percentage: 3, color: '#6b7280' }
          ],
          recentTrend: [
            { date: '01-10', value: 45 },
            { date: '01-11', value: 52 },
            { date: '01-12', value: 38 },
            { date: '01-13', value: 61 },
            { date: '01-14', value: 45 },
            { date: '01-15', value: 58 },
            { date: '今日', value: 45 }
          ]
        });
      }
    } catch (error) {
      console.error('获取线索数据失败:', error);
      // 使用模拟数据作为备选
      setLeadsData({
        levelDistribution: [
          { level: 'H级', count: 156, percentage: 35, color: '#ef4444' },
          { level: 'A级', count: 234, percentage: 28, color: '#f97316' },
          { level: 'B级', count: 189, percentage: 22, color: '#3b82f6' },
          { level: 'C级', count: 98, percentage: 12, color: '#10b981' },
          { level: 'N级', count: 45, percentage: 3, color: '#6b7280' }
        ],
        recentTrend: [
          { date: '01-10', value: 45 },
          { date: '01-11', value: 52 },
          { date: '01-12', value: 38 },
          { date: '01-13', value: 61 },
          { date: '01-14', value: 45 },
          { date: '01-15', value: 58 },
          { date: '今日', value: 45 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsData();
  }, []);

  const handleViewLeads = () => {
    router.push('/leads');
  };

  const handleViewTasks = () => {
    router.push('/tasks');
  };

  // ECharts矩形树图配置
  const getTreemapOption = () => {
    const totalCount = leadsData.levelDistribution.reduce((sum, item) => sum + item.count, 0);
    
    const data = leadsData.levelDistribution.map(item => {
      const percentage = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
      
      return {
        name: item.level,
        value: item.count,
        percentage: percentage,
        itemStyle: {
          color: item.color
        }
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: function(params: any) {
          return `${params.name}<br/>数量: ${params.value}条<br/>占比: ${params.data.percentage}%`;
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#60a5fa',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        }
      },
      series: [{
        name: '客户等级分布',
        type: 'treemap',
        data: data,
        roam: false,
        nodeClick: false,
        breadcrumb: {
          show: false
        },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 16,
          fontWeight: 'bold',
          color: '#fff',
          position: 'inside'
        },
        upperLabel: {
          show: false
        },
        itemStyle: {
          borderColor: '#1f2937',
          borderWidth: 2,
          gapWidth: 2
        },
        emphasis: {
          itemStyle: {
            borderColor: '#60a5fa',
            borderWidth: 3
          },
          label: {
            fontSize: 18
          }
        }
      }]
    };
  };

  // 近7日趋势图配置函数
  const getTrendOption = () => {
    const dates = leadsData.recentTrend.map(item => item.date);
    const values = leadsData.recentTrend.map(item => item.value);
    
    return {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: {
          lineStyle: {
            color: '#374151'
          }
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 12
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#9ca3af',
          fontSize: 12
        },
        splitLine: {
          lineStyle: {
            color: '#374151',
            type: 'dashed'
          }
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const data = params[0];
          return `${data.name}<br/>新增线索: ${data.value}条`;
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#60a5fa',
        borderWidth: 1,
        textStyle: {
          color: '#fff'
        }
      },
      series: [{
        name: '新增线索',
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: {
          color: '#60a5fa',
          width: 3
        },
        itemStyle: {
          color: '#60a5fa',
          borderColor: '#1e40af',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0,
              color: 'rgba(96, 165, 250, 0.3)'
            }, {
              offset: 1,
              color: 'rgba(96, 165, 250, 0.05)'
            }]
          }
        },
        symbol: 'circle',
        symbolSize: 8,
        emphasis: {
          itemStyle: {
            color: '#3b82f6',
            borderColor: '#1e40af',
            borderWidth: 3
          },
          scale: true
        }
      }]
    };
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
            <div className="animate-pulse h-80 bg-gray-700 rounded"></div>
          </div>
          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
            <div className="animate-pulse h-80 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 顶部标题和操作按钮区域 */}
      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center space-x-3">
              <span className="text-3xl">📊</span>
              <span>线索数据分析</span>
            </h2>
            <p className="text-gray-400">线索占比分布与新增趋势分析</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleViewTasks}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
              <span>📋</span>
              <span>查看任务列表</span>
            </button>
            <button
              onClick={handleViewLeads}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
              <span>📋</span>
              <span>查看线索列表</span>
            </button>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* 客户等级分布矩形树图 */}
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
          <h3 className="text-white font-semibold mb-6 flex items-center space-x-2">
            <span>🎯</span>
            <span>线索占比分布</span>
          </h3>
          
          {/* ECharts矩形树图 */}
          <div className="h-80 mb-6">
            <ReactECharts 
              option={getTreemapOption()} 
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>

          {/* 图例说明 */}
          <div className="flex flex-wrap gap-4 justify-center">
            {leadsData.levelDistribution.map((level) => (
              <div key={level.level} className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: level.color }}
                />
                <span className="text-gray-300 text-sm">
                  {level.level}: {level.count}条 ({level.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 近7日新增线索趋势 */}
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
          <h3 className="text-white font-semibold mb-6 flex items-center space-x-2">
            <span>📈</span>
            <span>新增线索趋势</span>
          </h3>
          
          <div className="h-80">
            <ReactECharts 
              option={getTrendOption()} 
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}