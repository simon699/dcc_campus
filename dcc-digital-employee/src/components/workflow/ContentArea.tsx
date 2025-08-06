'use client';

import { useState, useEffect } from 'react';
import { StepType } from './WorkflowSteps';

interface ContentAreaProps {
  currentStep: StepType;
  activeTab: 'manual' | 'ai';
  userInput: string;
  selectedConditions: any[];
  analysisProgress: number;
  callProgress: number;
  analysisResults: any[];
  callResults: any[];
  selectedAnalysisResult: any;
  onTabChange: (tab: 'manual' | 'ai') => void;
  onUserInputChange: (input: string) => void;
  onInitiatePlan: () => void;
  onStartCalling: () => void;
  onViewReport: () => void;
  onStepChange: (stepId: StepType) => void;
  onSelectAnalysisResult: (result: any) => void;
  calculateMatchedCount: (conditions: any[]) => number;
}

export default function ContentArea({
  currentStep,
  activeTab,
  userInput,
  selectedConditions,
  analysisProgress,
  callProgress,
  analysisResults,
  callResults,
  selectedAnalysisResult,
  onTabChange,
  onUserInputChange,
  onInitiatePlan,
  onStartCalling,
  onViewReport,
  onStepChange,
  onSelectAnalysisResult,
  calculateMatchedCount
}: ContentAreaProps) {
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(1250);

  // 调用API查询匹配的线索数量
  const fetchMatchedCount = async (conditions: any[]) => {
    if (conditions.length === 0) {
      setMatchedCount(1250);
      setTotalCount(1250);
      return;
    }

    setIsCalculating(true);
    
    try {
      // 构建API请求参数
      const requestParams: any = {
        page: 1,
        page_size: 1 // 只需要获取总数，不需要实际数据
      };
      
      // 处理筛选条件
      conditions.forEach(condition => {
        if (condition.type === 'multiSelect') {
          const values = Array.isArray(condition.value) ? condition.value : [];
          const customValue = condition.customValue || '';
          
          if (values.length > 0 || customValue.trim() !== '') {
            switch (condition.id) {
              case 'followTime':
                // 处理最近跟进时间
                if (customValue.trim()) {
                  const customDate = new Date(customValue);
                  const today = new Date();
                  const diffDays = Math.floor((today.getTime() - customDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (diffDays <= 7) {
                    requestParams.last_follow_time_start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  } else if (diffDays <= 15) {
                    requestParams.last_follow_time_start = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  } else if (diffDays <= 30) {
                    requestParams.last_follow_time_start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  } else if (diffDays <= 60) {
                    requestParams.last_follow_time_start = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  } else if (diffDays <= 90) {
                    requestParams.last_follow_time_start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  }
                } else if (values.length > 0) {
                  const today = new Date();
                  values.forEach((value: string) => {
                    if (value === '7天内') {
                      requestParams.last_follow_time_start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    } else if (value === '15天内') {
                      requestParams.last_follow_time_start = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    } else if (value === '30天内') {
                      requestParams.last_follow_time_start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    } else if (value === '60天内') {
                      requestParams.last_follow_time_start = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    } else if (value === '90天内') {
                      requestParams.last_follow_time_start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    }
                  });
                }
                break;
                
              case 'nextFollowTime':
                // 处理下次跟进时间
                if (customValue.trim()) {
                  const customDate = new Date(customValue);
                  const today = new Date();
                  const diffDays = Math.floor((customDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (diffDays >= 0 && diffDays <= 1) {
                    requestParams.next_follow_time_start = today.toISOString().split('T')[0];
                    requestParams.next_follow_time_end = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  } else if (diffDays >= 0 && diffDays <= 7) {
                    requestParams.next_follow_time_start = today.toISOString().split('T')[0];
                    requestParams.next_follow_time_end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  }
                } else if (values.length > 0) {
                  const today = new Date();
                  values.forEach((value: string) => {
                    if (value === '今天') {
                      requestParams.next_follow_time_start = today.toISOString().split('T')[0];
                      requestParams.next_follow_time_end = today.toISOString().split('T')[0];
                    } else if (value === '明天') {
                      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                      requestParams.next_follow_time_start = tomorrow.toISOString().split('T')[0];
                      requestParams.next_follow_time_end = tomorrow.toISOString().split('T')[0];
                    } else if (value === '本周') {
                      const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
                      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
                      requestParams.next_follow_time_start = weekStart.toISOString().split('T')[0];
                      requestParams.next_follow_time_end = weekEnd.toISOString().split('T')[0];
                    } else if (value === '下周') {
                      const nextWeekStart = new Date(today.getTime() + (7 - today.getDay()) * 24 * 60 * 60 * 1000);
                      const nextWeekEnd = new Date(nextWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
                      requestParams.next_follow_time_start = nextWeekStart.toISOString().split('T')[0];
                      requestParams.next_follow_time_end = nextWeekEnd.toISOString().split('T')[0];
                    } else if (value === '本月') {
                      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      requestParams.next_follow_time_start = monthStart.toISOString().split('T')[0];
                      requestParams.next_follow_time_end = monthEnd.toISOString().split('T')[0];
                    }
                  });
                }
                break;
                
              case 'customerLevel':
                // 处理客户等级
                if (values.length > 0) {
                  const levelMap: { [key: string]: number } = {
                    'H级': 1,
                    'A级': 2,
                    'B级': 3,
                    'C级': 4,
                    'N级': 5,
                    'O级': 6,
                    'F级': 7
                  };
                  
                  const levelValues = values.map((v: string) => levelMap[v]).filter((v: number | undefined) => v !== undefined);
                  if (levelValues.length > 0) {
                    requestParams.client_level = levelValues;
                  }
                }
                break;
                
              case 'source':
                // 处理线索来源
                if (values.length > 0) {
                  requestParams.product = values.join(' ');
                }
                break;
            }
          }
        } else if (condition.value && condition.value !== '') {
          // 关键词筛选
          requestParams.phone = condition.value;
        }
      });
      
      // 调用API
      const token = localStorage.getItem('access_token');
      console.log('ContentArea获取到的token:', token ? '存在' : '不存在');
      if (!token) {
        // 如果没有令牌，直接使用虚拟计算
        console.log('未找到访问令牌，使用虚拟计算');
        const fallbackCount = calculateMatchedCount(conditions);
        setMatchedCount(fallbackCount);
        setTotalCount(1250);
        setIsCalculating(false);
        return;
      }
      
      const response = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': token
        },
        body: JSON.stringify(requestParams)
      });
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setMatchedCount(result.data?.pagination?.total_count || 0);
        setTotalCount(result.data?.pagination?.total_count || 0);
      } else {
        throw new Error(result.message || '查询失败');
      }
    } catch (error) {
      console.error('查询线索失败:', error);
      // 如果API调用失败，回退到虚拟计算
      const fallbackCount = calculateMatchedCount(conditions);
      setMatchedCount(fallbackCount);
      setTotalCount(1250);
    } finally {
      setIsCalculating(false);
    }
  };

  // 监听条件变化，重新计算数量
  useEffect(() => {
    if (activeTab === 'manual' && selectedConditions.length > 0) {
      fetchMatchedCount(selectedConditions);
    } else {
      setMatchedCount(1250);
      setTotalCount(1250);
    }
  }, [selectedConditions, activeTab]);

  // 渲染发起计划内容
  const renderInitiateContent = () => (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-write-900 dark:text-white mb-2">
          发起计划
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          配置您的任务或选择智能分析模式
        </p>
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-yellow-300">
              提示：请先点击"开始分析"或"智能分析"按钮，然后才能进入后续步骤
            </span>
          </div>
        </div>
      </div>
      
      {/* Tab切换 */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-white/10">
          <button
            onClick={() => onTabChange('manual')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'manual'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            手动配置
          </button>
          <button
            onClick={() => onTabChange('ai')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'ai'
                ? 'bg-green-500 text-white shadow-lg'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            智能分析
          </button>
        </div>
      </div>

      {/* Tab内容 */}
      <div className="flex-1">
        {activeTab === 'manual' ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">手动配置</h3>
                <p className="text-gray-300 text-sm">
                  通过设定条件，来智能分析线索问题，生成合适的任务
                </p>
              </div>
            </div>
            
            {/* 合并的筛选结果和条件展示 */}
            {selectedConditions.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl">
                {/* 头部：标题和清除按钮 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-white font-medium">筛选结果预览</span>
                  </div>
                </div>

                {/* 主要内容：数量统计和条件展示 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 左侧：数量统计 */}
                  <div className="lg:col-span-1">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">
                        {isCalculating ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                            <span className="ml-2 text-lg">计算中...</span>
                          </div>
                        ) : (
                          matchedCount.toLocaleString()
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        共 {totalCount.toLocaleString()} 条线索
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-xs text-gray-300">匹配率</span>
                        <span className="text-blue-300 font-medium text-sm">
                          {totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧：筛选条件 */}
                  <div className="lg:col-span-2">
                    <div className="space-y-3">
                      <div className="text-xs text-gray-400">当前筛选条件:</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedConditions.map((condition, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm
                                     bg-blue-500/30 text-blue-200 border border-blue-500/50 backdrop-blur-sm"
                          >
                            <span>{condition.label}: {Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <button 
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 
                         text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                onClick={() => alert('配置功能已移除，请使用智能分析功能')}
              >
                {selectedConditions.length > 0 ? '修改配置' : '开始配置'}
              </button>
              
              {selectedConditions.length > 0 && (
                <button 
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                           text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  onClick={onInitiatePlan}
                >
                  开始分析
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">智能分析</h3>
                <p className="text-gray-300 text-sm">
                  AI自动分析客户数据，智能推荐最佳外呼策略和话术
                </p>
              </div>
            </div>
            
            {/* 用户输入区域 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-white">
                  您的诉求（可选，不填将使用默认分析）
                </label>
                {userInput.trim() && (
                  <button
                    onClick={() => onUserInputChange('')}
                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-500/10"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  placeholder="例如：我想了解客户跟进情况，需要筛选出最近30天没有联系的客户，进行回访..."
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 
                           rounded-xl text-white placeholder-white/60 
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500/50 
                           transition-all duration-200 resize-none shadow-inner"
                  rows={4}
                  value={userInput}
                  onChange={(e) => onUserInputChange(e.target.value)}
                />
                <div className="absolute inset-0 pointer-events-none rounded-xl border border-transparent focus-within:border-green-500/50 transition-all duration-200"></div>
              </div>
              <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-xs text-gray-300 leading-relaxed">
                  <span className="text-green-400 font-semibold">💡 提示：</span>
                  描述您的具体需求，AI将为您智能分析并生成相应的外呼任务。如果不填写，将使用默认的智能分析策略。
                </p>
              </div>
            </div>
            
            <button 
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                       text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              onClick={onInitiatePlan}
            >
              {userInput.trim() ? '根据您的诉求，进行分析' : '开始智能分析'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // 渲染分析数据内容
  const renderAnalyzeContent = () => (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          分析数据
        </h2>
        <p className="text-gray-300">
          AI正在分析您的客户数据...
        </p>
      </div>

      {analysisProgress < 100 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-32 h-32 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center animate-spin shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          
          <div className="w-full max-w-md mb-6">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>分析进度</span>
              <span className="text-white font-semibold">{analysisProgress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill progress-fill-blue"
                style={{ width: `${analysisProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-300 mb-2">
              正在分析客户数据...
            </p>
            <p className="text-sm text-gray-400">
              预计需要 2-3 分钟
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              分析结果
            </h3>
            <p className="text-gray-300">
              基于AI分析，为您推荐以下行动方案：
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {analysisResults.map((result, index) => {
              const isSelected = selectedAnalysisResult === result;
              return (
                <div 
                  key={index} 
                  className={`bg-white/5 backdrop-blur-sm rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                  onClick={() => onSelectAnalysisResult(result)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">
                      {result.type === '回访' ? '🔄' : result.type === '挽回' ? '💪' : '🆕'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        result.priority === 'high' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                        result.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {result.priority === 'high' ? '高优先级' :
                         result.priority === 'medium' ? '中优先级' : '低优先级'}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <h4 className="font-semibold text-white mb-2">
                    {result.type}
                  </h4>
                  <p className="text-3xl font-bold text-blue-400 mb-1">
                    {result.count}
                  </p>
                  <p className="text-sm text-gray-300">
                    个线索需要处理
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex space-x-4">
            <button 
              className={`px-6 py-3 font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                selectedAnalysisResult
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                  : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
              }`}
              onClick={selectedAnalysisResult ? onStartCalling : undefined}
              disabled={!selectedAnalysisResult}
            >
              发起外呼
            </button>
            <button 
              className={`px-6 py-3 font-semibold rounded-xl transition-all duration-200 ${
                selectedAnalysisResult
                  ? 'bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20'
                  : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
              }`}
              onClick={selectedAnalysisResult ? () => onStepChange('report') : undefined}
              disabled={!selectedAnalysisResult}
            >
              查看详情
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染智能外呼内容
  const renderCallContent = () => (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          智能外呼
        </h2>
        <p className="text-gray-300">
          {callProgress < 100 ? '机器人正在执行外呼任务...' : '外呼任务已完成'}
        </p>
      </div>

      {callProgress < 100 ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-32 h-32 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center animate-pulse shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
          
          <div className="w-full max-w-md mb-6">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>外呼进度</span>
              <span className="text-white font-semibold">{callProgress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill progress-fill-green"
                style={{ width: `${callProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-300 mb-2">
              正在拨打电话...
            </p>
            <p className="text-sm text-gray-400">
              已拨打 {Math.floor(callProgress / 10)} 个电话
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              外呼结果
            </h3>
            <p className="text-gray-300">
              外呼任务已完成，以下是详细结果：
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {callResults.map((result, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">
                    {result.status === '接通' ? '✅' : result.status === '未接通' ? '❌' : '🚫'}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    result.status === '接通' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    result.status === '未接通' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 
                    'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {result.status}
                  </span>
                </div>
                <h4 className="font-semibold text-white mb-2">
                  {result.count}
                </h4>
                <p className="text-sm text-gray-300">
                  平均通话时长：{result.duration}
                </p>
              </div>
            ))}
          </div>

          <div className="flex space-x-4">
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 
                       text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              onClick={onViewReport}
            >
              查看分析报告
            </button>
            <button className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold 
                             rounded-xl transition-all duration-200 hover:bg-white/20">
              导出结果
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染数据分析内容
  const renderReportContent = () => (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          数据分析
        </h2>
        <p className="text-gray-300">
          外呼效果分析和优化建议
        </p>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 效果统计 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              效果统计
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">接通率</span>
                <span className="font-semibold text-green-400">53.6%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">平均通话时长</span>
                <span className="font-semibold text-blue-400">3.2分钟</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">转化率</span>
                <span className="font-semibold text-purple-400">12.5%</span>
              </div>
            </div>
          </div>

          {/* 优化建议 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              优化建议
            </h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <span className="text-yellow-400 text-lg">💡</span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  建议在上午9-11点进行外呼，接通率更高
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-blue-400 text-lg">📈</span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  优化开场白，提高客户兴趣度
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="text-green-400 text-lg">🎯</span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  针对不同客户群体使用差异化话术
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-4">
          <button 
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 
                     text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            onClick={() => onStepChange('analyze')}
          >
            返回分析数据
          </button>
          <button 
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                     text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            onClick={() => onStepChange('initiate')}
          >
            开始新一轮
          </button>
          <button className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold 
                           rounded-xl transition-all duration-200 hover:bg-white/20">
            导出报告
          </button>
        </div>
      </div>
    </div>
  );

  // 根据当前步骤渲染对应内容
  switch (currentStep) {
    case 'initiate':
      return renderInitiateContent();
    case 'analyze':
      return renderAnalyzeContent();
    case 'call':
      return renderCallContent();
    case 'report':
      return renderReportContent();
    default:
      return null;
  }
} 