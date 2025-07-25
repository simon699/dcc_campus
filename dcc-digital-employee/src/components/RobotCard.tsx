'use client';

import { useTheme } from '../contexts/ThemeContext';
import Image from 'next/image';

type Robot = {
  id: number;
  name: string;
  status: string;
  tasks: Array<{
    id: number;
    name: string;
    type: string;
    time: string;
  }>;
};

type RobotCardProps = {
  robot: Robot;
  onClick: () => void;
};

export default function RobotCard({ robot, onClick }: RobotCardProps) {
  const { theme } = useTheme();
  const isWorking = robot.status === "工作中";

  // Get a GIF based on the robot ID to ensure different robots have different GIFs
  const getGifPath = () => {
    // Map robot IDs to available GIF files in the images directory
    const gifMap: Record<number, string> = {
      2: "/images/57_1744861126.gif",
      4: "/images/58_1744861127.gif",
      3: "/images/59_1744861127.gif",
      1: "/images/60_1744861128.gif"
    };
    
    // Return the GIF path for this robot, or default to the first one
    return gifMap[robot.id] || "/images/51_1744852109.gif";
  };

  const getStatusBadge = () => {
    if (isWorking) {
      return 'badge-info';
    }
    return 'badge-success';
  };

  const getTaskStatusBadge = (taskType: string) => {
    const badges = {
      '进行中': 'badge-info',
      '未开始': 'badge-warning',
      '已完成': 'badge-success'
    };
    return badges[taskType as keyof typeof badges] || 'badge-gray';
  };

  return (
    <div 
      className="saas-card cursor-pointer hover:shadow-md transition-all duration-200 group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {/* Robot Icon */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-lg ${
              isWorking 
                ? 'bg-blue-100 dark:bg-blue-900/20' 
                : 'bg-green-100 dark:bg-green-900/20'
            }`}></div>
            <Image 
              src={getGifPath()} 
              alt={`Robot ${robot.name}`}
              width={64}
              height={64}
              className="rounded-lg relative z-10"
            />
          </div>
          
          <div className="ml-4">
            <h3 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {robot.name}
            </h3>
            <div className={`text-sm mt-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              机器人 #{robot.id.toString().padStart(3, '0')}
            </div>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`badge ${getStatusBadge()}`}>
          <div className={`status-dot mr-1.5 ${
            isWorking ? 'status-dot-busy' : 'status-dot-idle'
          }`}></div>
          {robot.status}
        </div>
      </div>
      
      {/* Divider */}
      <div className={`border-t mb-4 ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}></div>
      
      {/* Task Queue Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className={`text-sm font-medium ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            任务队列
          </h4>
          <span className={`text-xs px-2 py-1 rounded-full ${
            theme === 'dark' 
              ? 'bg-gray-700 text-gray-300' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {robot.tasks.length} 个任务
          </span>
        </div>
        
        <div className="space-y-2">
          {robot.tasks.slice(0, 3).map(task => (
            <div key={task.id} className={`flex justify-between items-center p-3 rounded-lg ${
              theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
            }`}>
              <div className={`truncate flex-1 text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {task.name}
              </div>
              <div className={`badge ml-3 ${getTaskStatusBadge(task.type)}`}>
                {task.type}
              </div>
            </div>
          ))}
          
          {robot.tasks.length > 3 && (
            <div className={`text-center text-xs pt-2 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              还有 {robot.tasks.length - 3} 个任务...
            </div>
          )}
          
          {robot.tasks.length === 0 && (
            <div className={`text-center text-sm py-4 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              暂无任务
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 