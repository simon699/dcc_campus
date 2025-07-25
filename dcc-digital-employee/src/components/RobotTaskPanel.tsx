'use client';

import { useTheme } from '../contexts/ThemeContext';

interface RobotTaskPanelProps {
  robot: any;
  onCreateTask: () => void;
}

export default function RobotTaskPanel({ robot, onCreateTask }: RobotTaskPanelProps) {
  const { theme } = useTheme();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '运行中':
        return 'bg-green-100 text-green-800 border-green-200';
      case '待执行':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case '已完成':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case '暂停':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === '自动' ? '⚡' : '👤';
  };

  return (
    <div className={`rounded-xl border p-6 ${
      theme === 'dark'
        ? 'border-gray-700 bg-gray-800'
        : 'border-gray-200 bg-white'
    }`}>
      {/* 面板头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{robot.avatar}</div>
          <div>
            <h2 className={`text-xl font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {robot.name} 任务管理
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              共 {robot.tasks.length} 个任务
            </p>
          </div>
        </div>
        <button
          onClick={onCreateTask}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          + 创建自动化任务
        </button>
      </div>

      {/* 任务统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
        }`}>
          <div className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {robot.stats.totalTasks}
          </div>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            总任务数
          </div>
        </div>
        <div className={`p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-green-600">
            {robot.stats.runningTasks}
          </div>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            运行中
          </div>
        </div>
        <div className={`p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-blue-600">
            {robot.stats.completedTasks}
          </div>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            已完成
          </div>
        </div>
        <div className={`p-4 rounded-lg ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
        }`}>
          <div className="text-2xl font-bold text-purple-600">
            {robot.stats.successRate}%
          </div>
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            成功率
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        <h3 className={`text-lg font-medium mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          任务列表
        </h3>
        {robot.tasks.map((task: any) => (
          <div
            key={task.id}
            className={`p-4 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'border-gray-600 bg-gray-700 hover:bg-gray-650'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getTypeIcon(task.type)}</span>
                <div>
                  <h4 className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {task.name}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded text-xs border ${
                      getStatusBadge(task.status)
                    }`}>
                      {task.status}
                    </span>
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {task.type} • {task.frequency}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  下次执行
                </div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {task.nextRun}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}