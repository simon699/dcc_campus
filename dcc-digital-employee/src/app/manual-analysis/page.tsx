'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import DccBindModal from '../../components/DccBindModal';
import ConfigModal from '../../components/ConfigModal';
import WorkflowSteps, { StepType } from '../../components/workflow/WorkflowSteps';
import ContentArea from '../../components/workflow/ContentArea';
import ConfirmModal from '../../components/workflow/ConfirmModal';
import { createSteps, getStepStatus, calculateMatchedCount, calculateMatchedCountAsync, updateDataFlowStats } from '../../components/workflow/utils';

export default function ManualAnalysisPage() {
  const router = useRouter();
  const [showDccBindModal, setShowDccBindModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepType>('initiate');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [callProgress, setCallProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [callResults, setCallResults] = useState<any[]>([]);
  const [stepProgress, setStepProgress] = useState<Record<StepType, number>>({
    initiate: 100,
    analyze: 0,
    call: 0,
    report: 0
  });
  const [dataFlowStats, setDataFlowStats] = useState({
    pendingLeads: 0,
    processingTasks: 0,
    completedToday: 0
  });
  const [userInput, setUserInput] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConditions, setSelectedConditions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [hasAnalysisResults, setHasAnalysisResults] = useState(false);
  const [selectedAnalysisResult, setSelectedAnalysisResult] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasInitiatedAnalysis, setHasInitiatedAnalysis] = useState(false);
  const [hasCallResults, setHasCallResults] = useState(false);

  // 步骤配置
  const [steps, setSteps] = useState(createSteps());

  // 更新步骤状态和进度
  const updateStepStatus = () => {
    const updatedSteps = steps.map(step => ({
      ...step,
      status: getStepStatus(step.id, currentStep, steps)
    }));
    setSteps(updatedSteps);
    
    // 更新进度
    const newProgress = { ...stepProgress };
    updatedSteps.forEach((step) => {
      if (step.status === 'completed') {
        newProgress[step.id] = 100;
      } else if (step.status === 'active') {
        if (step.id === 'analyze') {
          newProgress[step.id] = analysisProgress;
        } else if (step.id === 'call') {
          newProgress[step.id] = callProgress;
        } else {
          newProgress[step.id] = 50;
        }
      } else {
        newProgress[step.id] = 0;
      }
    });
    setStepProgress(newProgress);
  };

  useEffect(() => {
    console.log("Manual analysis page mounted");
    
    // 检查是否需要显示DCC绑定弹窗
    const showDccBindModal = sessionStorage.getItem('showDccBindModal');
    if (showDccBindModal === 'true') {
      setShowDccBindModal(true);
      sessionStorage.removeItem('showDccBindModal');
    }

    // 检查URL参数，支持直接跳转到特定步骤
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get('step');
    if (stepParam) {
      switch (stepParam) {
        case 'analyze':
          setCurrentStep('analyze');
          setAnalysisProgress(0);
          simulateAnalysis();
          break;
        case 'call':
          setCurrentStep('call');
          setCallProgress(0);
          simulateCalling();
          break;
        case 'report':
          setCurrentStep('report');
          break;
      }
    }
  }, []);

  // 监听进度变化，更新步骤状态
  useEffect(() => {
    updateStepStatus();
  }, [analysisProgress, callProgress, currentStep]);

  // 更新数据流统计
  useEffect(() => {
    const updateDataFlow = () => {
      setDataFlowStats(updateDataFlowStats(currentStep));
    };

    updateDataFlow();
    const interval = setInterval(updateDataFlow, 2000);
    return () => clearInterval(interval);
  }, [currentStep]);

  // 处理步骤切换
  const handleStepChange = (stepId: StepType) => {
    // 检查步骤切换权限
    if (stepId === 'analyze' && currentStep === 'initiate' && hasInitiatedAnalysis) {
      // 从发起计划进入分析数据，需要先发起分析
      setCurrentStep(stepId);
      updateStepStatus();
      setAnalysisProgress(0);
      simulateAnalysis();
      return;
    }
    
    if (stepId === 'call' && hasAnalysisResults && selectedAnalysisResult) {
      // 从分析数据进入智能外呼，需要先选择结果
      setCurrentStep(stepId);
      updateStepStatus();
      
      // 如果已经有外呼结果，直接展示结果；否则开始外呼
      if (hasCallResults) {
        // 已经有外呼结果，直接展示
        setCallProgress(100);
      } else {
        // 开始新的外呼
        setCallProgress(0);
        simulateCalling();
      }
      return;
    }
    
    // 如果当前在外呼页面且外呼已完成，再次点击外呼步骤时直接展示结果
    if (stepId === 'call' && currentStep === 'call' && hasCallResults) {
      setCallProgress(100);
      return;
    }
    
    if (stepId === 'report' && hasAnalysisResults && selectedAnalysisResult) {
      // 从分析数据进入数据分析，需要先选择结果
      setCurrentStep(stepId);
      updateStepStatus();
      return;
    }
    
    if (stepId === 'analyze' && hasAnalysisResults) {
      // 从其他步骤回到分析数据，保留原有结果
      setCurrentStep(stepId);
      updateStepStatus();
      return;
    }
    
    if (stepId === 'initiate' && hasAnalysisResults) {
      // 有分析结果时点击发起计划，显示确认弹窗
      setShowConfirmModal(true);
      return;
    }
    
    // 其他情况不允许切换
    console.log('步骤切换被阻止:', stepId);
  };

  // 模拟分析过程
  const simulateAnalysis = () => {
    const interval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // 生成分析结果
          setAnalysisResults([
            { type: '回访', count: 10, priority: 'high' },
            { type: '挽回', count: 20, priority: 'medium' },
            { type: '新客户', count: 5, priority: 'low' }
          ]);
          setHasAnalysisResults(true);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  // 模拟外呼过程
  const simulateCalling = () => {
    const interval = setInterval(() => {
      setCallProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // 生成外呼结果
          setCallResults([
            { status: '接通', count: 15, duration: '2-5分钟' },
            { status: '未接通', count: 8, duration: '0分钟' },
            { status: '拒绝', count: 5, duration: '0-1分钟' }
          ]);
          setHasCallResults(true);
          return 100;
        }
        return prev + 15;
      });
    }, 800);
  };

  // 发起计划
  const handleInitiatePlan = () => {
    if (userInput.trim()) {
      console.log('用户诉求:', userInput);
      // 这里可以发送用户输入到后端进行分析
      // 使用用户自定义的诉求进行分析
    } else {
      console.log('使用默认智能分析');
      // 使用默认的智能分析策略
    }
    setHasInitiatedAnalysis(true);
    handleStepChange('analyze');
  };

  // 开始外呼
  const handleStartCalling = async () => {
    try {
      // 获取访问令牌
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('未找到访问令牌');
        alert('请先登录');
        return;
      }

      // 根据选中的分析结果类型生成线索ID
      let leadIds: number[] = [];
      if (selectedAnalysisResult) {
        // 根据分析结果类型生成不同的线索ID
        switch (selectedAnalysisResult.type) {
          case '回访':
            leadIds = [225, 226]; // 回访客户ID
            break;
          case '挽回':
            leadIds = [225, 226]; // 挽回客户ID
            break;
          case '新客户':
            leadIds = [225, 226]; // 新客户ID
            break;
          default:
            leadIds = [225, 226]; // 默认ID
        }
      } else {
        // 如果没有选中分析结果，使用默认ID
        leadIds = [225, 226];
      }

      // 构建请求参数
      const requestData = {
        "job_group_name": "客户回访任务",
        "job_group_description": "对重要客户进行回访",
        "strategy_json": {
          "RepeatBy": "once",
          "maxAttemptsPerDay": 3,
          "minAttemptInterval": 120
        },
        "lead_ids": leadIds,
        "extras": [
          {
            "key": "ServiceId",
            "value": ""
          },
          {
            "key": "TenantId",
            "value": ""
          }
        ]
      };

      // 调用外呼接口
      const response = await fetch('http://localhost:8000/api/create_outbound_call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('外呼任务创建成功:', result);
        alert('外呼任务创建成功！');
        // 继续执行原有的步骤切换逻辑
        handleStepChange('call');
      } else {
        throw new Error(result.message || '外呼任务创建失败');
      }
    } catch (error) {
      console.error('发起外呼失败:', error);
      alert('发起外呼失败，请重试');
    }
  };

  // 查看分析报告
  const handleViewReport = () => {
    handleStepChange('report');
  };

  const handleDccBindClose = () => {
    setShowDccBindModal(false);
  };

  // 处理配置弹窗
  const handleConfigModalOpen = () => {
    setShowConfigModal(true);
  };

  const handleConfigModalClose = () => {
    setShowConfigModal(false);
  };

  const handleConfigConfirm = (conditions: any[]) => {
    setSelectedConditions(conditions);
  };

  const handleClearConditions = () => {
    setSelectedConditions([]);
  };

  // 处理确认重新发起分析
  const handleConfirmRestart = () => {
    setHasAnalysisResults(false);
    setSelectedAnalysisResult(null);
    setAnalysisResults([]);
    setCallResults([]);
    setAnalysisProgress(0);
    setCallProgress(0);
    setHasInitiatedAnalysis(false);
    setHasCallResults(false);
    setCurrentStep('initiate');
    setShowConfirmModal(false);
  };

  // 处理取消重新发起分析
  const handleCancelRestart = () => {
    setShowConfirmModal(false);
  };

  // 处理选择分析结果
  const handleSelectAnalysisResult = (result: any) => {
    setSelectedAnalysisResult(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 动态背景粒子效果 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        <Header />
        
        <main className="pt-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">手动分析</h1>
              <p className="text-gray-300">自定义分析流程，深度挖掘数据价值</p>
            </div>

            {/* 工作流区域 */}
            <div className="flex gap-6 h-[calc(100vh-7rem)]">
              {/* 左侧步骤区域 */}
              <WorkflowSteps
                steps={steps}
                currentStep={currentStep}
                stepProgress={stepProgress}
                dataFlowStats={dataFlowStats}
                hasAnalysisResults={hasAnalysisResults}
                selectedAnalysisResult={selectedAnalysisResult}
                hasInitiatedAnalysis={hasInitiatedAnalysis}
                hasCallResults={hasCallResults}
                onStepChange={handleStepChange}
              />

              {/* 右侧内容区域 */}
              <div className="w-3/4">
                <div className="h-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <ContentArea
                    currentStep={currentStep}
                    activeTab={activeTab}
                    userInput={userInput}
                    selectedConditions={selectedConditions}
                    analysisProgress={analysisProgress}
                    callProgress={callProgress}
                    analysisResults={analysisResults}
                    callResults={callResults}
                    selectedAnalysisResult={selectedAnalysisResult}
                    onTabChange={setActiveTab}
                    onUserInputChange={setUserInput}
                    onConfigModalOpen={handleConfigModalOpen}
                    onInitiatePlan={handleInitiatePlan}
                    onStartCalling={handleStartCalling}
                    onViewReport={handleViewReport}
                    onStepChange={handleStepChange}
                    onSelectAnalysisResult={handleSelectAnalysisResult}
                    calculateMatchedCount={calculateMatchedCount}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* DCC绑定弹窗 */}
      <DccBindModal 
        isOpen={showDccBindModal} 
        onClose={handleDccBindClose}
      />

      {/* 配置弹窗 */}
      <ConfigModal
        isOpen={showConfigModal}
        onClose={handleConfigModalClose}
        onConfirm={handleConfigConfirm}
      />

      {/* 确认重新发起分析弹窗 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmRestart}
        onCancel={handleCancelRestart}
      />
    </div>
  );
} 