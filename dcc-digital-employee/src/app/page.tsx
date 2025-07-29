'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '../components/Header';
import DccBindModal from '../components/DccBindModal';

// 步骤类型定义
type StepType = 'initiate' | 'analyze' | 'call' | 'report';

interface Step {
  id: StepType;
  title: string;
  description: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export default function Home() {
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

  // 步骤配置
  const steps: Step[] = [
    {
      id: 'initiate',
      title: '发起计划',
      description: '配置任务或选择智能分析',
      icon: '📋',
      status: 'active'
    },
    {
      id: 'analyze',
      title: '分析数据',
      description: 'AI智能分析客户数据',
      icon: '🔍',
      status: 'pending'
    },
    {
      id: 'call',
      title: '智能外呼',
      description: '机器人自动拨打电话',
      icon: '📞',
      status: 'pending'
    },
    {
      id: 'report',
      title: '数据分析',
      description: '分析外呼结果和效果',
      icon: '📊',
      status: 'pending'
    }
  ];

  // 获取当前步骤状态
  const getStepStatus = (stepId: StepType): 'pending' | 'active' | 'completed' | 'error' => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (stepId === currentStep) return 'active';
    if (stepIndex < currentIndex) return 'completed';
    return 'pending';
  };

  // 更新步骤状态和进度
  const updateStepStatus = () => {
    steps.forEach(step => {
      step.status = getStepStatus(step.id);
    });
    
    // 更新进度
    const newProgress = { ...stepProgress };
    steps.forEach((step, index) => {
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
    console.log("Home page mounted");
    
    // 检查是否需要显示DCC绑定弹窗
    const needBindDcc = sessionStorage.getItem('needBindDcc');
    if (needBindDcc === 'true') {
      setShowDccBindModal(true);
      sessionStorage.removeItem('needBindDcc');
    }
  }, []);

  // 监听进度变化，更新步骤状态
  useEffect(() => {
    updateStepStatus();
  }, [analysisProgress, callProgress, currentStep]);

  // 处理步骤切换
  const handleStepChange = (stepId: StepType) => {
    setCurrentStep(stepId);
    updateStepStatus();
    
    // 模拟分析进度
    if (stepId === 'analyze') {
      setAnalysisProgress(0);
      simulateAnalysis();
    }
    
    // 模拟外呼进度
    if (stepId === 'call') {
      setCallProgress(0);
      simulateCalling();
    }
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
          return 100;
        }
        return prev + 15;
      });
    }, 800);
  };

  // 发起计划
  const handleInitiatePlan = () => {
    handleStepChange('analyze');
  };

  // 开始外呼
  const handleStartCalling = () => {
    handleStepChange('call');
  };

  // 查看分析报告
  const handleViewReport = () => {
    handleStepChange('report');
  };

  const handleDccBindClose = () => {
    setShowDccBindModal(false);
  };



  // 渲染右侧内容区域
  const renderContentArea = () => {
    switch (currentStep) {
      case 'initiate':
        return (
          <div className="h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                发起计划
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                配置您的任务或选择智能分析模式
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* 手动配置 */}
              <div className="saas-card">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">手动配置</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  自定义配置外呼任务，包括目标客户、话术模板、拨打时间等
                </p>
                <button className="btn-primary w-full">
                  开始配置
                </button>
              </div>

              {/* 智能分析 */}
              <div className="saas-card">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">智能分析</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  AI自动分析客户数据，智能推荐最佳外呼策略和话术
                </p>
                <button 
                  className="btn-success w-full"
                  onClick={handleInitiatePlan}
                >
                  开始智能分析
                </button>
              </div>
            </div>
          </div>
        );

      case 'analyze':
        return (
          <div className="h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                分析数据
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                AI正在分析您的客户数据...
              </p>
            </div>

            {analysisProgress < 100 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                  <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center animate-spin">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                </div>
                
                <div className="w-full max-w-md mb-6">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                    <span>分析进度</span>
                    <span>{analysisProgress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill progress-fill-blue"
                      style={{ width: `${analysisProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    正在分析客户数据...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    预计需要 2-3 分钟
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    分析结果
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    基于AI分析，为您推荐以下行动方案：
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {analysisResults.map((result, index) => (
                    <div key={index} className="result-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">
                          {result.type === '回访' ? '🔄' : result.type === '挽回' ? '💪' : '🆕'}
                        </span>
                        <span className={`badge ${
                          result.priority === 'high' ? 'badge-error' :
                          result.priority === 'medium' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {result.priority === 'high' ? '高优先级' :
                           result.priority === 'medium' ? '中优先级' : '低优先级'}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {result.type}
                      </h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {result.count}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        个线索需要处理
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-4">
                  <button 
                    className="btn-primary"
                    onClick={handleStartCalling}
                  >
                    发起外呼
                  </button>
                  <button className="btn-outline">
                    查看详情
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'call':
        return (
          <div className="h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                智能外呼
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                机器人正在执行外呼任务...
              </p>
            </div>

            {callProgress < 100 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>
                
                <div className="w-full max-w-md mb-6">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                    <span>外呼进度</span>
                    <span>{callProgress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill progress-fill-green"
                      style={{ width: `${callProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    正在拨打电话...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    已拨打 {Math.floor(callProgress / 10)} 个电话
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    外呼结果
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    外呼任务已完成，以下是详细结果：
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {callResults.map((result, index) => (
                    <div key={index} className="result-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">
                          {result.status === '接通' ? '✅' : result.status === '未接通' ? '❌' : '🚫'}
                        </span>
                        <span className={`badge ${
                          result.status === '接通' ? 'badge-success' :
                          result.status === '未接通' ? 'badge-warning' : 'badge-error'
                        }`}>
                          {result.status}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {result.count}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        平均通话时长：{result.duration}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-4">
                  <button 
                    className="btn-primary"
                    onClick={handleViewReport}
                  >
                    查看分析报告
                  </button>
                  <button className="btn-outline">
                    导出结果
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'report':
        return (
          <div className="h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                数据分析
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                外呼效果分析和优化建议
              </p>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 效果统计 */}
                <div className="saas-card">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    效果统计
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">接通率</span>
                      <span className="font-semibold text-green-600">53.6%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">平均通话时长</span>
                      <span className="font-semibold text-blue-600">3.2分钟</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">转化率</span>
                      <span className="font-semibold text-purple-600">12.5%</span>
                    </div>
                  </div>
                </div>

                {/* 优化建议 */}
                <div className="saas-card">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    优化建议
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <span className="text-yellow-500">💡</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        建议在上午9-11点进行外呼，接通率更高
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500">📈</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        优化开场白，提高客户兴趣度
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-green-500">🎯</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        针对不同客户群体使用差异化话术
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button 
                  className="btn-primary"
                  onClick={() => handleStepChange('initiate')}
                >
                  开始新一轮
                </button>
                <button className="btn-outline">
                  导出报告
                </button>
                <button className="btn-secondary">
                  查看历史记录
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
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
            <div className="flex gap-6 h-[calc(100vh-7rem)]">
              {/* 左侧步骤区域 - 1/4宽度 */}
              <div className="w-1/4">
                {/* AI动画 */}
                <div className="ai-animation-container">
                  <div className="text-center mb-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      AI智能助手
                    </p>
                  </div>
                  <div className="ai-animation">
                    <div className="relative z-10 w-10 h-10 rounded-full overflow-hidden">
                      <Image
                        src="/images/51_1744852109.gif"
                        alt="AI助手"
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
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
                        <div
                          className={`step-card ${
                            isActive ? 'active' : ''
                          } ${isCompleted ? 'completed' : ''}`}
                          onClick={() => handleStepChange(step.id)}
                        >
                          {/* 进度指示器 */}
                          {isCompleted && (
                            <div className="progress-indicator">
                              ✓
                            </div>
                          )}
                          
                          {/* 步骤进度条 */}
                          <div 
                            className="step-progress"
                            style={{ width: `${progress}%` }}
                          ></div>

                          <div className="flex items-center space-x-3">
                            <div className={`text-2xl ${isActive ? 'animate-bounce-slow' : ''}`}>
                              {step.icon}
                            </div>
                            <div className="flex-1">
                              <h3 className={`font-semibold text-sm ${
                                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                              }`}>
                                {step.title}
                              </h3>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                {step.description}
                              </p>
                            </div>
                            {isActive && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-slow"></div>
                            )}
                            {isCompleted && (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右侧内容区域 - 3/4宽度 */}
              <div className="w-3/4">
                <div className="h-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  {renderContentArea()}
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
    </div>
  );
}