'use client';

import { useState, useEffect } from 'react';

interface WorkflowVisualizerProps {
  robots: any[];
  selectedRobot: any;
}

export default function WorkflowVisualizer({ robots, selectedRobot }: WorkflowVisualizerProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [dataFlow, setDataFlow] = useState<any[]>([]);

  // 模拟工作流步骤
  const workflowSteps = [
    {
      id: 1,
      title: "线索数据输入",
      description: "系统接收新的客户线索信息",
      icon: "📥",
      status: "completed",
      data: "125 条新线索"
    },
    {
      id: 2, 
      title: "AI智能分析",
      description: "AI分析师对线索进行质量评估和分类",
      icon: "🧠",
      status: "active",
      robot: robots.find(r => r.name.includes('AI分析')),
      data: "分析中..."
    },
    {
      id: 3,
      title: "自动任务分配",
      description: "根据分析结果自动分配给最适合的机器人",
      icon: "🎯",
      status: "pending",
      data: "等待分析完成"
    },
    {
      id: 4,
      title: "机器人执行",
      description: "AI外呼专家开始执行外呼任务",
      icon: "🤖",
      status: "pending",
      robot: robots.find(r => r.name.includes('AI外呼')),
      data: "准备就绪"
    },
    {
      id: 5,
      title: "质量监控",
      description: "AI质检大师实时监控执行质量",
      icon: "🔍",
      status: "pending",
      robot: robots.find(r => r.name.includes('AI质检')),
      data: "待启动"
    },
    {
      id: 6,
      title: "结果反馈",
      description: "生成执行报告和改进建议",
      icon: "📊",
      status: "pending",
      data: "等待完成"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % workflowSteps.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-gray-700/50">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">智能工作流可视化</h2>
        <p className="text-gray-400">实时展示机器人如何协作处理您的业务</p>
      </div>

      {/* 工作流步骤 */}
      <div className="relative">
        {/* 连接线 */}
        <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-30" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {workflowSteps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';
            
            return (
              <div key={step.id} className="relative">
                {/* 步骤卡片 */}
                <div className={`
                  relative p-4 rounded-xl border transition-all duration-500 transform
                  ${isActive 
                    ? 'bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-blue-500/50 scale-105 shadow-2xl shadow-blue-500/25' 
                    : isCompleted
                    ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30'
                    : 'bg-gradient-to-br from-gray-900/20 to-gray-800/20 border-gray-600/30'
                  }
                `}>
                  {/* 步骤图标 */}
                  <div className="text-center mb-3">
                    <div className={`
                      inline-flex items-center justify-center w-12 h-12 rounded-full text-2xl
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse' 
                        : isCompleted
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-700'
                      }
                    `}>
                      {step.icon}
                    </div>
                  </div>
                  
                  {/* 步骤信息 */}
                  <div className="text-center">
                    <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-gray-400 text-xs mb-2">{step.description}</p>
                    
                    {/* 关联机器人 */}
                    {step.robot && (
                      <div className="flex items-center justify-center space-x-1 mb-2">
                        <span className="text-lg">{step.robot.avatar}</span>
                        <span className="text-xs text-blue-300">{step.robot.name}</span>
                      </div>
                    )}
                    
                    {/* 数据状态 */}
                    <div className={`
                      text-xs px-2 py-1 rounded-full
                      ${isActive 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : isCompleted
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }
                    `}>
                      {step.data}
                    </div>
                  </div>
                  
                  {/* 活动指示器 */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse" />
                  )}
                </div>
                
                {/* 步骤编号 */}
                <div className={`
                  absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' 
                    : isCompleted
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-gray-600 text-gray-300'
                  }
                `}>
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 实时数据流 */}
      <div className="mt-8 p-4 bg-gray-900/30 rounded-xl border border-gray-700/30">
        <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span>实时数据流</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">125</div>
            <div className="text-gray-400">待处理线索</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">89</div>
            <div className="text-gray-400">处理中任务</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">234</div>
            <div className="text-gray-400">今日完成</div>
          </div>
        </div>
      </div>
    </div>
  );
}