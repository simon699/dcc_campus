'use client';

import { useState, useEffect } from 'react';

interface IntelligentRecommendationProps {
  robots: any[];
}

export default function IntelligentRecommendation({ robots }: IntelligentRecommendationProps) {
  const [recommendation, setRecommendation] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 模拟智能推荐逻辑
    const generateRecommendation = () => {
      const workingRobots = robots.filter(r => r.status === 'working');
      const idleRobots = robots.filter(r => r.status === 'idle');
      
      if (idleRobots.length > 0) {
        setRecommendation({
          type: 'activate',
          robot: idleRobots[0],
          reason: '检测到新的线索数据，建议激活此机器人处理',
          benefit: '预计可提升 40% 的处理效率'
        });
      } else {
        setRecommendation({
          type: 'optimize',
          robot: workingRobots[0],
          reason: '当前工作负载较高，建议优化任务分配',
          benefit: '可减少 25% 的处理时间'
        });
      }
      setIsVisible(true);
    };

    const timer = setTimeout(generateRecommendation, 2000);
    return () => clearTimeout(timer);
  }, [robots]);

  if (!recommendation || !isVisible) return null;

  return (
    <div className="relative overflow-hidden">
      {/* 智能推荐卡片 */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30 shadow-2xl">
        <div className="flex items-center space-x-4">
          {/* AI大脑图标 */}
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-2xl animate-pulse">
              🧠
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-ping opacity-20" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-white font-bold text-lg">AI智能建议</h3>
              <div className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                实时分析
              </div>
            </div>
            
            <p className="text-gray-300 mb-2">{recommendation.reason}</p>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{recommendation.robot.avatar}</span>
                <span className="text-white font-medium">{recommendation.robot.name}</span>
              </div>
              
              <div className="text-green-400 text-sm font-medium">
                💡 {recommendation.benefit}
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg">
              采纳建议
            </button>
            <button 
              onClick={() => setIsVisible(false)}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-all duration-300"
            >
              稍后处理
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}