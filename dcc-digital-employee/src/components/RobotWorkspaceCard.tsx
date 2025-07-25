'use client';

import { useState, useEffect } from 'react';

interface RobotWorkspaceCardProps {
  robot: any;
  isSelected: boolean;
  onClick: () => void;
}

export default function RobotWorkspaceCard({ robot, isSelected, onClick }: RobotWorkspaceCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 3);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'working':
        return {
          color: 'from-green-400 to-emerald-500',
          bgColor: 'from-green-900/20 to-emerald-900/20',
          text: '工作中',
          icon: '⚡',
          pulse: true
        };
      case 'learning':
        return {
          color: 'from-blue-400 to-cyan-500',
          bgColor: 'from-blue-900/20 to-cyan-900/20', 
          text: '学习中',
          icon: '🧠',
          pulse: true
        };
      default:
        return {
          color: 'from-gray-400 to-gray-500',
          bgColor: 'from-gray-900/20 to-gray-800/20',
          text: '待命中',
          icon: '💤',
          pulse: false
        };
    }
  };

  const statusConfig = getStatusConfig(robot.status);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative cursor-pointer transition-all duration-500 transform
        ${isSelected ? 'scale-105 z-10' : 'hover:scale-102'}
        ${isHovered ? 'translate-y-[-8px]' : ''}
      `}
    >
      {/* 发光边框效果 */}
      <div className={`
        absolute inset-0 rounded-2xl transition-all duration-500
        ${isSelected 
          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 shadow-2xl shadow-blue-500/25' 
          : 'bg-gradient-to-r from-gray-800/50 to-gray-700/50'
        }
        ${statusConfig.pulse ? 'animate-pulse' : ''}
      `} />
      
      {/* 主卡片 */}
      <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
        {/* 机器人头像和状态 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="text-4xl transform transition-transform duration-300 hover:scale-110">
                {robot.avatar}
              </div>
              {/* 状态指示器 */}
              <div className={`
                absolute -bottom-1 -right-1 w-4 h-4 rounded-full
                bg-gradient-to-r ${statusConfig.color}
                ${statusConfig.pulse ? 'animate-pulse' : ''}
                flex items-center justify-center text-xs
              `}>
                {statusConfig.icon}
              </div>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{robot.name}</h3>
              <p className="text-gray-400 text-sm">{robot.role}</p>
            </div>
          </div>
          
          {/* AI能力等级 */}
          <div className="text-right">
            <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              {robot.aiLevel}%
            </div>
            <div className="text-xs text-gray-400">AI能力</div>
          </div>
        </div>

        {/* 当前工作状态 */}
        <div className={`
          p-4 rounded-xl mb-4 border transition-all duration-300
          bg-gradient-to-r ${statusConfig.bgColor}
          border-gray-600/50
        `}>
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`} />
            <span className="text-white font-medium text-sm">{statusConfig.text}</span>
          </div>
          <p className="text-gray-300 text-sm">{robot.workingOn}</p>
        </div>

        {/* 今日成就 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.entries(robot.todayAchievement).map(([key, value], index) => (
            <div key={key} className="text-center">
              <div className="text-lg font-bold text-white">{String(value)}</div>
              <div className="text-xs text-gray-400 capitalize">
                {key === 'calls' ? '外呼' : 
                 key === 'connected' ? '接通' :
                 key === 'appointments' ? '预约' :
                 key === 'efficiency' ? '效率' :
                 key === 'analyzed' ? '分析' :
                 key === 'issues' ? '问题' :
                 key === 'suggestions' ? '建议' :
                 key === 'processed' ? '处理' :
                 key === 'automated' ? '自动化' :
                 key === 'saved' ? '节省' :
                 key === 'reports' ? '报告' :
                 key === 'insights' ? '洞察' :
                 key === 'predictions' ? '预测' : key}
              </div>
            </div>
          ))}
        </div>

        {/* 学习进度 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-sm">学习进度</span>
            <span className="text-white text-sm">{robot.learningProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${robot.learningProgress}%` }}
            />
          </div>
        </div>

        {/* 下一步行动 */}
        <div className="text-gray-300 text-sm bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <span className="text-blue-400">🎯</span>
            <span>{robot.nextAction}</span>
          </div>
        </div>

        {/* 悬浮时显示技能标签 */}
        {isHovered && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-gray-900 to-transparent rounded-b-2xl">
            <div className="flex flex-wrap gap-2">
              {robot.skills.map((skill: string, index: number) => (
                <span 
                  key={skill}
                  className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}