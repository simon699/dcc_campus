'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../app/datepicker-custom.css';
import { leadsAPI, tasksAPI } from '../services/api';

interface FilterCondition {
  id: string;
  type: 'car_model' | 'customer_level' | 'visit_status' | 'last_follow_time' | 'first_follow_time' | 'next_follow_time';
  label: string;
  value: string;
  options: { value: string; label: string; count?: number }[];
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
  const [showTimeResult, setShowTimeResult] = useState(false);
  const [selectedTimeValue, setSelectedTimeValue] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('发起任务-');
  const [createdTaskData, setCreatedTaskData] = useState<any>(null);

  // 初始化筛选条件数据（不请求数据，只展示结构）
  useEffect(() => {
    if (isOpen) {
      setIsLoadingConditions(true);
      
      // 直接设置筛选条件结构，不请求数据
      const conditions: FilterCondition[] = [
        {
          id: '1',
          type: 'car_model',
          label: '选择产品',
          value: '',
          options: [
            { value: '产品A', label: '产品A', count: 0 },
            { value: '产品B', label: '产品B', count: 0 },
            { value: '产品C', label: '产品C', count: 0 }
          ]
        },
        {
          id: '2',
          type: 'customer_level',
          label: '选择客户等级',
          value: '',
          options: [
            { value: 'H级', label: 'H级', count: 0 },
            { value: '高价值客户', label: '高价值客户', count: 0 },
            { value: '中等客户', label: '中等客户', count: 0 }
          ]
        },
        {
          id: '3',
          type: 'visit_status',
          label: '选择是否到店',
          value: '',
          options: [
            { value: 'visited', label: '已到店', count: 0 },
            { value: 'not_visited', label: '未到店', count: 0 },
            { value: 'scheduled', label: '已预约', count: 0 }
          ]
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
            { value: 'next_week', label: '下周', count: 0 },
            { value: 'this_month', label: '本月', count: 0 },
            { value: 'next_month', label: '下月', count: 0 },
            { value: 'custom', label: '自定义时间', count: 0 }
          ],
          hasCustom: true
        }
      ];
      
      setAvailableConditions(conditions);
      setIsLoadingConditions(false);
    }
  }, [isOpen]);

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
  }, [selectedConditions]);

  const handleConditionTypeSelect = async (condition: FilterCondition) => {
    setCurrentCondition(condition);
    setCurrentStep('select_option');
    setShowCustomInput(false);
    setCustomTimeInput({ startTime: null, endTime: null });
    setShowTimeResult(false);
    setSelectedTimeValue('');
    setIsLoadingOptions(true);
    
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
      setCurrentCondition(condition);
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
              
              // 动态更新选项，使用API返回的实际数据
              const updatedOptions = apiData.map((item: any) => ({
                value: item.category,
                label: item.category,
                count: item.count
              }));
              
              console.log('动态更新后的选项:', updatedOptions);
              return updatedOptions;
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
              
              // 动态更新选项，使用API返回的实际数据
              const updatedOptions = apiData.map((item: any) => ({
                value: item.category,
                label: item.category,
                count: item.count
              }));
              
              console.log('动态更新后的客户等级选项:', updatedOptions);
              return updatedOptions;
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
              
              // 动态更新选项，使用API返回的实际数据
              const updatedOptions = apiData.map((item: any) => ({
                value: item.category === '已到店' ? 'visited' : 
                       item.category === '未到店' ? 'not_visited' : 'scheduled',
                label: item.category,
                count: item.count
              }));
              
              console.log('动态更新后的到店状态选项:', updatedOptions);
              return updatedOptions;
            } else if (apiData.by_arrive) {
              return options.map(option => ({
                ...option,
                count: apiData.by_arrive.find((item: any) => {
                  const itemValue = item.category === '已到店' ? 'visited' : 
                                  item.category === '未到店' ? 'not_visited' : 'scheduled';
                  return itemValue === option.value;
                })?.count || 0
              }));
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
    } else {
      // 如果是时间相关筛选条件，需要调用API获取实际数据
      if (currentCondition.type === 'last_follow_time' || currentCondition.type === 'first_follow_time' || currentCondition.type === 'next_follow_time') {
        try {
          // 构建时间参数
          const timeParams = buildTimeParams(currentCondition.type, value);
          const currentFilters = buildCurrentFilters(selectedConditions);
          
          // 调用API获取数据，不传递filter_by参数
          const result = await leadsAPI.getFilteredCount({
            ...currentFilters,
            ...timeParams
          }, undefined);
          
          if (result.status === 'success' && result.data) {
            console.log('时间筛选API返回数据:', result.data);
            // 更新当前条件的选项数量
            const updatedOptions = currentCondition.options.map(option => ({
              ...option,
              count: option.value === value ? (result.data.total_count || 0) : 0
            }));
            
            const updatedCondition = {
              ...currentCondition,
              options: updatedOptions
            };
            
            // 更新availableConditions
            setAvailableConditions(prev => 
              prev.map(condition => {
                if (condition.id === currentCondition.id) {
                  return updatedCondition;
                }
                return condition;
              })
            );
            
            setCurrentCondition(updatedCondition);
            setShowTimeResult(true);
            setSelectedTimeValue(value);
            // 对于时间筛选条件，显示确认按钮而不是立即添加到selectedConditions
            return;
          }
        } catch (error) {
          console.error('获取时间筛选数据失败:', error);
        }
      }
      
      const updatedCondition = { ...currentCondition, value };
      
      // 构建当前筛选条件（包括新选择的筛选条件）
      const newSelectedConditions = [...selectedConditions, updatedCondition];
      
      // 更新选中的筛选条件
      setSelectedConditions(newSelectedConditions);
      
      // 重置所有未使用的筛选条件的选项数量为0，等待用户点击时再获取
      setAvailableConditions(prev => 
        prev.map(condition => {
          if (!newSelectedConditions.some(selected => selected.id === condition.id)) {
            return {
              ...condition,
              options: condition.options.map(option => ({
                ...option,
                count: 0
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
    }
  };

  const handleCustomTimeSubmit = () => {
    if (!currentCondition) return;

    let customValue = '';
    
    if (customTimeInput.startTime && customTimeInput.endTime) {
      // 选择了开始和结束时间
      const startTimeStr = customTimeInput.startTime.toISOString().split('T')[0];
      const endTimeStr = customTimeInput.endTime.toISOString().split('T')[0];
      customValue = `custom:${startTimeStr}_${endTimeStr}`;
    } else if (customTimeInput.startTime) {
      // 只选择了开始时间
      const startTimeStr = customTimeInput.startTime.toISOString().split('T')[0];
      customValue = `custom:${startTimeStr}_`;
    } else if (customTimeInput.endTime) {
      // 只选择了结束时间
      const endTimeStr = customTimeInput.endTime.toISOString().split('T')[0];
      customValue = `custom:_${endTimeStr}`;
    } else {
      return; // 至少需要选择一个时间
    }

    const updatedCondition = { ...currentCondition, value: customValue };
    const newSelectedConditions = [...selectedConditions, updatedCondition];
    setSelectedConditions(newSelectedConditions);
    
    // 重置所有未使用的筛选条件的选项数量为0，等待用户点击时再获取
    setAvailableConditions(prev => 
      prev.map(condition => {
        if (!newSelectedConditions.some(selected => selected.id === condition.id)) {
          return {
            ...condition,
            options: condition.options.map(option => ({
              ...option,
              count: 0
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

  const handleConfirmTimeSelection = () => {
    if (!currentCondition || !selectedTimeValue) return;
    
    const updatedCondition = { ...currentCondition, value: selectedTimeValue };
    const newSelectedConditions = [...selectedConditions, updatedCondition];
    setSelectedConditions(newSelectedConditions);
    
    // 重置所有未使用的筛选条件的选项数量为0，等待用户点击时再获取
    setAvailableConditions(prev => 
      prev.map(condition => {
        if (!newSelectedConditions.some(selected => selected.id === condition.id)) {
          return {
            ...condition,
            options: condition.options.map(option => ({
              ...option,
              count: 0
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
    setShowTimeResult(false);
    setSelectedTimeValue('');
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
              count: 0
            }))
          };
        }
        return condition;
      })
    );
  };

  const handleCreateTask = async () => {
    setCurrentStep('creating_task');
    setTaskProgress(0);
    
    try {
      // 构建API请求数据
      const apiTaskData = {
        task_name: taskName,
        scene_id: "", // 暂时为空，后续可以添加场景选择
        size_desc: buildCurrentFilters(selectedConditions)
      };
      
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
              apiResponse: response
            };
            
            // 保存创建的任务数据用于显示
            setCreatedTaskData(taskData);
            
            // 调用回调函数传递任务数据
            if (onTaskCreated) {
              onTaskCreated(taskData);
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
        // 预设时间选项
        const timeRange = getTimeRange(condition.value);
        if (timeRange) {
          return `${timeRange.start}至${timeRange.end}`;
        } else {
          const selectedOption = condition.options.find(opt => opt.value === condition.value);
          return selectedOption?.label || '';
        }
      } else {
        // 其他筛选条件
        const selectedOption = condition.options.find(opt => opt.value === condition.value);
        return selectedOption?.label || '';
      }
    });
    
    return `发起任务-${conditionNames.join('、')}`;
  };

  const getUnusedConditions = () => {
    return availableConditions.filter(condition => 
      !selectedConditions.some(selected => selected.id === condition.id)
    );
  };

  // 获取时间范围的辅助函数
  const getTimeRange = (value: string) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (value) {
      case 'today':
        return {
          start: startOfDay.toISOString().split('T')[0],
          end: startOfDay.toISOString().split('T')[0]
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        return {
          start: startOfYesterday.toISOString().split('T')[0],
          end: startOfYesterday.toISOString().split('T')[0]
        };
      case 'this_week':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return {
          start: startOfWeek.toISOString().split('T')[0],
          end: endOfWeek.toISOString().split('T')[0]
        };
      case 'last_week':
        const startOfLastWeek = new Date(today);
        startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return {
          start: startOfLastWeek.toISOString().split('T')[0],
          end: endOfLastWeek.toISOString().split('T')[0]
        };
      case 'this_month':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          start: startOfMonth.toISOString().split('T')[0],
          end: endOfMonth.toISOString().split('T')[0]
        };
      case 'last_month':
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: startOfLastMonth.toISOString().split('T')[0],
          end: endOfLastMonth.toISOString().split('T')[0]
        };
      case 'next_week':
        const startOfNextWeek = new Date(today);
        startOfNextWeek.setDate(today.getDate() - today.getDay() + 7);
        const endOfNextWeek = new Date(startOfNextWeek);
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
        return {
          start: startOfNextWeek.toISOString().split('T')[0],
          end: endOfNextWeek.toISOString().split('T')[0]
        };
      case 'next_month':
        const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        return {
          start: startOfNextMonth.toISOString().split('T')[0],
          end: endOfNextMonth.toISOString().split('T')[0]
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
  const buildCurrentFilters = (conditions: FilterCondition[]) => {
    const filters: any = {};
    
    conditions.forEach(condition => {
      if (condition.value && condition.value !== '') {
        if (condition.value.startsWith('custom:')) {
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
        } else {
          if (condition.type === 'car_model') {
            filters.leads_product = condition.value;
          } else if (condition.type === 'customer_level') {
            filters.leads_type = condition.value;
          } else if (condition.type === 'visit_status') {
            if (condition.value === 'visited') {
              filters.is_arrive = 1;
            } else if (condition.value === 'not_visited') {
              filters.is_arrive = 0;
            }
          } else if (condition.type === 'last_follow_time' || condition.type === 'first_follow_time' || condition.type === 'next_follow_time') {
            // 处理预设时间选项
            const timeRange = getTimeRange(condition.value);
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
    });
    
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
                        // 预设时间选项，显示具体时间段
                        const timeRange = getTimeRange(condition.value);
                        if (timeRange) {
                          displayValue = `${timeRange.start} 至 ${timeRange.end}`;
                        } else {
                          const selectedOption = condition.options.find(opt => opt.value === condition.value);
                          displayValue = selectedOption?.label || '';
                        }
                      } else {
                        // 其他筛选条件
                        const selectedOption = condition.options.find(opt => opt.value === condition.value);
                        displayValue = selectedOption?.label || '';
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
                          <span className="text-green-300">计算中...</span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-green-400">{filteredCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 min-h-[400px]">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {selectedConditions.length === 0 ? '选择第一个筛选条件' : '添加更多筛选条件'}
                </h3>
                
                {isLoadingConditions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-blue-300">正在加载筛选条件...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getUnusedConditions().map((condition) => (
                        <div 
                          key={condition.id} 
                          className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                          onClick={() => handleConditionTypeSelect(condition)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white font-medium">{condition.label}</h4>
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <p className="text-gray-400 text-sm">点击获取数据并选择选项</p>
                        </div>
                      ))}
                    </div>
                    
                    {getUnusedConditions().length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-300">已设置所有筛选条件</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : currentStep === 'select_option' && currentCondition ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">选择 {currentCondition.label}</h2>
                  <p className="text-gray-300">请选择具体的筛选选项</p>
                </div>
                <button onClick={() => {
                  setCurrentStep('select_condition');
                  setShowCustomInput(false);
                  setCustomTimeInput({ startTime: null, endTime: null });
                }} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6 min-h-[300px]">
                {showCustomInput ? (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-8 min-h-[400px]">
                    <h4 className="text-white font-medium mb-6">自定义时间范围</h4>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">开始时间</label>
                          <DatePicker
                            selected={customTimeInput.startTime || undefined}
                            onChange={(date) => setCustomTimeInput(prev => ({ ...prev, startTime: date }))}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholderText="选择开始时间"
                            dateFormat="yyyy年MM月dd日"
                            autoFocus
                            isClearable
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={15}
                            showMonthDropdown
                            dropdownMode="select"
                            popperPlacement="top-start"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">结束时间</label>
                          <DatePicker
                            selected={customTimeInput.endTime || undefined}
                            onChange={(date) => setCustomTimeInput(prev => ({ ...prev, endTime: date }))}
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholderText="选择结束时间"
                            dateFormat="yyyy年MM月dd日"
                            isClearable
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={15}
                            showMonthDropdown
                            dropdownMode="select"
                            minDate={customTimeInput.startTime || undefined}
                            popperPlacement="top-start"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-4 pt-4">
                        <button
                          onClick={handleCustomTimeSubmit}
                          disabled={!customTimeInput.startTime && !customTimeInput.endTime}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          确定
                        </button>
                        <button onClick={handleCancelCustomInput} className="px-6 py-3 text-gray-300 hover:text-white transition-colors">
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isLoadingOptions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-blue-300">正在获取选项数据...</span>
                    </div>
                  </div>
                ) : showTimeResult ? (
                  <div>
                    <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-green-200 font-medium">筛选结果</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-green-400">
                            {currentCondition.options.find(opt => opt.value === selectedTimeValue)?.count || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={handleConfirmTimeSelection}
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                      >
                        确认选择
                      </button>
                      <button 
                        onClick={() => {
                          setShowTimeResult(false);
                          setSelectedTimeValue('');
                        }} 
                        className="px-6 py-3 text-gray-300 hover:text-white transition-colors"
                      >
                        重新选择
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentCondition.options.map((option, index) => {
                      // 对于时间相关筛选条件，显示时间区间
                      const isTimeCondition = currentCondition.type === 'last_follow_time' || 
                                           currentCondition.type === 'first_follow_time' || 
                                           currentCondition.type === 'next_follow_time';
                      
                      if (isTimeCondition && option.value !== 'custom') {
                        const timeRange = getTimeRange(option.value);
                        return (
                          <div 
                            key={`${currentCondition.id}-${option.value}-${index}`}
                            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => handleOptionSelect(option.value)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-white font-medium">{option.label}</h4>
                                <p className="text-gray-400 text-sm mt-1">时间区间</p>
                              </div>
                              <div className="text-right">
                                <div className="text-blue-400 font-bold text-sm">
                                  {timeRange ? `${timeRange.start} 至 ${timeRange.end}` : ''}
                                </div>
                                <div className="text-gray-400 text-xs">时间范围</div>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (isTimeCondition && option.value === 'custom') {
                        // 自定义时间选项
                        return (
                          <div 
                            key={`${currentCondition.id}-${option.value}-${index}`}
                            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => handleOptionSelect(option.value)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-white font-medium">{option.label}</h4>
                                <p className="text-gray-400 text-sm mt-1">请选择时间</p>
                              </div>
                              <div className="text-right">
                                <div className="text-blue-400 font-bold text-sm">自定义</div>
                                <div className="text-gray-400 text-xs">时间范围</div>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div 
                            key={`${currentCondition.id}-${option.value}-${index}`}
                            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => handleOptionSelect(option.value)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-white font-medium">{option.label}</h4>
                                <p className="text-gray-400 text-sm mt-1">包含 {option.count} 个线索</p>
                              </div>
                              <div className="text-right">
                                <div className="text-blue-400 font-bold text-lg">{option.count}</div>
                                <div className="text-gray-400 text-xs">线索数</div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
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
                onClick={handleCreateTask}
                disabled={selectedConditions.length === 0}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                创建任务
              </button>
            </div>
          )}
          
          {currentStep === 'select_option' && (
            <div className="flex justify-end">
              <button onClick={() => setCurrentStep('select_condition')} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                返回
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
    </div>
  );
} 