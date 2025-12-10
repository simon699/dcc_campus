'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../app/datepicker-custom.css';
import { leadsAPI, tasksAPI } from '../services/api';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
  fullCount?: number;
}
interface FilterCondition {
  id: string;
  type: 'car_model' | 'customer_level' | 'visit_status' | 'last_follow_time' | 'first_follow_time' | 'next_follow_time';
  label: string;
  value: string;
  options: FilterOption[];
  hasCustom?: boolean;
}

interface TaskCreationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (taskData: any) => void;
}

type StepType = 'select_condition' | 'select_option' | 'creating_task' | 'task_complete';

export default function TaskCreationDrawer({ isOpen, onClose, onTaskCreated }: TaskCreationDrawerProps) {
  const [currentStep, setCurrentStep] = useState<StepType>('select_condition');
  const [selectedConditions, setSelectedConditions] = useState<FilterCondition[]>([]);
  const [currentCondition, setCurrentCondition] = useState<FilterCondition | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [customTimeInput, setCustomTimeInput] = useState({
    startTime: null as Date | null,
    endTime: null as Date | null
  });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const [availableConditions, setAvailableConditions] = useState<FilterCondition[]>([]);
  const [isLoadingConditions, setIsLoadingConditions] = useState(true);

  const [taskName, setTaskName] = useState<string>('发起任务-');
  const [createdTaskData, setCreatedTaskData] = useState<any>(null);



  // 初始化筛选条件数据并请求真实数据
  useEffect(() => {
    if (isOpen) {
      setIsLoadingConditions(true);
      
      // 设置筛选条件结构
      const conditions: FilterCondition[] = [
        {
          id: '1',
          type: 'car_model',
          label: '选择产品',
          value: '',
          options: [] // 动态获取产品数据
        },
        {
          id: '2',
          type: 'customer_level',
          label: '选择客户等级',
          value: '',
          options: [] // 动态获取等级数据
        },
        {
          id: '3',
          type: 'visit_status',
          label: '选择是否到店',
          value: '',
          options: [] // 动态获取到店状态数据
        },
        {
          id: '4',
          type: 'last_follow_time',
          label: '选择最近跟进时间',
          value: '',
          options: [
            { value: 'today', label: '今天', count: 0 },
            { value: 'yesterday', label: '昨天', count: 0 },
            { value: 'this_week', label: '本周', count: 0 },
            { value: 'last_week', label: '上周', count: 0 },
            { value: 'this_month', label: '本月', count: 0 },
            { value: 'last_month', label: '上月', count: 0 },
            { value: 'custom', label: '自定义时间', count: 0 }
          ],
          hasCustom: true
        },
        {
          id: '5',
          type: 'first_follow_time',
          label: '选择首次跟进时间',
          value: '',
          options: [
            { value: 'today', label: '今天', count: 0 },
            { value: 'yesterday', label: '昨天', count: 0 },
            { value: 'this_week', label: '本周', count: 0 },
            { value: 'last_week', label: '上周', count: 0 },
            { value: 'this_month', label: '本月', count: 0 },
            { value: 'last_month', label: '上月', count: 0 },
            { value: 'custom', label: '自定义时间', count: 0 }
          ],
          hasCustom: true
        },
        {
          id: '6',
          type: 'next_follow_time',
          label: '选择下次跟进时间',
          value: '',
          options: [
            { value: 'today', label: '今天', count: 0 },
            { value: 'yesterday', label: '昨天', count: 0 },
            { value: 'this_week', label: '本周', count: 0 },
            { value: 'last_week', label: '上周', count: 0 },
            { value: 'this_month', label: '本月', count: 0 },
            { value: 'last_month', label: '上月', count: 0 },
            { value: 'custom', label: '自定义时间', count: 0 }
          ],
          hasCustom: true
        }
      ];
      
      setAvailableConditions(conditions);
      
      // 请求初始数据
      const fetchInitialData = async () => {
        try {
          // 获取产品数据
          const productResult = await leadsAPI.getFilteredCount({}, 'product');
          if (productResult.status === 'success' && productResult.data) {
            setAvailableConditions(prev => 
              prev.map(condition => {
                if (condition.type === 'car_model') {
                  // 动态创建产品选项
                  const productOptions = Array.isArray(productResult.data) 
                    ? productResult.data.map((item: any) => ({
                        value: item.category,
                        label: item.category,
                        count: item.count,
                        fullCount: item.count
                      }))
                    : productResult.data.by_product?.map((item: any) => ({
                        value: item.category,
                        label: item.category,
                        count: item.count,
                        fullCount: item.count
                      })) || [];
                  
                  return {
                    ...condition,
                    options: productOptions
                  };
                }
                return condition;
              })
            );
          }
          
          // 获取客户等级数据
          const typeResult = await leadsAPI.getFilteredCount({}, 'type');
          if (typeResult.status === 'success' && typeResult.data) {
            setAvailableConditions(prev => 
              prev.map(condition => {
                if (condition.type === 'customer_level') {
                  // 动态创建等级选项
                  const typeOptions = Array.isArray(typeResult.data) 
                    ? typeResult.data.map((item: any) => ({
                        value: item.category,
                        label: item.category,
                        count: item.count,
                        fullCount: item.count
                      }))
                    : typeResult.data.by_type?.map((item: any) => ({
                        value: item.category,
                        label: item.category,
                        count: item.count,
                        fullCount: item.count
                      })) || [];
                  
                  return {
                    ...condition,
                    options: typeOptions
                  };
                }
                return condition;
              })
            );
          }
          
          // 获取到店状态数据
          const arriveResult = await leadsAPI.getFilteredCount({}, 'arrive');
          if (arriveResult.status === 'success' && arriveResult.data) {
            setAvailableConditions(prev => 
              prev.map(condition => {
                if (condition.type === 'visit_status') {
                  // 动态创建到店状态选项
                  const arriveOptions = Array.isArray(arriveResult.data) 
                    ? arriveResult.data.map((item: any) => {
                        // 根据API返回的分类名称映射到对应的值
                        let value = '';
                        let label = item.category;
                        
                        if (item.category === '已到店') {
                          value = 'visited';
                        } else if (item.category === '未到店') {
                          value = 'not_visited';
                        } else {
                          // 处理其他可能的分类
                          value = item.category.toLowerCase().replace(/\s+/g, '_');
                        }
                        
                        return {
                          value: value,
                          label: label,
                          count: item.count,
                          fullCount: item.count
                        };
                      })
                    : arriveResult.data.by_arrive?.map((item: any) => {
                        // 根据API返回的分类名称映射到对应的值
                        let value = '';
                        let label = item.category;
                        
                        if (item.category === '已到店') {
                          value = 'visited';
                        } else if (item.category === '未到店') {
                          value = 'not_visited';
                        } else {
                          // 处理其他可能的分类
                          value = item.category.toLowerCase().replace(/\s+/g, '_');
                        }
                        
                        return {
                          value: value,
                          label: label,
                          count: item.count,
                          fullCount: item.count
                        };
                      }) || [];
                  
                  return {
                    ...condition,
                    options: arriveOptions
                  };
                }
                return condition;
              })
            );
          }
        } catch (error) {
          console.error('获取初始数据失败:', error);
        } finally {
          setIsLoadingConditions(false);
        }
      };
      
      fetchInitialData();
    }
  }, [isOpen]);



  // 处理条件选择完成，直接创建任务
  const handleConditionsComplete = () => {
    if (selectedConditions.length > 0) {
      // 直接创建任务，不需要选择场景
      handleCreateTask();
    } else {
      // 如果没有选择条件，提示用户
      alert('请至少选择一个筛选条件');
    }
  };

  // 根据筛选条件自动更新任务名称
  useEffect(() => {
    const newTaskName = generateTaskName(selectedConditions);
    setTaskName(newTaskName);
  }, [selectedConditions]);

  // 计算筛选后的数量
  useEffect(() => {
    const calculateFilteredCount = async () => {
      if (selectedConditions.length > 0) {
        setIsLoading(true);
        try {
          // 构建筛选参数
          const filters = buildCurrentFilters(selectedConditions);
          console.log('构建的筛选参数:', filters);

          // 检查是否包含时间筛选条件
          const hasTimeCondition = selectedConditions.some(condition => 
            condition.type === 'last_follow_time' || 
            condition.type === 'first_follow_time' || 
            condition.type === 'next_follow_time'
          );

          // 如果包含时间筛选条件，不传递filter_by参数
          const filterBy = hasTimeCondition ? undefined : 'both';
          console.log('使用的filterBy:', filterBy);
          
          // 调用API获取叠加筛选的统计
          const result = await leadsAPI.getFilteredCount(filters, filterBy);
          console.log('API返回结果:', result);
          
          if (result.status === 'success') {
            // 获取总数和线索ID列表
            if (result.data && result.data.total_count !== undefined) {
              setFilteredCount(result.data.total_count);
            } else if (Array.isArray(result.data)) {
              // 如果返回的是数组格式，计算总数
              const totalCount = result.data.reduce((acc: number, item: any) => acc + item.count, 0);
              setFilteredCount(totalCount);
            } else if (result.data.by_product || result.data.by_type) {
              // 如果有分类数据，计算总数
              let totalCount = 0;
              if (result.data.by_product) {
                totalCount = result.data.by_product.reduce((acc: number, item: any) => acc + item.count, 0);
              } else if (result.data.by_type) {
                totalCount = result.data.by_type.reduce((acc: number, item: any) => acc + item.count, 0);
              }
              setFilteredCount(totalCount);
            } else {
              setFilteredCount(0);
            }
          } else {
            setFilteredCount(0);
          }
        } catch (error) {
          console.error('计算筛选数量失败:', error);
          // 如果API调用失败，使用简单的计算
          const totalCount = selectedConditions.reduce((acc, condition) => {
            const selectedOption = condition.options.find(opt => opt.value === condition.value);
            return acc + (selectedOption?.count || 0);
          }, 0);
          setFilteredCount(totalCount);
        } finally {
          setIsLoading(false);
        }
      } else {
        setFilteredCount(0);
      }
    };

    calculateFilteredCount();
    
    // 监听筛选条件变化事件
    const handleFilterChanged = () => {
      calculateFilteredCount();
    };
    
    window.addEventListener('filterChanged', handleFilterChanged);
    
    return () => {
      window.removeEventListener('filterChanged', handleFilterChanged);
    };
  }, [selectedConditions]);

  const handleConditionTypeSelect = async (condition: FilterCondition) => {
    setCurrentCondition(condition);
    setShowCustomInput(false);
    setCustomTimeInput({ startTime: null, endTime: null });
    setIsLoadingOptions(true);
    
    // 检查是否已经选择了该条件
    const existingCondition = selectedConditions.find(selected => selected.id === condition.id);
    
    // 构建当前已选择的筛选条件
    const currentFilters = buildCurrentFilters(selectedConditions);
    
    // 根据条件类型确定筛选维度和API调用方式
    let filterBy: 'product' | 'type' | 'both' | 'arrive' | undefined = undefined;
    let apiParams: any = currentFilters;
    
    if (condition.type === 'car_model') {
      filterBy = 'product';
    } else if (condition.type === 'customer_level') {
      filterBy = 'type';
    } else if (condition.type === 'visit_status') {
      filterBy = 'arrive';
    } else if (condition.type === 'last_follow_time' || condition.type === 'first_follow_time' || condition.type === 'next_follow_time') {
      // 对于时间相关筛选条件，不传递filter_by，直接显示选项
      const updatedCondition = { ...condition };
      
      // 如果该条件已经被选择，保持其选择状态
      const existingCondition = selectedConditions.find(selected => selected.id === condition.id);
      if (existingCondition) {
        updatedCondition.value = existingCondition.value;
      }
      
      setCurrentCondition(updatedCondition);
      setIsLoadingOptions(false);
      return;
    }
    
    // 获取当前条件下的选项数量
    try {
      const result = await leadsAPI.getFilteredCount(apiParams, filterBy || undefined);
      
      if (result.status === 'success' && result.data) {
        console.log('API返回数据:', result.data);
        
        // 根据条件类型和API响应结构更新选项数量
        const updateOptionsWithCount = (options: any[], apiData: any, conditionType: string) => {
          console.log('updateOptionsWithCount 被调用:', { conditionType, apiData, options });
          
          if (conditionType === 'car_model') {
            // 对于车型，API返回的是直接的数组格式
            if (Array.isArray(apiData)) {
              console.log('处理车型数组格式:', apiData);
              
              // 保持原有选项结构，只更新数量
              return options.map(option => {
                const apiItem = apiData.find((item: any) => item.category === option.value);
                return {
                  ...option,
                  count: apiItem?.count || 0
                };
              });
            } else if (apiData.by_product) {
              // 兼容旧的嵌套格式
              return options.map(option => ({
                ...option,
                count: apiData.by_product.find((item: any) => item.category === option.value)?.count || 0
              }));
            }
          } else if (conditionType === 'customer_level') {
            // 对于客户等级，API返回的是直接的数组格式
            if (Array.isArray(apiData)) {
              console.log('处理客户等级数组格式:', apiData);
              
              // 保持原有选项结构，只更新数量
              return options.map(option => {
                const apiItem = apiData.find((item: any) => item.category === option.value);
                return {
                  ...option,
                  count: apiItem?.count || 0
                };
              });
            } else if (apiData.by_type) {
              return options.map(option => ({
                ...option,
                count: apiData.by_type.find((item: any) => item.category === option.value)?.count || 0
              }));
            }
          } else if (conditionType === 'visit_status') {
            // 对于是否到店，API返回的是直接的数组格式
            if (Array.isArray(apiData)) {
              console.log('处理是否到店数组格式:', apiData);
              
              // 动态创建到店状态选项
              return apiData.map((item: any) => {
                // 根据API返回的分类名称映射到对应的值
                let value = '';
                let label = item.category;
                
                if (item.category === '已到店') {
                  value = 'visited';
                } else if (item.category === '未到店') {
                  value = 'not_visited';
                } else {
                  // 处理其他可能的分类
                  value = item.category.toLowerCase().replace(/\s+/g, '_');
                }
                
                return {
                  value: value,
                  label: label,
                  count: item.count
                };
              });
            } else if (apiData.by_arrive) {
              // 兼容旧的嵌套格式
              return apiData.by_arrive.map((item: any) => {
                // 根据API返回的分类名称映射到对应的值
                let value = '';
                let label = item.category;
                
                if (item.category === '已到店') {
                  value = 'visited';
                } else if (item.category === '未到店') {
                  value = 'not_visited';
                } else {
                  // 处理其他可能的分类
                  value = item.category.toLowerCase().replace(/\s+/g, '_');
                }
                
                return {
                  value: value,
                  label: label,
                  count: item.count
                };
              });
            }
          } else if (conditionType === 'last_follow_time' || conditionType === 'first_follow_time' || conditionType === 'next_follow_time') {
            // 对于时间相关的筛选条件，我们使用总数作为每个选项的默认值
            const totalCount = apiData.total_count || 0;
            return options.map(option => ({
              ...option,
              count: option.value === 'custom' ? 0 : Math.floor(totalCount / (options.length - 1)) // 平均分配，自定义时间除外
            }));
          }
          return options;
        };
        
        // 更新availableConditions
        setAvailableConditions(prev => 
          prev.map(availableCondition => {
            if (availableCondition.id === condition.id) {
              return {
                ...availableCondition,
                options: updateOptionsWithCount(availableCondition.options, result.data, condition.type)
              };
            }
            return availableCondition;
          })
        );
        
        // 同时更新currentCondition，确保选项页面显示正确的数据
        const updatedCondition = {
          ...condition,
          options: updateOptionsWithCount(condition.options, result.data, condition.type)
        };
        
        // 如果该条件已经被选择，保持其选择状态
        const existingCondition = selectedConditions.find(selected => selected.id === condition.id);
        if (existingCondition) {
          updatedCondition.value = existingCondition.value;
        }
        
        setCurrentCondition(updatedCondition);
      }
    } catch (error) {
      console.error('获取筛选条件选项数量失败:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const handleOptionSelect = async (value: string) => {
    if (!currentCondition) return;

    if (value === 'custom' && currentCondition.hasCustom) {
      setShowCustomInput(true);
      return;
    }



    // 检查是否已经选择了该条件
    const existingConditionIndex = selectedConditions.findIndex(selected => selected.id === currentCondition.id);
    
    if (existingConditionIndex !== -1) {
      // 如果已经选择了该条件，检查是否是多选值
      const existingCondition = selectedConditions[existingConditionIndex];
      let newValue = value;
      
      if (existingCondition.value.includes(',')) {
        // 如果当前是多选值，检查是否已经包含新选择的值
        const existingValues = existingCondition.value.split(',');
        if (existingValues.includes(value)) {
          // 如果已经包含，则移除该值
          const newValues = existingValues.filter(v => v !== value);
          newValue = newValues.length > 0 ? newValues.join(',') : '';
        } else {
          // 如果不包含，则添加该值
          newValue = existingCondition.value + ',' + value;
        }
      } else {
        // 如果当前是单选值，检查是否已经选择了这个值
        if (existingCondition.value === value) {
          // 如果点击的是已选择的值，则取消选择
          newValue = '';
        } else {
          // 如果点击的是新值，则添加到现有选择中
          newValue = existingCondition.value + ',' + value;
        }
      }
      
      const newSelectedConditions = [...selectedConditions];
      
      if (newValue === '') {
        // 如果没有选择任何值，则移除这个筛选条件
        newSelectedConditions.splice(existingConditionIndex, 1);
      } else {
        // 否则更新筛选条件
        newSelectedConditions[existingConditionIndex] = { ...currentCondition, value: newValue };
      }
      
      setSelectedConditions(newSelectedConditions);
      
      // 如果是时间筛选条件，请求接口刷新符合条件的线索数
      if (currentCondition.type === 'last_follow_time' || currentCondition.type === 'first_follow_time' || currentCondition.type === 'next_follow_time') {
        // 触发重新计算筛选数量
        setTimeout(() => {
          const event = new Event('filterChanged');
          window.dispatchEvent(event);
        }, 100);
      }
    } else {
      // 如果是新选择，添加到筛选条件中
      const updatedCondition = { ...currentCondition, value: value };
      const newSelectedConditions = [...selectedConditions, updatedCondition];
      setSelectedConditions(newSelectedConditions);
      
      // 如果是时间筛选条件，请求接口刷新符合条件的线索数
      if (currentCondition.type === 'last_follow_time' || currentCondition.type === 'first_follow_time' || currentCondition.type === 'next_follow_time') {
        // 触发重新计算筛选数量
        setTimeout(() => {
          const event = new Event('filterChanged');
          window.dispatchEvent(event);
        }, 100);
      }
    }
  };

  const handleCustomTimeSubmit = () => {
    if (!currentCondition) return;

    let customValue = '';
    
    if (customTimeInput.startTime && customTimeInput.endTime) {
      // 选择了开始和结束时间
      const startTimeStr = formatLocalDate(customTimeInput.startTime);
      const endTimeStr = formatLocalDate(customTimeInput.endTime);
      customValue = `custom:${startTimeStr}_${endTimeStr}`;
    } else if (customTimeInput.startTime) {
      // 只选择了开始时间
      const startTimeStr = formatLocalDate(customTimeInput.startTime);
      customValue = `custom:${startTimeStr}_`;
    } else if (customTimeInput.endTime) {
      // 只选择了结束时间
      const endTimeStr = formatLocalDate(customTimeInput.endTime);
      customValue = `custom:_${endTimeStr}`;
    } else {
      return; // 至少需要选择一个时间
    }

    const updatedCondition = { ...currentCondition, value: customValue };
    
    // 检查是否已经选择了该条件
    const existingConditionIndex = selectedConditions.findIndex(selected => selected.id === currentCondition.id);
    
    let newSelectedConditions: FilterCondition[];
    
    if (existingConditionIndex !== -1) {
      // 如果已经选择了该条件，更新它
      newSelectedConditions = [...selectedConditions];
      newSelectedConditions[existingConditionIndex] = updatedCondition;
    } else {
      // 如果是新选择，添加到筛选条件中
      newSelectedConditions = [...selectedConditions, updatedCondition];
    }
    
    setSelectedConditions(newSelectedConditions);
    
    // 重置所有未使用的筛选条件的选项数量为0，等待用户点击时再获取
    setAvailableConditions(prev => 
      prev.map(condition => {
        if (!newSelectedConditions.some(selected => selected.id === condition.id)) {
          return {
            ...condition,
            options: condition.options.map(option => ({
              ...option,
              count: option.fullCount ?? 0
            }))
          };
        }
        return condition;
      })
    );
    
    setCurrentStep('select_condition');
    setCurrentCondition(null);
    setShowCustomInput(false);
    setCustomTimeInput({ startTime: null, endTime: null });
  };

  const handleCancelCustomInput = () => {
    setShowCustomInput(false);
    setCustomTimeInput({ startTime: null, endTime: null });
  };



  const handleRemoveCondition = async (conditionId: string) => {
    const newSelectedConditions = selectedConditions.filter(condition => condition.id !== conditionId);
    setSelectedConditions(newSelectedConditions);
    
    // 重置所有未使用的筛选条件的选项数量为0，等待用户点击时再获取
    setAvailableConditions(prev => 
      prev.map(condition => {
        if (!newSelectedConditions.some(selected => selected.id === condition.id)) {
          return {
            ...condition,
            options: condition.options.map(option => ({
              ...option,
              count: option.fullCount ?? 0
            }))
          };
        }
        return condition;
      })
    );
    
    // 如果移除的是当前选中的条件，重置状态
    if (currentCondition?.id === conditionId) {
      setCurrentCondition(null);
    }
  };

  const handleCreateTask = async () => {
    setCurrentStep('creating_task');
    setTaskProgress(0);
    
    try {
      // 构建API请求数据
      const sizeDesc = buildCurrentFilters(selectedConditions);
      console.log('构建的筛选条件数据:', sizeDesc);
      console.log('选中的条件:', selectedConditions);
      
      // 详细打印每个条件的信息
      selectedConditions.forEach((condition, index) => {
        console.log(`条件 ${index + 1}:`, {
          id: condition.id,
          type: condition.type,
          label: condition.label,
          value: condition.value,
          options: condition.options
        });
      });
      
      const apiTaskData = {
        task_name: taskName,
        script_id: "", // 移除场景script_id
        size_desc: sizeDesc
      };
      
      console.log('提交的API数据:', apiTaskData);
      
      // 调用API创建任务
      const response = await tasksAPI.createCallTask(apiTaskData);
      
      // 模拟进度更新
      const interval = setInterval(() => {
        setTaskProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setCurrentStep('task_complete');
            
            // 构建本地任务数据
            const taskData = {
              id: response.data.task_id,
              name: response.data.task_name,
              conditions: selectedConditions,
              filteredCount: response.data.leads_count,
              filters: buildCurrentFilters(selectedConditions),
              organization_id: response.data.organization_id,
              create_name: response.data.create_name,
              script_id: "", // 移除场景script_id
              selectedScene: null, // 移除场景信息
              apiResponse: response
            };
            
            // 保存创建的任务数据用于显示
            setCreatedTaskData(taskData);
            
            // 使用setTimeout避免在渲染过程中调用回调
            if (onTaskCreated) {
              setTimeout(() => {
                onTaskCreated(taskData);
              }, 0);
            }
            return 100;
          }
          return prev + 10;
        });
      }, 200);
      
    } catch (error) {
      console.error('创建任务失败:', error);
      // 处理错误，可以显示错误提示
      setCurrentStep('select_condition');
      alert('创建任务失败，请重试');
    }
  };

  // 处理场景选择
  const handleSceneSelect = (scene: any) => {
    // 移除场景选择相关的逻辑
  };

  const handleClose = () => {
    setCurrentStep('select_condition');
    setSelectedConditions([]);
    setCurrentCondition(null);
    setTaskProgress(0);
    setShowCustomInput(false);
    setCustomTimeInput({ startTime: null, endTime: null });
    setTaskName('发起任务-');
    setCreatedTaskData(null);
    onClose();
  };

  // 根据筛选条件生成任务名称
  const generateTaskName = (conditions: FilterCondition[]) => {
    if (conditions.length === 0) {
      return '发起任务-';
    }
    
    const conditionNames = conditions.map(condition => {
      if (condition.value.startsWith('custom:')) {
        // 自定义时间
        const customValue = condition.value.replace('custom:', '');
        const [startTime, endTime] = customValue.split('_');
        
        if (startTime && endTime) {
          return `${startTime}至${endTime}`;
        } else if (startTime) {
          return `从${startTime}开始`;
        } else if (endTime) {
          return `到${endTime}结束`;
        } else {
          return '自定义时间';
        }
      } else if (condition.type === 'last_follow_time' || condition.type === 'first_follow_time' || condition.type === 'next_follow_time') {
        // 时间筛选条件
        if (condition.value.includes(',')) {
          // 处理多选时间值
          const values = condition.value.split(',');
          const selectedOptions = values.map(value => {
            const timeRange = getTimeRange(value);
            if (timeRange) {
              return `${timeRange.start}至${timeRange.end}`;
            } else {
              const selectedOption = condition.options.find(opt => opt.value === value);
              return selectedOption?.label || value;
            }
          });
          return selectedOptions.join('；');
        } else {
          // 单选时间值
          const timeRange = getTimeRange(condition.value);
          if (timeRange) {
            return `${timeRange.start}至${timeRange.end}`;
          } else {
            const selectedOption = condition.options.find(opt => opt.value === condition.value);
            return selectedOption?.label || '';
          }
        }
      } else {
        // 其他筛选条件
        if (condition.value.includes(',')) {
          // 处理多选值
          const values = condition.value.split(',');
          const selectedOptions = values.map(value => 
            condition.options.find(opt => opt.value === value)?.label || value
          );
          return selectedOptions.join('、');
        } else {
          const selectedOption = condition.options.find(opt => opt.value === condition.value);
          return selectedOption?.label || '';
        }
      }
    });
    
    return `发起任务-${conditionNames.join('、')}`;
  };

  const getUnusedConditions = () => {
    return availableConditions.filter(condition => 
      !selectedConditions.some(selected => selected.id === condition.id)
    );
  };

  // 格式化本地日期为 YYYY-MM-DD 格式（避免时区问题）
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 获取时间范围的辅助函数
  const getTimeRange = (value: string) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (value) {
      case 'today':
        return {
          start: formatLocalDate(startOfDay),
          end: formatLocalDate(startOfDay)
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        return {
          start: formatLocalDate(startOfYesterday),
          end: formatLocalDate(startOfYesterday)
        };
      case 'this_week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return {
          start: formatLocalDate(startOfWeek),
          end: formatLocalDate(endOfWeek)
        };
      case 'last_week':
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return {
          start: formatLocalDate(startOfLastWeek),
          end: formatLocalDate(endOfLastWeek)
        };
      case 'this_month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: formatLocalDate(startOfMonth),
          end: formatLocalDate(endOfMonth)
        };
      case 'last_month':
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: formatLocalDate(startOfLastMonth),
          end: formatLocalDate(endOfLastMonth)
        };
      case 'next_week':
        const startOfNextWeek = new Date(today);
        startOfNextWeek.setDate(today.getDate() - today.getDay() + 7);
        const endOfNextWeek = new Date(startOfNextWeek);
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
        return {
          start: formatLocalDate(startOfNextWeek),
          end: formatLocalDate(endOfNextWeek)
        };
      case 'next_month':
        const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        return {
          start: formatLocalDate(startOfNextMonth),
          end: formatLocalDate(endOfNextMonth)
        };
      default:
        return null;
    }
  };

  // 构建时间参数的辅助函数
  const buildTimeParams = (conditionType: string, value: string) => {
    const params: any = {};
    
    if (value.startsWith('custom:')) {
      const [start, end] = value.split(':')[1].split('_');
      if (conditionType === 'last_follow_time') {
        params.latest_follow_start = start;
        params.latest_follow_end = end;
      } else if (conditionType === 'first_follow_time') {
        params.first_follow_start = start;
        params.first_follow_end = end;
      } else if (conditionType === 'next_follow_time') {
        params.next_follow_start = start;
        params.next_follow_end = end;
      }
    } else {
      // 处理预设时间选项
      const timeRange = getTimeRange(value);
      if (timeRange) {
        if (conditionType === 'last_follow_time') {
          params.latest_follow_start = timeRange.start;
          params.latest_follow_end = timeRange.end;
        } else if (conditionType === 'first_follow_time') {
          params.first_follow_start = timeRange.start;
          params.first_follow_end = timeRange.end;
        } else if (conditionType === 'next_follow_time') {
          params.next_follow_start = timeRange.start;
          params.next_follow_end = timeRange.end;
        }
      }
    }
    
    return params;
  };

  // 构建当前筛选条件的辅助函数
  const buildCurrentFilters = (conditions: FilterCondition[]): any => {
    const filters: any = {
      leads_type: [],
      leads_product: []
    };
    
    console.log('buildCurrentFilters 开始处理条件:', conditions);
    
    conditions.forEach(condition => {
      console.log('处理条件:', condition);
      
      if (condition.value && condition.value !== '') {
        if (condition.value.startsWith('custom:')) {
          console.log('处理自定义时间条件:', condition);
          const customValue = condition.value.replace('custom:', '');
          const [startTime, endTime] = customValue.split('_');
          
          if (condition.type === 'first_follow_time') {
            if (startTime) filters.first_follow_start = startTime;
            if (endTime) filters.first_follow_end = endTime;
          } else if (condition.type === 'last_follow_time') {
            if (startTime) filters.latest_follow_start = startTime;
            if (endTime) filters.latest_follow_end = endTime;
          } else if (condition.type === 'next_follow_time') {
            if (startTime) filters.next_follow_start = startTime;
            if (endTime) filters.next_follow_end = endTime;
          }
          console.log('自定义时间处理结果:', { startTime, endTime, filters });
        } else {
          if (condition.type === 'car_model') {
            // 处理多选值
            if (condition.value.includes(',')) {
              filters.leads_product = condition.value.split(',');
            } else {
              filters.leads_product = [condition.value];
            }
          } else if (condition.type === 'customer_level') {
            // 处理多选值
            if (condition.value.includes(',')) {
              filters.leads_type = condition.value.split(',');
            } else {
              filters.leads_type = [condition.value];
            }
          } else if (condition.type === 'visit_status') {
            // 处理多选值
            if (condition.value.includes(',')) {
              const values = condition.value.split(',');
              const arriveValues: number[] = [];
              
              // 处理每个选中的值
              values.forEach(value => {
                if (value === 'visited' || value === '1') {
                  arriveValues.push(1);
                } else if (value === 'not_visited' || value === '0') {
                  arriveValues.push(0);
                } else {
                  // 处理其他可能的动态值
                  // 尝试从value中提取数字，如果value包含数字，则使用该数字
                  const numericValue = parseInt(value);
                  if (!isNaN(numericValue)) {
                    arriveValues.push(numericValue);
                  }
                }
              });
              
              if (arriveValues.length > 0) {
                filters.is_arrive = arriveValues;
              }
            } else {
              // 单选值处理
              if (condition.value === 'visited' || condition.value === '1') {
                filters.is_arrive = [1];
              } else if (condition.value === 'not_visited' || condition.value === '0') {
                filters.is_arrive = [0];
              } else {
                // 处理其他可能的动态值
                const numericValue = parseInt(condition.value);
                if (!isNaN(numericValue)) {
                  filters.is_arrive = [numericValue];
                }
              }
            }
          } else if (condition.type === 'last_follow_time' || condition.type === 'first_follow_time' || condition.type === 'next_follow_time') {
            console.log('处理预设时间条件:', condition);
            // 处理预设时间选项
            if (condition.value.includes(',')) {
              // 处理多选时间值
              const timeValues = condition.value.split(',');
              console.log('多选时间值:', timeValues);
              const timeRanges: { start: string; end: string }[] = [];
              
              timeValues.forEach(timeValue => {
                const timeRange = getTimeRange(timeValue);
                console.log('时间值:', timeValue, '对应时间范围:', timeRange);
                if (timeRange) {
                  timeRanges.push(timeRange);
                }
              });
              
              if (timeRanges.length > 0) {
                // 对于多选时间，我们分别保存每个时间范围，而不是合并
                const timeRangeStrings = timeRanges.map(range => `${range.start}_${range.end}`);
                
                if (condition.type === 'first_follow_time') {
                  filters.first_follow_ranges = timeRangeStrings;
                  // 同时保存合并后的范围用于兼容性
                  const earliestStart = timeRanges.reduce((earliest, current) => 
                    current.start < earliest.start ? current : earliest
                  ).start;
                  const latestEnd = timeRanges.reduce((latest, current) => 
                    current.end > latest.end ? current : latest
                  ).end;
                  filters.first_follow_start = earliestStart;
                  filters.first_follow_end = latestEnd;
                } else if (condition.type === 'last_follow_time') {
                  filters.latest_follow_ranges = timeRangeStrings;
                  // 同时保存合并后的范围用于兼容性
                  const earliestStart = timeRanges.reduce((earliest, current) => 
                    current.start < earliest.start ? current : earliest
                  ).start;
                  const latestEnd = timeRanges.reduce((latest, current) => 
                    current.end > latest.end ? current : latest
                  ).end;
                  filters.latest_follow_start = earliestStart;
                  filters.latest_follow_end = latestEnd;
                } else if (condition.type === 'next_follow_time') {
                  filters.next_follow_ranges = timeRangeStrings;
                  // 同时保存合并后的范围用于兼容性
                  const earliestStart = timeRanges.reduce((earliest, current) => 
                    current.start < earliest.start ? current : earliest
                  ).start;
                  const latestEnd = timeRanges.reduce((latest, current) => 
                    current.end > latest.end ? current : latest
                  ).end;
                  filters.next_follow_start = earliestStart;
                  filters.next_follow_end = latestEnd;
                }
                
                console.log('多选时间处理结果:', { 
                  timeRanges, 
                  timeRangeStrings,
                  earliestStart: filters[`${condition.type === 'first_follow_time' ? 'first' : condition.type === 'last_follow_time' ? 'latest' : 'next'}_follow_start`],
                  latestEnd: filters[`${condition.type === 'first_follow_time' ? 'first' : condition.type === 'last_follow_time' ? 'latest' : 'next'}_follow_end`]
                });
              }
            } else {
              // 单选时间值
              console.log('单选时间值:', condition.value);
              const timeRange = getTimeRange(condition.value);
              console.log('单选时间范围:', timeRange);
              if (timeRange) {
                if (condition.type === 'first_follow_time') {
                  filters.first_follow_start = timeRange.start;
                  filters.first_follow_end = timeRange.end;
                } else if (condition.type === 'last_follow_time') {
                  filters.latest_follow_start = timeRange.start;
                  filters.latest_follow_end = timeRange.end;
                } else if (condition.type === 'next_follow_time') {
                  filters.next_follow_start = timeRange.start;
                  filters.next_follow_end = timeRange.end;
                }
              }
            }
          }
        }
      }
    });
    
    console.log('buildCurrentFilters 最终结果:', filters);
    return filters;
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-7xl w-full mx-4 h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          {currentStep === 'select_condition' ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">任务Agent - 筛选条件设置</h2>
                  <p className="text-gray-300">选择筛选条件类型，逐步设置筛选条件</p>
                </div>
                <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedConditions.length > 0 && (
                <div className="mb-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">任务名称</label>
                    <input
                      type="text"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="请输入任务名称"
                    />
                  </div>
                  

                  
                  <h3 className="text-lg font-semibold text-white mb-3">已设置的筛选条件</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedConditions.map((condition) => {
                      let displayValue = '';
                      
                      // 检查是否是时间相关筛选条件
                      const isTimeCondition = condition.type === 'last_follow_time' || 
                                           condition.type === 'first_follow_time' || 
                                           condition.type === 'next_follow_time';
                      
                      if (condition.value.startsWith('custom:')) {
                        // 自定义时间
                        const customValue = condition.value.replace('custom:', '');
                        const [startTime, endTime] = customValue.split('_');
                        
                        if (startTime && endTime) {
                          // 选择了开始和结束时间
                          displayValue = `${startTime} 至 ${endTime}`;
                        } else if (startTime) {
                          // 只选择了开始时间
                          displayValue = `从「${startTime}」开始`;
                        } else if (endTime) {
                          // 只选择了结束时间
                          displayValue = `到「${endTime}」结束`;
                        } else {
                          displayValue = '请选择时间';
                        }
                      } else if (isTimeCondition) {
                        // 时间筛选条件
                        if (condition.value.includes(',')) {
                          // 处理多选时间值
                          const values = condition.value.split(',');
                          const selectedOptions = values.map(value => {
                            const timeRange = getTimeRange(value);
                            if (timeRange) {
                              return `${timeRange.start} 至 ${timeRange.end}`;
                            } else {
                              const selectedOption = condition.options.find(opt => opt.value === value);
                              return selectedOption?.label || value;
                            }
                          });
                          displayValue = selectedOptions.join('；');
                        } else {
                          // 单选时间值
                          const timeRange = getTimeRange(condition.value);
                          if (timeRange) {
                            displayValue = `${timeRange.start} 至 ${timeRange.end}`;
                          } else {
                            const selectedOption = condition.options.find(opt => opt.value === condition.value);
                            displayValue = selectedOption?.label || '';
                          }
                        }
                      } else {
                        // 其他筛选条件
                        if (condition.value.includes(',')) {
                          // 处理多选值
                          const values = condition.value.split(',');
                          const selectedOptions = values.map(value => 
                            condition.options.find(opt => opt.value === value)?.label || value
                          );
                          displayValue = selectedOptions.join('、');
                        } else {
                          const selectedOption = condition.options.find(opt => opt.value === condition.value);
                          displayValue = selectedOption?.label || '';
                        }
                      }
                      
                      return (
                        <div key={condition.id} className="flex items-center bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-2">
                          <span className="text-blue-300 text-sm mr-2">{condition.label}:</span>
                          <span className="text-white text-sm mr-2">{displayValue}</span>
                          <button onClick={() => handleRemoveCondition(condition.id)} className="text-blue-400 hover:text-blue-300 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedConditions.length > 0 && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-200 font-medium">符合条件的线索数</span>
                    </div>
                    <div className="text-right">
                      {isLoading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-green-400 text-sm">计算中...</span>
                        </div>
                      ) : (
                        <div className="text-green-400 font-bold text-lg">{filteredCount}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex h-[500px]">
                {/* 左侧筛选条件列表 */}
                <div className="w-1/3 pr-4 border-r border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">筛选条件</h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {availableConditions.map((condition) => {
                      const isSelected = selectedConditions.some(selected => selected.id === condition.id);
                      const isCurrent = currentCondition?.id === condition.id;
                      
                      return (
                        <div
                          key={condition.id}
                          onClick={() => handleConditionTypeSelect(condition)}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                            isCurrent 
                              ? 'bg-blue-500/30 border border-blue-500/50' 
                              : isSelected 
                                ? 'bg-green-500/20 border border-green-500/30' 
                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className={`font-medium text-sm ${
                                isCurrent ? 'text-blue-300' : isSelected ? 'text-green-300' : 'text-white'
                              }`}>
                                {condition.label}
                              </h4>
                              {isSelected && (
                                <p className="text-xs text-gray-400 mt-1">
                                  已设置: {(() => {
                                    const selectedCondition = selectedConditions.find(selected => selected.id === condition.id);
                                    if (!selectedCondition) return '';
                                    
                                    if (selectedCondition.value.includes(',')) {
                                      // 处理多选值
                                      const values = selectedCondition.value.split(',');
                                      const selectedOptions = values.map(value => 
                                        condition.options.find(opt => opt.value === value)?.label || value
                                      );
                                      return selectedOptions.join('、');
                                    } else {
                                      return condition.options.find(opt => opt.value === selectedCondition.value)?.label || '';
                                    }
                                  })()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {isSelected && (
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              )}
                              <svg className={`w-4 h-4 ${
                                isCurrent ? 'text-blue-400' : 'text-gray-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 右侧内容区域 */}
                <div className="flex-1 pl-4">
                  {currentCondition ? (
                    <div>
                                        <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{currentCondition.label} 数据</h3>
                  </div>
                      
                      {isLoadingOptions ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-blue-300">正在获取数据...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-4">
                          {currentCondition.options.map((option, index) => {
                            const isTimeCondition = currentCondition.type === 'last_follow_time' || 
                                                 currentCondition.type === 'first_follow_time' || 
                                                 currentCondition.type === 'next_follow_time';

                            // 检查当前选项是否被选中
                            const existingCondition = selectedConditions.find(selected => selected.id === currentCondition.id);
                            const isSelected = existingCondition && (
                              existingCondition.value === option.value || 
                              existingCondition.value.includes(',' + option.value) ||
                              existingCondition.value.startsWith(option.value + ',') ||
                              existingCondition.value.endsWith(',' + option.value)
                            );
                            
                            if (isTimeCondition && option.value !== 'custom') {
                              const timeRange = getTimeRange(option.value);
                              return (
                                <div 
                                  key={`${currentCondition.id}-${option.value}-${index}`}
                                  className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-500/30 border-blue-500/50' 
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  }`}
                                  onClick={() => handleOptionSelect(option.value)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                        isSelected 
                                          ? 'bg-blue-500 border-blue-500' 
                                          : 'border-gray-400'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="text-white font-medium text-sm">{option.label}</h4>
                                        <p className="text-gray-400 text-xs mt-1">
                                          {timeRange ? `${timeRange.start} 至 ${timeRange.end}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-blue-400 font-bold text-sm">时间筛选</div>
                                      <div className="text-gray-400 text-xs">选择后刷新</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else if (isTimeCondition && option.value === 'custom') {
                              return (
                                <div 
                                  key={`${currentCondition.id}-${option.value}-${index}`}
                                  className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-500/30 border-blue-500/50' 
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  }`}
                                  onClick={() => handleOptionSelect(option.value)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                        isSelected 
                                          ? 'bg-blue-500 border-blue-500' 
                                          : 'border-gray-400'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="text-white font-medium text-sm">{option.label}</h4>
                                        <p className="text-gray-400 text-xs mt-1">自定义时间范围</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-blue-400 font-bold text-sm">时间筛选</div>
                                      <div className="text-gray-400 text-xs">选择后刷新</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div 
                                  key={`${currentCondition.id}-${option.value}-${index}`}
                                  className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-500/30 border-blue-500/50' 
                                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                                  }`}
                                  onClick={() => handleOptionSelect(option.value)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                        isSelected 
                                          ? 'bg-blue-500 border-blue-500' 
                                          : 'border-gray-400'
                                      }`}>
                                        {isSelected && (
                                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </div>
                                      <div>
                                        <h4 className="text-white font-medium text-sm">{option.label}</h4>
                                        <p className="text-gray-400 text-xs mt-1">包含线索</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-blue-400 font-bold text-sm">{option.count || 0}</div>
                                      <div className="text-gray-400 text-xs">线索数</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          })}
                        </div>
                      )}
                      
                      {/* 自定义时间输入界面 */}
                      {showCustomInput && currentCondition && (
                        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <h4 className="text-white font-medium mb-4">自定义时间范围</h4>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">开始时间</label>
                                <DatePicker
                                  selected={customTimeInput.startTime}
                                  onChange={(date) => setCustomTimeInput(prev => ({ ...prev, startTime: date }))}
                                  selectsStart
                                  startDate={customTimeInput.startTime || undefined}
                                  endDate={customTimeInput.endTime || undefined}
                                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                  placeholderText="选择开始时间"
                                  dateFormat="yyyy-MM-dd"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">结束时间</label>
                                <DatePicker
                                  selected={customTimeInput.endTime}
                                  onChange={(date) => setCustomTimeInput(prev => ({ ...prev, endTime: date }))}
                                  selectsEnd
                                  startDate={customTimeInput.startTime || undefined}
                                  endDate={customTimeInput.endTime || undefined}
                                  minDate={customTimeInput.startTime || undefined}
                                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                  placeholderText="选择结束时间"
                                  dateFormat="yyyy-MM-dd"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={handleCancelCustomInput}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={handleCustomTimeSubmit}
                                disabled={!customTimeInput.startTime && !customTimeInput.endTime}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                确定
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-gray-400">请从左侧选择筛选条件</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>


          ) : currentStep === 'creating_task' ? (
            <>
              <div className="text-center">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">正在创建任务</h2>
                  <p className="text-gray-300">系统正在处理您的筛选条件</p>
                </div>

                <div className="mb-8">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-16 h-16 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  </div>

                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${taskProgress}%` }}
                    ></div>
                  </div>
                  
                  <p className="text-gray-300 text-sm">
                    {taskProgress >= 100 ? '任务创建完成' : '正在创建任务...'}
                  </p>
                </div>
              </div>
            </>
          ) : currentStep === 'task_complete' ? (
            <>
              <div className="text-center">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">任务创建成功！</h2>
                  <p className="text-gray-300">外呼任务已创建，可以开始配置话术</p>
                </div>

                <div className="mb-8">
                  <div className="w-24 h-24 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  {createdTaskData && (
                    <div className="space-y-4 text-left max-w-md mx-auto">
                      <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                          <span className="text-blue-300 font-medium">任务信息</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">任务ID:</span>
                            <span className="text-white font-medium">{createdTaskData.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">任务名称:</span>
                            <span className="text-white font-medium">{createdTaskData.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">线索数量:</span>
                            <span className="text-green-400 font-bold">{createdTaskData.filteredCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">创建人:</span>
                            <span className="text-white">{createdTaskData.create_name}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                          <span className="text-purple-300 font-medium">下一步</span>
                        </div>
                        <p className="text-gray-300 text-sm">点击"话术生成Agent"配置个性化话术</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
        
        <div className="p-6 pt-0 border-t border-white/10">
          {currentStep === 'select_condition' && (
            <div className="flex justify-end space-x-3">
              <button onClick={handleClose} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                取消
              </button>
              <button
                onClick={handleConditionsComplete}
                disabled={selectedConditions.length === 0}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                创建任务
              </button>
            </div>
          )}
          

          

          
          {currentStep === 'task_complete' && (
            <div className="flex justify-center">
              <button onClick={handleClose} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                完成
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* 场景选择抽屉 */}
      {/* Removed SceneSelectionDrawer component */}
    </div>
  );
} 