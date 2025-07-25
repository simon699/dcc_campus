'use client';

import { useTheme } from '../contexts/ThemeContext';

interface RobotManagementCardProps {
  robot: any;
  isSelected: boolean;
  onClick: () => void;
}

export default function RobotManagementCard({ robot, isSelected, onClick }: RobotManagementCardProps) {
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case '工作中':
        return 'text-green-600 bg-green-100';
      case '空闲':
        return 'text-blue-600 bg-blue-100';
      case '离线':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer transition-all duration-200 rounded-xl p-6 border-2 ${
        isSelected
          ? theme === 'dark'
            ? 'border-blue-500 bg-blue-900/20'
            : 'border-blue-500 bg-blue-50'
          : theme === 'dark'
            ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
            : 'border-gray-200 bg-white hover:border-gray-300'
      } hover:shadow-lg`}
    >
      {/* 机器人头像和基本信息 */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="text-3xl">{robot.avatar}</div>
        <div className="flex-1">
          <h3 className={`font-semibold text-lg ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {robot.name}
          </h3>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {robot.description}
          </p>
        </div>
      </div>

      {/* 状态标签 */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          getStatusColor(robot.status)
        }`}>
          {robot.status}
        </span>
        <div className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {robot.stats.runningTasks} 个任务运行中
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <div className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {robot.stats.totalTasks}
          </div>
          <div className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            总任务
          </div>
        </div>
        <div>
          <div className={`text-lg font-semibold text-green-600`}>
            {robot.stats.successRate}%
          </div>
          <div className={`text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            成功率
          </div>
        </div>
      </div>

      {/* 选中指示器 */}
      {isSelected && (
        <div className="mt-4 flex items-center justify-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className={`ml-2 text-xs ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`}>
            已选中
          </span>
        </div>
      )}
    </div>
  );
}