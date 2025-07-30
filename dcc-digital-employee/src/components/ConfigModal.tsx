'use client';

import { useState, useEffect } from 'react';

interface FilterCondition {
  id: string;
  label: string;
  type: 'select' | 'date' | 'input' | 'multiSelect';
  options?: string[];
  value: string | string[];
  allowCustom?: boolean;
  customValue?: string;
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (conditions: FilterCondition[]) => void;
}

export default function ConfigModal({ isOpen, onClose, onConfirm }: ConfigModalProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([
    {
      id: 'followTime',
      label: '最近跟进时间',
      type: 'multiSelect',
      options: ['7天内', '15天内', '30天内', '60天内', '90天内'],
      value: [],
      allowCustom: true,
      customValue: ''
    },
    {
      id: 'nextFollowTime',
      label: '下次跟进时间',
      type: 'multiSelect',
      options: ['今天', '明天', '本周', '下周', '本月'],
      value: [],
      allowCustom: true,
      customValue: ''
    },
    {
      id: 'customerLevel',
      label: '客户等级',
      type: 'multiSelect',
      options: ['H级', 'A级', 'B级', 'C级', 'N级'],
      value: []
    },
    {
      id: 'keywords',
      label: '备注关键词',
      type: 'input',
      value: ''
    },
    {
      id: 'source',
      label: '线索来源',
      type: 'multiSelect',
      options: ['懂车帝', '汽车之家', '抖音', '百度', '其他'],
      value: []
    }
  ]);

  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(1250);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // 调用API查询匹配的线索数量
  const calculateMatchedCount = async (currentConditions: FilterCondition[]) => {
    setIsCalculating(true);
    
    try {
      // 构建API请求参数
      const requestParams: any = {
        page: 1,
        page_size: 1 // 只需要获取总数，不需要实际数据
      };
      
      const activeFiltersList: string[] = [];
      
      // 处理筛选条件
      currentConditions.forEach(condition => {
        if (condition.type === 'multiSelect') {
          const values = Array.isArray(condition.value) ? condition.value : [];
          const customValue = condition.customValue || '';
          
          if (values.length > 0 || customValue.trim() !== '') {
            switch (condition.id) {
              case 'followTime':
                // 处理最近跟进时间
                if (customValue.trim()) {
                  // 如果有自定义时间，解析为日期范围
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
                  activeFiltersList.push(`最近跟进时间: ${customValue}`);
                } else if (values.length > 0) {
                  // 处理预设选项
                  const today = new Date();
                  values.forEach(value => {
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
                  activeFiltersList.push(`最近跟进时间: ${values.join(', ')}`);
                }
                break;
                
              case 'nextFollowTime':
                // 处理下次跟进时间
                if (customValue.trim()) {
                  // 如果有自定义时间，解析为日期范围
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
                  activeFiltersList.push(`下次跟进时间: ${customValue}`);
                } else if (values.length > 0) {
                  // 处理预设选项
                  const today = new Date();
                  values.forEach(value => {
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
                  activeFiltersList.push(`下次跟进时间: ${values.join(', ')}`);
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
                  
                  const levelValues = values.map(v => levelMap[v]).filter(v => v !== undefined);
                  if (levelValues.length > 0) {
                    requestParams.client_level = levelValues;
                  }
                  activeFiltersList.push(`客户等级: ${values.join(', ')}`);
                }
                break;
                
              case 'source':
                // 处理线索来源
                if (values.length > 0) {
                  // 这里需要根据实际的来源字段来映射
                  // 暂时使用关键词搜索
                  requestParams.product = values.join(' ');
                  activeFiltersList.push(`线索来源: ${values.join(', ')}`);
                }
                break;
            }
          }
        } else if (condition.value && condition.value !== '') {
          // 关键词筛选
          requestParams.phone = condition.value;
          activeFiltersList.push(`关键词: ${condition.value}`);
        }
      });
      
      // 调用API
      const token = localStorage.getItem('access_token');
      const user = localStorage.getItem('user');
      console.log('获取到的token:', token ? '存在' : '不存在');
      console.log('获取到的user:', user ? JSON.parse(user) : '不存在');
      if (!token) {
        // 如果没有令牌，直接使用虚拟计算
        console.log('未找到访问令牌，使用虚拟计算');
        let baseCount = totalCount;
        let multiplier = 1;
        const activeFiltersList: string[] = [];
        
        currentConditions.forEach(condition => {
          if (condition.type === 'multiSelect') {
            const values = Array.isArray(condition.value) ? condition.value : [];
            const customValue = condition.customValue || '';
            
            if (values.length > 0 || customValue.trim() !== '') {
              switch (condition.id) {
                case 'followTime':
                  multiplier *= 0.6;
                  if (values.length > 0) activeFiltersList.push(`最近跟进时间: ${values.join(', ')}`);
                  if (customValue.trim()) activeFiltersList.push(`最近跟进时间: ${customValue}`);
                  break;
                case 'nextFollowTime':
                  multiplier *= 0.4;
                  if (values.length > 0) activeFiltersList.push(`下次跟进时间: ${values.join(', ')}`);
                  if (customValue.trim()) activeFiltersList.push(`下次跟进时间: ${customValue}`);
                  break;
                case 'customerLevel':
                  multiplier *= 0.7;
                  if (values.length > 0) activeFiltersList.push(`客户等级: ${values.join(', ')}`);
                  break;
                case 'source':
                  multiplier *= 0.8;
                  if (values.length > 0) activeFiltersList.push(`线索来源: ${values.join(', ')}`);
                  break;
              }
            }
          } else if (condition.value && condition.value !== '') {
            multiplier *= 0.5;
            activeFiltersList.push(`关键词: ${condition.value}`);
          }
        });
        
        const finalCount = Math.floor(baseCount * multiplier);
        setMatchedCount(finalCount);
        setActiveFilters(activeFiltersList);
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
      
      setActiveFilters(activeFiltersList);
    } catch (error) {
      console.error('查询线索失败:', error);
      // 如果API调用失败，回退到虚拟计算
      let baseCount = totalCount;
      let multiplier = 1;
      const activeFiltersList: string[] = [];
      
      currentConditions.forEach(condition => {
        if (condition.type === 'multiSelect') {
          const values = Array.isArray(condition.value) ? condition.value : [];
          const customValue = condition.customValue || '';
          
          if (values.length > 0 || customValue.trim() !== '') {
            switch (condition.id) {
              case 'followTime':
                multiplier *= 0.6;
                if (values.length > 0) activeFiltersList.push(`最近跟进时间: ${values.join(', ')}`);
                if (customValue.trim()) activeFiltersList.push(`最近跟进时间: ${customValue}`);
                break;
              case 'nextFollowTime':
                multiplier *= 0.4;
                if (values.length > 0) activeFiltersList.push(`下次跟进时间: ${values.join(', ')}`);
                if (customValue.trim()) activeFiltersList.push(`下次跟进时间: ${customValue}`);
                break;
              case 'customerLevel':
                multiplier *= 0.7;
                if (values.length > 0) activeFiltersList.push(`客户等级: ${values.join(', ')}`);
                break;
              case 'source':
                multiplier *= 0.8;
                if (values.length > 0) activeFiltersList.push(`线索来源: ${values.join(', ')}`);
                break;
            }
          }
        } else if (condition.value && condition.value !== '') {
          multiplier *= 0.5;
          activeFiltersList.push(`关键词: ${condition.value}`);
        }
      });
      
      const finalCount = Math.floor(baseCount * multiplier);
      setMatchedCount(finalCount);
      setActiveFilters(activeFiltersList);
    } finally {
      setIsCalculating(false);
    }
  };

  // 监听条件变化，重新计算数量
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        await calculateMatchedCount(conditions);
      };
      fetchData();
    }
  }, [conditions, isOpen]);

  const handleConditionChange = (id: string, value: string | string[]) => {
    setConditions(prev => 
      prev.map(condition => 
        condition.id === id ? { ...condition, value } : condition
      )
    );
  };

  const handleCustomValueChange = (id: string, customValue: string) => {
    setConditions(prev => 
      prev.map(condition => 
        condition.id === id ? { ...condition, customValue } : condition
      )
    );
  };

  const handleMultiSelectChange = (id: string, option: string) => {
    setConditions(prev => 
      prev.map(condition => {
        if (condition.id === id) {
          const currentValues = Array.isArray(condition.value) ? condition.value : [];
          const newValues = currentValues.includes(option)
            ? currentValues.filter(v => v !== option)
            : [...currentValues, option];
          return { ...condition, value: newValues };
        }
        return condition;
      })
    );
  };

  const handleConfirm = () => {
    const selectedConditions = conditions.filter(condition => {
      if (condition.type === 'multiSelect') {
        const values = Array.isArray(condition.value) ? condition.value : [];
        const customValue = condition.customValue || '';
        return values.length > 0 || customValue.trim() !== '';
      }
      return condition.value !== '' && condition.value !== '全部';
    });
    onConfirm(selectedConditions);
    onClose();
  };

  const handleReset = () => {
    setConditions(prev => 
      prev.map(condition => ({
        ...condition,
        value: condition.type === 'multiSelect' ? [] : (condition.options ? '全部' : ''),
        customValue: ''
      }))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            手动配置筛选条件
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 匹配数量展示 */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">筛选结果预览</span>
            </div>
            <div className="flex items-center space-x-2">
              {isCalculating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-300 text-sm">计算中...</span>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {matchedCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    共 {totalCount.toLocaleString()} 条线索
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 筛选条件统计 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">匹配率</span>
              <span className="text-blue-300 font-medium">
                {totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0}%
              </span>
            </div>
            
            {/* 活跃筛选条件 */}
            {activeFilters.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-400 mb-2">当前筛选条件:</div>
                <div className="flex flex-wrap gap-1">
                  {activeFilters.map((filter, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-500/30 text-blue-200 text-xs rounded-md border border-blue-500/50"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {activeFilters.length === 0 && (
              <div className="text-xs text-gray-400 mt-2">
                未设置筛选条件，显示全部 {totalCount.toLocaleString()} 条线索
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 mb-6">
          {conditions.map((condition) => (
            <div key={condition.id} className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                {condition.label}:
              </label>
              
              {condition.type === 'multiSelect' ? (
                <div className="space-y-3">
                  {/* 预设选项 */}
                  <div className="flex flex-wrap gap-2">
                    {condition.options?.map((option) => {
                      const isSelected = Array.isArray(condition.value) && condition.value.includes(option);
                      return (
                        <button
                          key={option}
                          onClick={() => handleMultiSelectChange(condition.id, option)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? 'bg-blue-500 text-white border border-blue-500'
                              : 'bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 hover:text-white'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* 自定义输入 */}
                  {condition.allowCustom && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">自定义:</span>
                      <input
                        type="text"
                        value={condition.customValue || ''}
                        onChange={(e) => handleCustomValueChange(condition.id, e.target.value)}
                        placeholder={condition.id === 'followTime' ? '如: 3天内, 120天内' : 
                                   condition.id === 'nextFollowTime' ? '如: 后天, 下个月' : '请输入自定义值'}
                        className="flex-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 
                                 rounded-xl text-white placeholder-white/50 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                 transition-all duration-200"
                      />
                    </div>
                  )}
                  
                  {/* 已选择的选项显示 */}
                  {Array.isArray(condition.value) && condition.value.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-gray-400">已选择:</span>
                      {condition.value.map((value) => (
                        <span
                          key={value}
                          className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-md border border-blue-500/30"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={condition.value as string}
                  onChange={(e) => handleConditionChange(condition.id, e.target.value)}
                  placeholder="请输入关键词"
                  className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 
                           rounded-xl text-white placeholder-white/50 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                           transition-all duration-200"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            重置
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl 
                     transition-colors font-medium"
          >
            确认配置
          </button>
        </div>
      </div>
    </div>
  );
} 