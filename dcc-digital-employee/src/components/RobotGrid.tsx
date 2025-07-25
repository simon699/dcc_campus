'use client';

import { useState } from 'react';
import RobotCard from './RobotCard';
import TaskSidebar from './TaskSidebar';

// Robot data
const initialRobots = [
  {
    id: 1,
    name: "AI外呼",
    status: "空闲",
    tasks: [
      { id: 101, name: "数据分析", type: "未开始", time: "每日09:00" },
      { id: 102, name: "报告生成", type: "未开始", time: "每周一12:00" }
    ]
  },
  {
    id: 2,
    name: "AI质检",
    status: "工作中",
    tasks: [
      { id: 201, name: "客户支持", type: "进行中", time: "24/7" },
      { id: 202, name: "数据备份", type: "未开始", time: "每日03:00" }
    ]
  },
  {
    id: 3,
    name: "数字工单",
    status: "空闲",
    tasks: [
      { id: 301, name: "系统监控", type: "未开始", time: "每小时" },
      { id: 302, name: "自动报告", type: "未开始", time: "每日18:00" },
      { id: 303, name: "数据同步", type: "未开始", time: "每3小时" }
    ]
  },
  {
    id: 4,
    name: "AI分析",
    status: "空闲",
    tasks: [
      { id: 401, name: "数据分析", type: "未开始", time: "每小时" },
      { id: 402, name: "结果输出", type: "未开始", time: "每日22:00" }
    ]
  }
];

export default function RobotGrid() {
  const [robots, setRobots] = useState(initialRobots);
  const [selectedRobot, setSelectedRobot] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleCardClick = (robot: any) => {
    setSelectedRobot(robot);
    setIsSidebarOpen(true);
  };

  const handleAddTask = (robotId: number, task: any) => {
    setRobots(prevRobots => {
      return prevRobots.map(robot => {
        if (robot.id === robotId) {
          return {
            ...robot,
            tasks: [...robot.tasks, { ...task, id: Date.now() }],
            status: "工作中" // Update status when a new task is added
          };
        }
        return robot;
      });
    });
    setIsSidebarOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            数字员工
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            管理和监控您的数字员工状态
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {robots.length} 个数字员工
        </div>
      </div>

      {/* Robot Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {robots.map(robot => (
          <RobotCard 
            key={robot.id}
            robot={robot}
            onClick={() => handleCardClick(robot)}
          />
        ))}
      </div>
      
      {selectedRobot && (
        <TaskSidebar
          robot={selectedRobot}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onAddTask={(task) => handleAddTask(selectedRobot.id, task)}
        />
      )}
    </div>
  );
} 