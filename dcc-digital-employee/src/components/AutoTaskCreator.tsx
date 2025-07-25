'use client';

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface AutoTaskCreatorProps {
  robot: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: any) => void;
}

export default function AutoTaskCreator({ robot, isOpen, onClose, onSubmit }: AutoTaskCreatorProps) {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'auto',
    frequency: 'daily',
    time: '09:00',
    conditions: [],
    actions: []
  });

  const [currentStep, setCurrentStep] = useState(1);

  const frequencyOptions = [
    { value: 'realtime', label: '实时执行' },
    { value: 'hourly', label: '每小时' },
    { value: 'daily', label: '每日' },
    { value: 'weekly', label: '每周' },
    { value: 'monthly', label: '每月' }
  ];

  const conditionTemplates = {
    'AI外呼': [
      { id: 1, name: '新线索录入', description: '当有新的销售线索录入系统时' },
      { id: 2, name: '客户回访时间到', description: '根据设定的回访周期自动触发' },
      { id: 3, name: '客户状态变更', description: '当客户状态发生变化时' }
    ],
    'AI质检': [
      { id: 4, name: '通话结束', description: '每次通话结束后自动质检' },
      { id: 5, name: '服务评分低于阈值', description: '当服务评分低于设定值时' },
      { id: 6, name: '异常关键词检测', description: '检测到异常关键词时' }
    ],
    '数字工单': [
      { id: 7, name: '新工单创建', description: '当有新工单创建时' },
      { id: 8, name: '工单超时', description: '工单处理时间超过预设时间' },
      { id: 9, name: '优先级变更', description: '工单优先级发生变更时' }
    ],
    'AI分析': [
      { id: 10, name: '数据更新', description: '当关键数据发生更新时' },
      { id: 11, name: '定时分析', description: '按设定时间周期执行分析' },
      { id: 12, name: '异常数据检测', description: '检测到数据异常时' }
    ]
  };

  const actionTemplates = {
    'AI外呼': [
      { id: 1, name: '发起外呼', description: '自动拨打客户电话' },
      { id: 2, name: '发送短信', description: '发送预设模板短信' },
      { id: 3, name: '更新客户状态', description: '自动更新客户跟进状态' }
    ],
    'AI质检': [
      { id: 4, name: '生成质检报告', description: '自动生成通话质检报告' },
      { id: 5, name: '发送预警通知', description: '向管理员发送预警信息' },
      { id: 6, name: '标记异常记录', description: '自动标记异常通话记录' }
    ],
    '数字工单': [
      { id: 7, name: '自动分配工单', description: '根据规则自动分配给相应人员' },
      { id: 8, name: '发送提醒通知', description: '向处理人员发送提醒' },
      { id: 9, name: '升级工单优先级', description: '自动提升工单处理优先级' }
    ],
    'AI分析': [
      { id: 10, name: '生成分析报告', description: '自动生成数据分析报告' },
      { id: 11, name: '发送分析结果', description: '将分析结果发送给相关人员' },
      { id: 12, name: '更新数据看板', description: '自动更新数据可视化看板' }
    ]
  };

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      robotId: robot.id,
      robotName: robot.name
    });
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      
      {/* 模态框 */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4`}>
        <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        }`}>
          {/* 头部 */}
          <div className={`flex items-center justify-between p-6 border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="text-2xl">{robot.avatar}</div>
              <div>
                <h2 className={`text-xl font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  为 {robot.name} 创建自动化任务
                </h2>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  步骤 {currentStep} / 3
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 步骤指示器 */}
          <div className="px-6 py-4">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      step < currentStep
                        ? 'bg-blue-600'
                        : theme === 'dark'
                          ? 'bg-gray-700'
                          : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>基本信息</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>触发条件</span>
              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>执行动作</span>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-6">
            {/* 步骤1: 基本信息 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    任务名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      theme === 'dark'
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    placeholder="请输入任务名称"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    任务描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className={`w-full px-3 py-2 border rounded-lg h-24 ${
                      theme === 'dark'
                        ? 'border-gray-600 bg-gray-800 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    placeholder="请描述任务的具体功能和目的"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      执行频率 *
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        theme === 'dark'
                          ? 'border-gray-600 bg-gray-800 text-white'
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    >
                      {frequencyOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {formData.frequency !== 'realtime' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        执行时间
                      </label>
                      <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          theme === 'dark'
                            ? 'border-gray-600 bg-gray-800 text-white'
                            : 'border-gray-300 bg-white text-gray-900'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 步骤2: 触发条件 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-lg font-medium mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    选择触发条件
                  </h3>
                  <p className={`text-sm mb-4 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    选择一个或多个条件来触发此自动化任务
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {conditionTemplates[robot.name as keyof typeof conditionTemplates]?.map((condition) => (
                    <div
                      key={condition.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        formData.conditions.includes(condition.id)
                          ? theme === 'dark'
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-blue-500 bg-blue-50'
                          : theme === 'dark'
                            ? 'border-gray-600 bg-gray-800 hover:border-gray-500'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      onClick={() => {
                        const newConditions = formData.conditions.includes(condition.id)
                          ? formData.conditions.filter(id => id !== condition.id)
                          : [...formData.conditions, condition.id];
                        setFormData({...formData, conditions: newConditions});
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                          formData.conditions.includes(condition.id)
                            ? 'border-blue-500 bg-blue-500'
                            : theme === 'dark'
                              ? 'border-gray-500'
                              : 'border-gray-300'
                        }`}>
                          {formData.conditions.includes(condition.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {condition.name}
                          </h4>
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {condition.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 步骤3: 执行动作 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className={`text-lg font-medium mb-4 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    选择执行动作
                  </h3>
                  <p className={`text-sm mb-4 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    选择触发条件满足时要执行的动作
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {actionTemplates[robot.name as keyof typeof actionTemplates]?.map((action) => (
                    <div
                      key={action.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        formData.actions.includes(action.id)
                          ? theme === 'dark'
                            ? 'border-green-500 bg-green-900/20'
                            : 'border-green-500 bg-green-50'
                          : theme === 'dark'
                            ? 'border-gray-600 bg-gray-800 hover:border-gray-500'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      onClick={() => {
                        const newActions = formData.actions.includes(action.id)
                          ? formData.actions.filter(id => id !== action.id)
                          : [...formData.actions, action.id];
                        setFormData({...formData, actions: newActions});
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                          formData.actions.includes(action.id)
                            ? 'border-green-500 bg-green-500'
                            : theme === 'dark'
                              ? 'border-gray-500'
                              : 'border-gray-300'
                        }`}>
                          {formData.actions.includes(action.id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {action.name}
                          </h4>
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className={`flex items-center justify-between p-6 border-t ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentStep === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              上一步
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                取消
              </button>
              
              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  disabled={currentStep === 1 && !formData.name}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    (currentStep === 1 && !formData.name)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  下一步
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={formData.conditions.length === 0 || formData.actions.length === 0}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    (formData.conditions.length === 0 || formData.actions.length === 0)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  创建任务
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}