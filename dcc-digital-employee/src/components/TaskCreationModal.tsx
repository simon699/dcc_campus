'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TaskCreationModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
}

export default function TaskCreationModal({ onClose, onTaskCreated }: TaskCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [matchingCustomers, setMatchingCustomers] = useState(0);
  const [formData, setFormData] = useState({
    // 第一步：基本信息
    name: '',
    type: 'marketing',
    priority: 'medium',
    description: '',
    callScriptScene: '', // 改为场景选择
    maxRetries: 3,
    callInterval: 30,
    
    // 第二步：客户选择条件和时间设置
    customerConditions: {
      customerLevels: [] as string[], // 客户等级，多选
      lastFollowUpDays: '', // 最新跟进时间：超过多少天
      remarkKeywords: '', // 备注包含关键词
    },
    timeSettings: {
      startDate: '',
      endDate: '',
      workingHours: {
        start: '09:00',
        end: '18:00'
      },
      workingDays: ['1', '2', '3', '4', '5'] // 1-7 代表周一到周日
    }
  });

  // 话术场景选项
  const scriptScenes = [
    { value: 'new_customer_intro', label: '新客户介绍' },
    { value: 'product_promotion', label: '产品推广' },
    { value: 'customer_followup', label: '客户回访' },
    { value: 'satisfaction_survey', label: '满意度调研' },
    { value: 'renewal_reminder', label: '续费提醒' },
    { value: 'event_invitation', label: '活动邀请' },
    { value: 'feedback_collection', label: '意见收集' },
    { value: 'service_upgrade', label: '服务升级' }
  ];

  // 客户等级选项
  const customerLevelOptions = [
    { value: 'H', label: 'H级客户（最高级客户）' },
    { value: 'A', label: 'A级客户（重要客户）' },
    { value: 'B', label: 'B级客户（一般客户）' },
    { value: 'C', label: 'C级客户（潜在客户）' },
    { value: 'N', label: 'N级客户（新客户）' },
  ];

  // 模拟获取符合条件的客户数量
  const fetchMatchingCustomers = async () => {
    // 这里应该调用后端API获取符合条件的客户数量
    // 模拟API调用
    const { customerLevels, lastFollowUpDays, remarkKeywords } = formData.customerConditions;
    
    if (customerLevels.length === 0 && !lastFollowUpDays && !remarkKeywords) {
      setMatchingCustomers(0);
      return;
    }
    
    // 模拟计算逻辑
    let count = 1000; // 基础客户数
    
    if (customerLevels.length > 0) {
      count = Math.floor(count * (customerLevels.length / 5)); // 根据选择的等级数量调整
    }
    
    if (lastFollowUpDays) {
      const days = parseInt(lastFollowUpDays);
      count = Math.floor(count * (days / 100)); // 天数越多，符合条件的客户越多
    }
    
    if (remarkKeywords) {
      count = Math.floor(count * 0.3); // 关键词筛选会大幅减少数量
    }
    
    setMatchingCustomers(Math.max(1, count));
  };

  // 监听筛选条件变化
  useEffect(() => {
    if (currentStep === 2) {
      fetchMatchingCustomers();
    }
  }, [formData.customerConditions, currentStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      return;
    }
    
    // 最后一步，提交任务
    console.log('Creating task:', formData);
    onTaskCreated();
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as Record<string, any>),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleConditionChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      customerConditions: {
        ...prev.customerConditions,
        [field]: value
      }
    }));
  };

  const handleTimeSettingChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        timeSettings: {
          ...prev.timeSettings,
          [parent]: {
            ...(prev.timeSettings[parent as keyof typeof prev.timeSettings] as Record<string, any>),
            [child]: value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        timeSettings: {
          ...prev.timeSettings,
          [field]: value
        }
      }));
    }
  };

  const handleWorkingDaysChange = (day: string) => {
    const currentDays = formData.timeSettings.workingDays;
    const newDays = currentDays.includes(day) 
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    handleTimeSettingChange('workingDays', newDays);
  };

  const handleCustomerLevelChange = (level: string) => {
    const currentLevels = formData.customerConditions.customerLevels;
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level];
    
    handleConditionChange('customerLevels', newLevels);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {[1, 2].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
              ${currentStep >= step 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                : 'bg-gray-700 text-gray-400'
              }
            `}>
              {step}
            </div>
            {step < 2 && (
              <div className={`
                w-16 h-1 mx-2 transition-all duration-300
                ${currentStep > step ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-700'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
        <span>📋</span>
        <span>基本信息设置</span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-gray-300 text-sm font-medium mb-2">任务名称</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-200"
            placeholder="请输入任务名称"
            required
          />
        </div>
        
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">任务类型</label>
          <select
            value={formData.type}
            onChange={(e) => handleInputChange('type', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
          >
            <option value="marketing">营销推广</option>
            <option value="followup">客户回访</option>
            <option value="survey">满意度调研</option>
            <option value="reminder">提醒通知</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-2">优先级</label>
          <select
            value={formData.priority}
            onChange={(e) => handleInputChange('priority', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
          >
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-gray-300 text-sm font-medium mb-2">任务描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-200 h-24 resize-none"
            placeholder="请输入任务描述..."
          />
        </div>
      </div>

      {/* 外呼配置 */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-white flex items-center space-x-2">
          <span>⚙️</span>
          <span>外呼配置</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">最大重试次数</label>
            <input
              type="number"
              value={formData.maxRetries}
              onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
              min="1"
              max="10"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">呼叫间隔(秒)</label>
            <input
              type="number"
              value={formData.callInterval}
              onChange={(e) => handleInputChange('callInterval', parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
              min="10"
              max="300"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">外呼话术场景</label>
            <select
              value={formData.callScriptScene}
              onChange={(e) => handleInputChange('callScriptScene', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
              required
            >
              <option value="">请选择话术场景</option>
              {scriptScenes.map((scene) => (
                <option key={scene.value} value={scene.value}>
                  {scene.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
        <span>🎯</span>
        <span>客户筛选条件</span>
      </h3>
      
      {/* 客户等级选择 */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-3">客户等级（可多选）</label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customerLevelOptions.map((level) => (
            <label key={level.value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.customerConditions.customerLevels.includes(level.value)}
                onChange={() => handleCustomerLevelChange(level.value)}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-gray-300 text-sm">{level.label}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* 最新跟进时间 */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">最新跟进时间：超过多少天</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['7', '15', '30', '60', '90', '180'].map((days) => (
            <label key={days} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="lastFollowUpDays"
                value={days}
                checked={formData.customerConditions.lastFollowUpDays === days}
                onChange={(e) => handleConditionChange('lastFollowUpDays', e.target.value)}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-gray-300 text-sm">超过{days}天</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="lastFollowUpDays"
              value="custom"
              checked={formData.customerConditions.lastFollowUpDays === 'custom'}
              onChange={(e) => handleConditionChange('lastFollowUpDays', e.target.value)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-300 text-sm">自定义天数：</span>
            <input
              type="number"
              placeholder="输入天数"
              className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm w-24 focus:border-blue-500 focus:outline-none"
              min="1"
              disabled={formData.customerConditions.lastFollowUpDays !== 'custom'}
            />
          </label>
        </div>
      </div>
      
      {/* 备注关键词 */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">备注包含关键词</label>
        <input
          type="text"
          value={formData.customerConditions.remarkKeywords}
          onChange={(e) => handleConditionChange('remarkKeywords', e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors duration-200"
          placeholder="输入关键词，多个关键词用逗号分隔"
        />
        <p className="text-gray-400 text-xs mt-1">例如：感兴趣,有意向,需要了解</p>
      </div>

      {/* 符合条件的客户数量显示 */}
      {(formData.customerConditions.customerLevels.length > 0 || 
        formData.customerConditions.lastFollowUpDays || 
        formData.customerConditions.remarkKeywords) && (
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">{matchingCustomers}</span>
            </div>
            <div>
              <div className="text-white font-medium">符合条件的客户</div>
              <div className="text-blue-300 text-sm">共找到 {matchingCustomers} 位客户符合筛选条件</div>
            </div>
          </div>
        </div>
      )}

      {/* 时间设置 */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-white flex items-center space-x-2">
          <span>⏰</span>
          <span>时间设置</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">开始日期</label>
            <input
              type="date"
              value={formData.timeSettings.startDate}
              onChange={(e) => handleTimeSettingChange('startDate', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">结束日期</label>
            <input
              type="date"
              value={formData.timeSettings.endDate}
              onChange={(e) => handleTimeSettingChange('endDate', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">工作开始时间</label>
            <input
              type="time"
              value={formData.timeSettings.workingHours.start}
              onChange={(e) => handleTimeSettingChange('workingHours.start', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">工作结束时间</label>
            <input
              type="time"
              value={formData.timeSettings.workingHours.end}
              onChange={(e) => handleTimeSettingChange('workingHours.end', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors duration-200"
            />
          </div>
        </div>
        
        {/* 工作日选择 */}
        <div>
          <label className="block text-gray-300 text-sm font-medium mb-3">工作日设置</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '1', label: '周一' },
              { value: '2', label: '周二' },
              { value: '3', label: '周三' },
              { value: '4', label: '周四' },
              { value: '5', label: '周五' },
              { value: '6', label: '周六' },
              { value: '7', label: '周日' }
            ].map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => handleWorkingDaysChange(day.value)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${formData.timeSettings.workingDays.includes(day.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 模态框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <span>🚀</span>
            <span>创建外呼任务</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 步骤指示器 */}
        {renderStepIndicator()}

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}

          {/* 操作按钮 */}
          <div className="flex justify-between pt-6 border-t border-gray-700 mt-8">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
                >
                  上一步
                </button>
              )}
            </div>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                {currentStep < 2 ? '下一步' : '创建任务'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}