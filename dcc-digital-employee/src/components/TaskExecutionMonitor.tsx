'use client';

import { useState, useEffect } from 'react';

export default function TaskExecutionMonitor() {
  const [realTimeData, setRealTimeData] = useState({
    currentCalls: 12,
    queuedCalls: 45,
    successfulCalls: 156,
    failedCalls: 23,
    avgResponseTime: '1.2s',
    currentSuccessRate: 87.2
  });

  const [callLogs, setCallLogs] = useState([
    { id: 1, phone: '138****1234', status: 'success', duration: '2:34', time: '14:23:45', result: '已预约' },
    { id: 2, phone: '139****5678', status: 'failed', duration: '0:15', time: '14:22:30', result: '无人接听' },
    { id: 3, phone: '137****9012', status: 'success', duration: '3:12', time: '14:21:15', result: '感兴趣' },
    { id: 4, phone: '136****3456', status: 'busy', duration: '0:08', time: '14:20:00', result: '占线' },
    { id: 5, phone: '135****7890', status: 'success', duration: '1:45', time: '14:18:45', result: '已记录' }
  ]);

  // 模拟实时数据更新
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        ...prev,
        currentCalls: Math.floor(Math.random() * 20) + 5,
        successfulCalls: prev.successfulCalls + Math.floor(Math.random() * 3),
        currentSuccessRate: Math.random() * 20 + 80
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getCallStatusConfig = (status: string) => {
    switch (status) {
      case 'success':
        return { color: 'text-green-400', bg: 'bg-green-900/20', icon: '✅' };
      case 'failed':
        return { color: 'text-red-400', bg: 'bg-red-900/20', icon: '❌' };
      case 'busy':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', icon: '📞' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/20', icon: '❓' };
    }
  };

  return (
    <div className="space-y-8">
      {/* 实时状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {[
          { label: '当前外呼', value: realTimeData.currentCalls, icon: '📞', color: 'from-blue-500 to-cyan-500', pulse: true },
          { label: '队列等待', value: realTimeData.queuedCalls, icon: '⏳', color: 'from-yellow-500 to-orange-500' },
          { label: '成功外呼', value: realTimeData.successfulCalls, icon: '✅', color: 'from-green-500 to-emerald-500' },
          { label: '失败外呼', value: realTimeData.failedCalls, icon: '❌', color: 'from-red-500 to-pink-500' },
          { label: '响应时间', value: realTimeData.avgResponseTime, icon: '⚡', color: 'from-purple-500 to-indigo-500' },
          { label: '实时成功率', value: `${realTimeData.currentSuccessRate.toFixed(1)}%`, icon: '🎯', color: 'from-teal-500 to-cyan-500' }
        ].map((stat, index) => (
          <div key={index} className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 ${stat.pulse ? 'animate-pulse' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl">{stat.icon}</div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.color} opacity-20`} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 实时外呼日志 */}
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>📊</span>
              <span>实时外呼日志</span>
            </h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm">实时更新</span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {callLogs.map((log) => {
              const statusConfig = getCallStatusConfig(log.status);
              
              return (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full ${statusConfig.bg} flex items-center justify-center`}>
                      <span className="text-lg">{statusConfig.icon}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium">{log.phone}</div>
                      <div className="text-gray-400 text-sm">{log.time}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-white font-medium">{log.duration}</div>
                      <div className="text-gray-400 text-xs">通话时长</div>
                    </div>
                    <div className="text-center">
                      <div className={`${statusConfig.color} font-medium`}>{log.result}</div>
                      <div className="text-gray-400 text-xs">结果</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 性能图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 成功率趋势 */}
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
            <span>📈</span>
            <span>成功率趋势</span>
          </h3>
          <div className="h-48 flex items-end justify-between space-x-2">
            {[85, 87, 82, 89, 91, 88, 87, 90, 92, 89, 87, 90].map((value, index) => (
              <div key={index} className="flex-1 bg-gradient-to-t from-blue-600 to-purple-600 rounded-t" style={{ height: `${value}%` }} />
            ))}
          </div>
        </div>
        
        {/* 外呼量统计 */}
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
            <span>📊</span>
            <span>外呼量统计</span>
          </h3>
          <div className="h-48 flex items-end justify-between space-x-2">
            {[120, 135, 98, 156, 142, 167, 134, 189, 176, 145, 158, 167].map((value, index) => (
              <div key={index} className="flex-1 bg-gradient-to-t from-green-600 to-emerald-600 rounded-t" style={{ height: `${(value / 200) * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}