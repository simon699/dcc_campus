'use client';

import Image from 'next/image';

// 步骤类型定义
export type StepType = 'initiate' | 'analyze' | 'call' | 'report';

export interface Step {
  id: StepType;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface WorkflowStepsProps {
  steps: Step[];
  currentStep: StepType;
  stepProgress: Record<StepType, number>;
  dataFlowStats: {
    pendingLeads: number;
    processingTasks: number;
    completedToday: number;
  };
  hasAnalysisResults: boolean;
  selectedAnalysisResult: any;
  hasInitiatedAnalysis: boolean;
  hasCallResults: boolean;
  onStepChange: (stepId: StepType) => void;
}

export default function WorkflowSteps({
  steps,
  currentStep,
  stepProgress,
  dataFlowStats,
  hasAnalysisResults,
  selectedAnalysisResult,
  hasInitiatedAnalysis,
  hasCallResults,
  onStepChange
}: WorkflowStepsProps) {
  // 获取步骤数据状态
  const getStepData = (stepId: StepType) => {
    switch (stepId) {
      case 'initiate':
        return stepProgress[stepId] === 100 ? '配置完成' : '等待配置';
      case 'analyze':
        if (currentStep === stepId) {
          return stepProgress[stepId] < 100 ? `分析中 ${stepProgress[stepId]}%` : '分析完成';
        }
        return stepProgress[stepId] === 100 ? '分析完成' : '等待分析';
      case 'call':
        if (currentStep === stepId) {
          return stepProgress[stepId] < 100 ? `外呼中 ${stepProgress[stepId]}%` : '外呼完成';
        }
        return stepProgress[stepId] === 100 ? '外呼完成' : '等待外呼';
      case 'report':
        return stepProgress[stepId] === 100 ? '报告生成' : '等待生成';
      default:
        return '准备就绪';
    }
  };

  return (
    <div className="w-1/4">
      {/* AI动画 */}
      <div className="ai-animation-container">
        <div className="flex items-center space-x-3">
          <div className="ai-animation">
            <div className="relative z-10 w-8 h-8 rounded-full overflow-hidden">
              <Image
                src="/images/51_1744852109.gif"
                alt="AI助手"
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              DCC 数字员工
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = step.status === 'completed';
          const progress = stepProgress[step.id];
          
          return (
            <div
              key={step.id}
              className={`step-connector ${
                isActive ? 'active' : ''
              } ${isCompleted ? 'completed' : ''}`}
            >
              {/* 数据流动画 */}
              {isActive && <div className="data-flow" />}
                              <div
                  className={`workflow-step-card ${
                    isActive ? 'active' : ''
                  } ${isCompleted ? 'completed' : 'pending'}`}
                  onClick={() => onStepChange(step.id)}
                  style={{
                    cursor: (() => {
                                          // 检查是否允许点击
                    if (step.id === 'analyze') {
                      return (currentStep === 'initiate' && hasInitiatedAnalysis) || hasAnalysisResults ? 'pointer' : 'not-allowed';
                    }
                    if (step.id === 'call') {
                      return (hasAnalysisResults && selectedAnalysisResult) ? 'pointer' : 'not-allowed';
                    }
                    if (step.id === 'report') {
                      return (hasAnalysisResults && selectedAnalysisResult && hasCallResults) ? 'pointer' : 'not-allowed';
                    }
                    return 'pointer';
                    })(),
                    opacity: (() => {
                      // 检查是否禁用
                      if (step.id === 'analyze') {
                        return (currentStep === 'initiate' && !hasInitiatedAnalysis) ? 0.5 : 1;
                      }
                      if (step.id === 'call') {
                        return (!hasAnalysisResults || !selectedAnalysisResult) ? 0.5 : 1;
                      }
                      if (step.id === 'report') {
                        return (!hasAnalysisResults || !selectedAnalysisResult || !hasCallResults) ? 0.5 : 1;
                      }
                      return 1;
                    })()
                  }}
                >
                {/* 活动指示器 */}
                {isActive && <div className="active-indicator" />}
                
                {/* 步骤编号指示器 */}
                <div className={`step-number-indicator ${
                  isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                }`}>
                  {index + 1}
                </div>

                {/* 左右布局 */}
                <div className="flex items-center space-x-3">
                  {/* 左侧图标 */}
                  <div className="flex-shrink-0">
                    <div className={`workflow-step-icon ${
                      isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                    }`}>
                      {step.icon}
                    </div>
                  </div>
                  
                  {/* 中间内容 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm mb-1 truncate">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-xs mb-1 line-clamp-2">
                      {step.description}
                    </p>
                    
                    {/* 数据状态 */}
                    <div className={`data-status-badge inline-block ${
                      isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                    }`}>
                      {getStepData(step.id)}
                    </div>
                  </div>
                </div>
                
                {/* 进度条动画 */}
                {isActive && progress > 0 && (
                  <div 
                    className="progress-animation"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 实时数据流 */}
      <div className="mt-4 p-3 bg-gray-900/30 rounded-xl border border-gray-700/30">
        <h3 className="text-white font-semibold mb-2 flex items-center space-x-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs">实时数据流</span>
        </h3>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">待处理线索</span>
            <span className="text-blue-400 font-semibold data-number">
              {dataFlowStats.pendingLeads}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">处理中任务</span>
            <span className="text-green-400 font-semibold data-number">
              {dataFlowStats.processingTasks}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">今日完成</span>
            <span className="text-purple-400 font-semibold data-number">
              {dataFlowStats.completedToday}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 