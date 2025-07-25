'use client';

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import RobotManagementCard from './RobotManagementCard';
import RobotTaskPanel from './RobotTaskPanel';
import AutoTaskCreator from './AutoTaskCreator';

// 机器人数据
const robotsData = [
  {
    id: 1,
    name: "AI外呼",
    status: "空闲",
    description: "智能语音外呼，自动客户联系",
    avatar: "🤖",
    tasks: [
      { id: 101, name: "客户回访", type: "自动", status: "运行中", nextRun: "2024-01-15 14:00", frequency: "每日" },
      { id: 102, name: "新客户外呼", type: "手动", status: "待执行", nextRun: "-", frequency: "-" },
      { id: 103, name: "满意度调研", type: "自动", status: "已完成", nextRun: "2024-01-16 09:00", frequency: "每周" }
    ],
    stats: {
      totalTasks: 15,
      completedTasks: 12,
      runningTasks: 2,
      successRate: 85
    }
  },
  {
    id: 2,
    name: "AI质检",
    status: "工作中",
    description: "智能质量检测，自动审核流程",
    avatar: "🔍",
    tasks: [
      { id: 201, name: "通话质检", type: "自动", status: "运行中", nextRun: "实时", frequency: "实时" },
      { id: 202, name: "服务评分", type: "自动", status: "运行中", nextRun: "实时", frequency: "实时" },
      { id: 203, name: "异常检测", type: "自动", status: "暂停", nextRun: "-", frequency: "每小时" }
    ],
    stats: {
      totalTasks: 8,
      completedTasks: 6,
      runningTasks: 2,
      successRate: 92
    }
  },
  {
    id: 3,
    name: "数字工单",
    status: "空闲",
    description: "自动工单处理，智能分配任务",
    avatar: "📋",
    tasks: [
      { id: 301, name: "工单分类", type: "自动", status: "待执行", nextRun: "2024-01-15 16:00", frequency: "每2小时" },
      { id: 302, name: "优先级排序", type: "自动", status: "运行中", nextRun: "实时", frequency: "实时" },
      { id: 303, name: "自动回复", type: "自动", status: "已完成", nextRun: "2024-01-15 18:00", frequency: "每小时" }
    ],
    stats: {
      totalTasks: 22,
      completedTasks: 18,
      runningTasks: 3,
      successRate: 78
    }
  },
  {
    id: 4,
    name: "AI分析",
    status: "空闲",
    description: "数据智能分析，生成业务洞察",
    avatar: "📊",
    tasks: [
      { id: 401, name: "销售数据分析", type: "自动", status: "已完成", nextRun: "2024-01-16 08:00", frequency: "每日" },
      { id: 402, name: "客户行为分析", type: "自动", status: "运行中", nextRun: "实时", frequency: "每4小时" },
      { id: 403, name: "趋势预测", type: "手动", status: "待执行", nextRun: "-", frequency: "-" }
    ],
    stats: {
      totalTasks: 12,
      completedTasks: 9,
      runningTasks: 2,
      successRate: 88
    }
  }
];

export default function RobotManagementGrid() {
  const { theme } = useTheme();
  const [selectedRobot, setSelectedRobot] = useState(robotsData[0]);
  const [showTaskCreator, setShowTaskCreator] = useState(false);

  const handleRobotSelect = (robot: any) => {
    setSelectedRobot(robot);
  };

  const handleCreateTask = () => {
    setShowTaskCreator(true);
  };

  const handleTaskCreated = (taskData: any) => {
    // 这里后续会连接API
    console.log('创建任务:', taskData);
    setShowTaskCreator(false);
  };

  return (
    <div className="space-y-6">
      {/* 机器人卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {robotsData.map(robot => (
          <RobotManagementCard
            key={robot.id}
            robot={robot}
            isSelected={selectedRobot.id === robot.id}
            onClick={() => handleRobotSelect(robot)}
          />
        ))}
      </div>

      {/* 选中机器人的任务面板 */}
      {selectedRobot && (
        <RobotTaskPanel
          robot={selectedRobot}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* 自动化任务创建器 */}
      {showTaskCreator && (
        <AutoTaskCreator
          robot={selectedRobot}
          isOpen={showTaskCreator}
          onClose={() => setShowTaskCreator(false)}
          onSubmit={handleTaskCreated}
        />
      )}
    </div>
  );
}