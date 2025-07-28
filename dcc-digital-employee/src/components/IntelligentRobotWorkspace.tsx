'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import RobotWorkspaceCard from './RobotWorkspaceCard';
import WorkflowVisualizer from './WorkflowVisualizer';
import LeadsDataDashboard from './LeadsDataDashboard';
import { useRouter } from 'next/navigation';

// 重新定义机器人数据结构，突出智能化能力
const intelligentRobots = [
  {
    id: 1,
    name: "AI外呼专家",
    role: "客户触达专家",
    avatar: "🤖",
    status: "working", // working, idle, learning
    capability: "智能语音交互",
    description: "24小时不间断客户外呼，智能识别客户意图，自动记录通话要点",
    aiLevel: 95,
    workingOn: "正在为您外呼 15 位潜在客户",
    todayAchievement: {
      calls: 156,
      connected: 89,
      appointments: 12,
      efficiency: "比人工快 300%"
    },
    skills: ["语音识别", "情感分析", "意图理解", "自动记录"],
    nextAction: "预计 2 小时内完成今日外呼任务",
    learningProgress: 85
  },
  {
    id: 2,
    name: "AI质检大师",
    role: "质量保障专家", 
    avatar: "🔍",
    status: "working",
    capability: "智能质量分析",
    description: "实时监控服务质量，智能识别问题，自动生成改进建议",
    aiLevel: 92,
    workingOn: "正在分析 234 通通话质量",
    todayAchievement: {
      analyzed: 234,
      issues: 8,
      suggestions: 15,
      efficiency: "准确率 98.5%"
    },
    skills: ["质量分析", "问题识别", "改进建议", "实时监控"],
    nextAction: "发现 3 个服务改进点，正在生成报告",
    learningProgress: 92
  },
  {
    id: 3,
    name: "数字工单助手",
    role: "流程自动化专家",
    avatar: "📋",
    status: "idle",
    capability: "智能工单处理",
    description: "自动分类工单，智能分配任务，预测处理时间，优化工作流程",
    aiLevel: 88,
    workingOn: "待命中，随时准备处理新工单",
    todayAchievement: {
      processed: 67,
      automated: 52,
      saved: "3.2小时",
      efficiency: "自动化率 77%"
    },
    skills: ["智能分类", "自动分配", "时间预测", "流程优化"],
    nextAction: "学习新的工单处理模式",
    learningProgress: 78
  },
  {
    id: 4,
    name: "AI分析师",
    role: "商业洞察专家",
    avatar: "📊",
    status: "learning",
    capability: "深度数据洞察",
    description: "深度分析业务数据，发现隐藏趋势，预测市场变化，生成战略建议",
    aiLevel: 90,
    workingOn: "正在学习最新市场数据模式",
    todayAchievement: {
      reports: 5,
      insights: 23,
      predictions: 8,
      efficiency: "洞察准确率 94%"
    },
    skills: ["趋势分析", "预测建模", "洞察发现", "报告生成"],
    nextAction: "完成学习后将生成本周市场分析报告",
    learningProgress: 65
  }
];

export default function IntelligentRobotWorkspace() {
  const [selectedRobot, setSelectedRobot] = useState(intelligentRobots[0]);
  const [workflowView, setWorkflowView] = useState(false);
  const router = useRouter();

  // 处理机器人点击事件
  const handleRobotClick = (robot: any) => {
    if (robot.id === 1) { // AI外呼专家
      router.push('/robots/outbound-calls');
    } else {
      setSelectedRobot(robot);
    }
  };

  return (
    <div className="space-y-8">
      {/* 机器人工作台 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {intelligentRobots.map(robot => (
          <RobotWorkspaceCard
            key={robot.id}
            robot={robot}
            isSelected={selectedRobot.id === robot.id}
            onClick={() => handleRobotClick(robot)}
          />
        ))}
      </div>

      {/* 线索数据仪表板 */}
      <LeadsDataDashboard />

      {/* 工作流可视化切换 */}
      <div className="flex justify-center">
        <button
          onClick={() => setWorkflowView(!workflowView)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          {workflowView ? '返回机器人视图' : '查看智能工作流'}
        </button>
      </div>

      {/* 工作流可视化 */}
      {workflowView && (
        <WorkflowVisualizer 
          robots={intelligentRobots}
          selectedRobot={selectedRobot}
        />
      )}
    </div>
  );
}