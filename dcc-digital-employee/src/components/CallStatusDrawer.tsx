'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { tasksAPI } from '../services/api';

interface CallJob {
  job_id: string;
  job_group_id: string;
  status: string;
  priority: number;
  failure_reason?: string;
  result?: string;
  created_time: string;
  modified_time: string;
  db_record?: any;
  raw_data?: {
    JobId: string;
    JobGroupId: string;
    Status: string;
    Priority: number;
    SystemPriority?: number;
    ScenarioId?: string;
    StrategyId?: string;
    Contacts: Array<{
      ContactId: string;
      ContactName: string;
      PhoneNumber: string;
      ReferenceId: string;
    }>;
    Tasks: Array<{
      TaskId: string;
      CallId: string;
      Status: string;
      CalledNumber: string;
      CallingNumber: string;
      Duration: number;
      ActualTime: number;
      PlanedTime: number;
      ChatbotId?: string;
      JobId?: string;
      Contact?: {
        ReferenceId: string;
        PhoneNumber: string;
        ContactId: string;
        ContactName: string;
      };
      Conversation: Array<{
        Speaker: string;
        Script: string;
        Timestamp: number;
        Summary?: string[];
      }>;
    }>;
    Summary: Array<{
      SummaryName: string;
      Content: string;
    }>;
    Extras?: Array<{
      Key: string;
      Value: string;
    }>;
    CallingNumbers?: string[];
  };
}

interface CallStatusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  onRefresh?: () => void; // 添加刷新回调函数
  taskType?: number; // 添加任务类型参数
  onTaskTypeChange?: (newTaskType: number) => void; // 添加任务类型变化回调
}

// 状态缓存
const statusCache = new Map<string, {
  data: any;
  timestamp: number;
  cacheDuration: number;
}>();

export default function CallStatusDrawer({ isOpen, onClose, taskId, taskName, onRefresh, taskType, onTaskTypeChange }: CallStatusDrawerProps) {
  const [callJobs, setCallJobs] = useState<CallJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [taskStatus, setTaskStatus] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // 固定每页20条
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const minFetchInterval = 3000; // 最小3秒间隔
  const pendingFetchRef = useRef<Promise<any> | null>(null); // 正在进行的请求锁

  // 检查缓存是否有效
  const isCacheValid = (cacheKey: string, cacheDuration: number = 30000) => {
    const cached = statusCache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cacheDuration;
  };

  // 获取缓存数据
  const getCachedData = (cacheKey: string) => {
    const cached = statusCache.get(cacheKey);
    return cached ? cached.data : null;
  };

  // 设置缓存数据
  const setCachedData = (cacheKey: string, data: any, cacheDuration: number = 30000) => {
    statusCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      cacheDuration
    });
  };

  // 防抖的获取任务详情函数（初始加载时不防抖，直接加载）
  const debouncedFetchCallStatus = useCallback((isInitial: boolean = false) => {
    // 如果已经有请求在进行，跳过
    if (isInitial && pendingFetchRef.current) {
      console.log('CallStatusDrawer: 初始加载时已有请求在进行，跳过');
      return;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isInitial) {
      // 初始加载时立即执行，不防抖，跳过时间间隔检查
      fetchCallStatus(false, true);
    } else {
      // 后续刷新时使用防抖
      debounceTimerRef.current = setTimeout(() => {
        fetchCallStatus();
      }, 500); // 500ms防抖
    }
  }, []);

  // 获取任务详情和job_ids（支持追加模式）
  const fetchCallStatus = async (append: boolean = false, skipIntervalCheck: boolean = false) => {
    if (!isOpen || !taskId) return;

    // 如果已经有正在进行的请求（非追加模式），等待它完成或直接返回
    if (!append && pendingFetchRef.current) {
      console.log('CallStatusDrawer: 已有请求正在进行，跳过重复请求');
      try {
        await pendingFetchRef.current;
      } catch (e) {
        // 忽略错误，继续执行
      }
      return;
    }

    const now = Date.now();
    
    // 初始加载时，先检查缓存，如果有有效的缓存直接使用，避免重复请求
    if (!append && skipIntervalCheck) {
      const cacheKey = `task_execution_${taskId}_1_${pageSize}`;
      if (isCacheValid(cacheKey, 10000)) { // 10秒缓存
        const cachedData = getCachedData(cacheKey);
        if (cachedData && cachedData.status === 'success') {
          // 使用缓存数据，不发起新请求
          const taskData = cachedData.data;
          const totalJobs = taskData.total_jobs || 0;
          setTotalCount(totalJobs);
          
          if (taskData.pagination) {
            const { page: currentPageNum, total_pages } = taskData.pagination;
            setHasMore(currentPageNum < total_pages);
            setPage(2);
          }
          
          const jobsData = taskData.jobs_data || [];
          const succeededJobs = jobsData.filter((job: any) => job.Status === "Succeeded").length;
          const connectedCount = succeededJobs;
          const notConnectedCount = jobsData.length - connectedCount;
          
          setTaskStatus({
            is_completed: false,
            total_calls: totalJobs,
            connected_calls: connectedCount,
            not_connected_calls: notConnectedCount,
            query_time: taskData.query_time
          });
          
          const processedJobs = jobsData.map((job: any) => {
            return {
              job_id: job.JobId || '未知',
              job_group_id: job.JobGroupId || '未知',
              status: job.Status || '未知',
              priority: job.Priority || 0,
              created_time: new Date().toISOString(),
              modified_time: new Date().toISOString(),
              raw_data: job
            };
          });
          
          setCallJobs(processedJobs);
          setLoading(false);
          return; // 使用缓存，不发起新请求
        }
      }
    }
    
    // 初始加载时跳过时间间隔检查，追加模式或刷新时检查
    if (!skipIntervalCheck && !append && now - lastFetchTimeRef.current < minFetchInterval) {
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }
    lastFetchTimeRef.current = now;

    // 创建实际的请求 Promise
    const requestPromise = (async () => {
      try {
        const currentPage = append ? page : 1;
        // 使用新的查询任务执行情况接口，传递分页参数
        const executionCacheKey = `task_execution_${taskId}_${currentPage}_${pageSize}`;
        let executionResponse;
        
        if (isCacheValid(executionCacheKey, 10000)) { // 10秒缓存
          executionResponse = getCachedData(executionCacheKey);
        } else {
          executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId), currentPage, pageSize);
          if (executionResponse.status === 'success') {
            setCachedData(executionCacheKey, executionResponse, 10000);
          }
        }
        
        return executionResponse;
      } catch (error) {
        throw error;
      }
    })();
    
    // 如果是非追加模式的首次加载，保存 Promise 作为请求锁
    if (!append) {
      pendingFetchRef.current = requestPromise;
    }

    try {
      const executionResponse = await requestPromise;

      if (executionResponse.status !== 'success') {
        throw new Error('获取任务执行情况失败');
      }

      const taskData = executionResponse.data;
      
      // 保存总数和分页信息
      const totalJobs = taskData.total_jobs || 0;
      setTotalCount(totalJobs);
      
      if (taskData.pagination) {
        const { page: currentPageNum, total_pages } = taskData.pagination;
        setHasMore(currentPageNum < total_pages);
        if (!append) {
          setPage(2); // 首次加载后，下次加载第二页
        } else {
          setPage(currentPageNum + 1); // 追加模式，设置下一页
        }
      }
      
      const jobsData = taskData.jobs_data || [];
      
      // 只在首次加载时更新任务状态信息
      if (!append) {
        // 根据jobs_data中的Status字段计算当前页的任务状态
        const succeededJobs = jobsData.filter((job: any) => job.Status === "Succeeded").length;
        const connectedCount = succeededJobs;
        const notConnectedCount = jobsData.length - connectedCount;
        
        setTaskStatus({
          is_completed: false,
          total_calls: totalJobs,
          connected_calls: connectedCount,
          not_connected_calls: notConnectedCount,
          query_time: taskData.query_time
        });
      }

      // 处理 jobs_data 数据
      if (!taskData.jobs_data || taskData.jobs_data.length === 0) {
        if (totalJobs === 0 && !append) {
          setError('该任务暂无外呼记录');
          setCallJobs([]);
        } else if (!append) {
          setError(`当前页暂无数据（共 ${totalJobs} 条记录）`);
          setCallJobs([]);
        }
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
        return;
      }

      // 将新的数据结构转换为原有的 CallJob 格式
      const processedJobs = taskData.jobs_data.map((job: any) => {
        return {
          job_id: job.JobId || '未知',
          job_group_id: job.JobGroupId || '未知',
          status: job.Status || '未知',
          priority: job.Priority || 0,
          created_time: new Date().toISOString(), // 新接口没有这些字段，使用默认值
          modified_time: new Date().toISOString(),
          raw_data: job // 将整个 job 对象作为 raw_data
        };
      });

      if (append) {
        // 追加模式：将新数据追加到现有数据
        setCallJobs(prev => [...prev, ...processedJobs]);
      } else {
        // 首次加载：替换数据
        setCallJobs(processedJobs);
        setPage(2); // 下次加载第二页
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取外呼状态失败');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
        // 清除请求锁
        pendingFetchRef.current = null;
      }
    }
  };

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchCallStatus(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, loading]);

  useEffect(() => {
    if (isOpen && taskId) {
      // 重置状态
      setPage(1);
      setHasMore(true);
      setCallJobs([]);
      setTotalCount(0);
      // 清除之前的请求锁和定时器
      pendingFetchRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // 初始加载时不防抖，立即加载（只调用一次）
      fetchCallStatus(false, true);
    } else {
      // 关闭时清除请求锁
      pendingFetchRef.current = null;
    }
    
    // 清理定时器
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // 组件卸载时清除请求锁
      pendingFetchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskId]); // 移除 debouncedFetchCallStatus 依赖，直接调用 fetchCallStatus

  // 滚动监听，实现滚动加载
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !isOpen || !hasMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      // 当滚动到距离底部100px时开始加载
      if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore && !loading) {
        loadMore();
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, hasMore, loadingMore, loading, loadMore]);

  // 清理缓存
  useEffect(() => {
    return () => {
      // 组件卸载时清理相关缓存
      statusCache.delete(`task_execution_${taskId}`);
    };
  }, [taskId]);

  // 获取状态颜色
  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-gray-500/20 text-gray-300';
    
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'executing':
        return 'bg-blue-500/20 text-blue-300';
      case 'succeeded':
      case 'succeededfinish':
      case 'succeededchathangupafternoanswer':
      case 'succeededchathangupaftersilence':
      case 'succeededclienthangupafternoanswer':
      case 'succeededclienthangup':
      case 'succeededtransferbyintent':
      case 'succeededtransferafternoanswer':
      case 'succeededinointeraction':
      case 'succeedederror':
      case 'succeededspecialinterceptvoiceassistant':
      case 'succeededspecialinterceptextensionnumbertransfer':
        return 'bg-green-500/20 text-green-300';
      case 'failed':
        return 'bg-red-500/20 text-red-300';
      case 'noanswer':
      case 'notexist':
      case 'busy':
      case 'notconnected':
      case 'poweredoff':
      case 'outofservice':
      case 'inarrears':
      case 'emptynumber':
      case 'perdaycallcountlimit':
      case 'contactblocklist':
      case 'callernotregistered':
      case 'terminated':
      case 'verificationcancelled':
      case 'outofservicenocall':
      case 'inarrearsnocall':
      case 'callingnumbernotexist':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string | null | undefined) => {
    if (!status) return '未知状态';
    
    const statusMap: { [key: string]: string } = {
      'Executing': '正在拨打',
      'Succeeded': '已接通',
      'NoAnswer': '未接通-无人接听',
      'NotExist': '未接通-空号',
      'Busy': '未接通-占线',
      'Cancelled': '未呼出-任务停止',
      'Failed': '失败',
      'NotConnected': '未接通-无法接通',
      'PoweredOff': '未接通-关机',
      'OutOfService': '未接通-被叫停机',
      'InArrears': '未接通-被叫欠费',
      'EmptyNumber': '未呼出-空号不外呼',
      'PerDayCallCountLimit': '未呼出-超出每日上限',
      'ContactBlockList': '未呼出-黑名单',
      'CallerNotRegistered': '未呼出-主叫号码未注册',
      'Terminated': '未呼出-被终止',
      'VerificationCancelled': '未呼出-呼叫前验证不通过取消',
      'OutOfServiceNoCall': '未呼出-被叫停机不外呼',
      'InArrearsNoCall': '未呼出-被叫欠费不外呼',
      'CallingNumberNotExist': '未呼出-主叫号码不存在',
      'SucceededFinish': '已接通-正常完结',
      'SucceededChatbotHangUpAfterNoAnswer': '已接通-拒识后机器人挂机',
      'SucceededChatbotHangUpAfterSilence': '已接通-静默超时挂机',
      'SucceededClientHangUpAfterNoAnswer': '已接通-拒识后用户挂机',
      'SucceededClientHangUp': '已接通-用户无理由挂机',
      'SucceededTransferByIntent': '已接通-命中意图转人工',
      'SucceededTransferAfterNoAnswer': '已接通-拒识转人工',
      'SucceededInoInterAction': '已接通-用户侧无交互',
      'SucceededError': '已接通-系统异常中断',
      'SucceededSpecialInterceptVoiceAssistant': '已接通-特殊情况拦截-语音助手',
      'SucceededSpecialInterceptExtensionNumberTransfer': '已接通-特殊情况拦截-分机号转接'
    };
    
    return statusMap[status] || status;
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '未知时间';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 格式化通话时长
  const formatDuration = (duration: number) => {
    if (!duration) return '0秒';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`;
  };

  // 切换展开状态
  const toggleExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const handleClose = () => {
    onClose();
  };

  const handleRefresh = () => {
    fetchCallStatus();
    // 调用父组件的刷新回调函数，更新 leads_task_list 数据
    onRefresh?.();
  };

  // 暂停/重启任务处理函数
  const handleSuspendResumeTask = async (action: 'suspend' | 'resume') => {
    try {
      const response = await tasksAPI.suspendResumeTask(parseInt(taskId), action);
      if (response.status === 'success') {
        console.log(`${action === 'suspend' ? '暂停' : '重启'}任务成功:`, response.data);
        
        // 通知父组件任务类型已变化
        if (onTaskTypeChange) {
          onTaskTypeChange(response.data.task_type);
        }
        
        // 刷新任务状态
        fetchCallStatus();
      } else {
        console.error(`${action === 'suspend' ? '暂停' : '重启'}任务失败:`, response.message);
        
        // 操作失败时，立即查询任务最新状态（只查询第一页获取状态信息）
        try {
          const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId), 1, 20);
          if (executionResponse.status === 'success') {
            const taskData = executionResponse.data;
            console.log('操作失败后查询任务状态:', taskData);
            
            // 如果任务状态不是2或5，则关闭弹窗
            if (taskData.task_type !== 2 && taskData.task_type !== 5) {
              console.log('任务状态已变化，关闭弹窗');
              onClose();
              return;
            }
          }
        } catch (queryError) {
          console.error('查询任务状态失败:', queryError);
        }
      }
    } catch (error) {
      console.error(`${action === 'suspend' ? '暂停' : '重启'}任务失败:`, error);
      
      // 操作失败时，立即查询任务最新状态
      try {
        const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId));
        if (executionResponse.status === 'success') {
          const taskData = executionResponse.data;
          console.log('操作失败后查询任务状态:', taskData);
          
          // 如果任务状态不是2或5，则关闭弹窗
          if (taskData.task_type !== 2 && taskData.task_type !== 5) {
            console.log('任务状态已变化，关闭弹窗');
            onClose();
            return;
          }
        }
      } catch (queryError) {
        console.error('查询任务状态失败:', queryError);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[80] pt-4" onClick={handleClose}>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">电话拨打情况</h2>
              <p className="text-gray-300">任务：{taskName}</p>
            </div>
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-white transition-colors"
              style={{ position: 'relative', zIndex: 1000 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 任务状态概览 */}
          {taskStatus && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">任务状态概览</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">任务状态</div>
                  <div className={`text-lg font-medium ${
                    taskStatus.is_completed ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {taskStatus.is_completed ? '已完成' : '执行中'}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">总任务数</div>
                  <div className="text-lg font-medium text-white">
                    {taskStatus.total_calls || 0}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">已接通任务数</div>
                  <div className="text-lg font-medium text-green-400">
                    {taskStatus.connected_calls || 0}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">未接通任务数</div>
                  <div className="text-lg font-medium text-yellow-400">
                    {taskStatus.not_connected_calls || 0}
                  </div>
                </div>
              </div>
              {taskStatus.query_time && (
                <div className="mt-3 text-xs text-gray-400">
                  查询时间: {taskStatus.query_time}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-300">正在加载外呼状态...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">加载失败</h3>
              <p className="text-gray-400">{error}</p>
            </div>
          ) : callJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">暂无外呼记录</h3>
              <p className="text-gray-400">该任务还没有外呼记录</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">外呼任务详情</h3>
                <span className="text-gray-300 text-sm">
                  {totalCount > 0 
                    ? `已加载 ${callJobs.length} / ${totalCount} 条记录`
                    : `共 ${callJobs.length} 个外呼任务`}
                </span>
              </div>

              <div className="space-y-3">
                {callJobs.map((job, index) => {
                  const isExpanded = expandedJobs.has(job.job_id);
                  const firstContact = job.raw_data?.Contacts?.[0];
                  const firstTask = job.raw_data?.Tasks?.[0];
                  
                  return (
                    <div key={job.job_id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      {/* 默认显示信息 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                          <h4 className="text-white font-medium">外呼任务 {index + 1}</h4>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(job.status)}`}>
                            {getStatusText(job.status)}
                          </span>
                          <button
                            onClick={() => toggleExpanded(job.job_id)}
                            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                          >
                            {isExpanded ? '收起详情' : '查看详情'}
                          </button>
                        </div>
                      </div>

                      {/* 默认显示的基本信息 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">联系人:</span>
                          <span className="text-white ml-2">{firstContact?.ContactName || '未知'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">电话:</span>
                          <span className="text-white ml-2">{firstContact?.PhoneNumber || '未知'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">通话时长:</span>
                          <span className="text-white ml-2">{firstTask ? formatDuration(firstTask.Duration) : '0秒'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">拨打时间:</span>
                          <span className="text-white ml-2">{firstTask ? formatTimestamp(firstTask.ActualTime) : '未知'}</span>
                        </div>
                      </div>

                      {/* 展开的详细信息 */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">任务ID:</span>
                              <span className="text-white ml-2 font-mono text-xs">{job.job_id}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">优先级:</span>
                              <span className="text-white ml-2">{job.priority}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">创建时间:</span>
                              <span className="text-white ml-2">{job.created_time || '未知'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">修改时间:</span>
                              <span className="text-white ml-2">{job.modified_time || '未知'}</span>
                            </div>
                          </div>

                          {/* 联系人信息 */}
                          {job.raw_data?.Contacts && job.raw_data.Contacts.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">联系人信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {job.raw_data.Contacts.map((contact: any, contactIndex: number) => (
                                  <div key={contactIndex} className="mb-2 last:mb-0">
                                    <div>姓名: {contact.ContactName}</div>
                                    <div>电话: {contact.PhoneNumber}</div>
                                    <div>引用ID: {contact.ReferenceId}</div>
                                    <div>联系人ID: {contact.ContactId}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 通话任务详情 */}
                          {job.raw_data?.Tasks && job.raw_data.Tasks.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">通话详情:</span>
                              <div className="space-y-2 mt-1">
                                {job.raw_data.Tasks.map((task: any, taskIndex: number) => (
                                  <div key={taskIndex} className="bg-white/5 rounded p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-400">任务ID:</span>
                                        <span className="text-white ml-1">{task.TaskId}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">状态:</span>
                                        <span className={`ml-1 px-1 py-0.5 rounded text-xs ${getStatusColor(task.Status)}`}>
                                          {getStatusText(task.Status)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">主叫号码:</span>
                                        <span className="text-white ml-1">{task.CallingNumber}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">被叫号码:</span>
                                        <span className="text-white ml-1">{task.CalledNumber}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">通话时长:</span>
                                        <span className="text-white ml-1">{formatDuration(task.Duration)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">实际时间:</span>
                                        <span className="text-white ml-1">{formatTimestamp(task.ActualTime)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">计划时间:</span>
                                        <span className="text-white ml-1">{formatTimestamp(task.PlanedTime)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">通话ID:</span>
                                        <span className="text-white ml-1">{task.CallId}</span>
                                      </div>
                                    </div>

                                    {/* 通话对话记录 */}
                                    {task.Conversation && task.Conversation.length > 0 && (
                                      <div className="mt-2">
                                        <span className="text-gray-400 text-xs">对话记录:</span>
                                        <div className="mt-1 space-y-1">
                                          {task.Conversation.map((conv: any, convIndex: number) => (
                                            <div key={convIndex} className="text-xs bg-white/5 rounded p-1">
                                              <div className="flex justify-between">
                                                <span className={`text-xs px-1 py-0.5 rounded ${
                                                  conv.Speaker === 'Robot' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                                                }`}>
                                                  {conv.Speaker === 'Robot' ? '机器人' : '客户'}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                  {formatTimestamp(conv.Timestamp)}
                                                </span>
                                              </div>
                                              {conv.Script && (
                                                <div className="text-white mt-1">{conv.Script}</div>
                                              )}
                                              {conv.Summary && conv.Summary.length > 0 && (
                                                <div className="mt-1 text-yellow-300 text-xs">
                                                  总结: {conv.Summary.join(', ')}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 总结信息 */}
                          {job.raw_data?.Summary && job.raw_data.Summary.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">总结信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {job.raw_data.Summary.map((summary: any, summaryIndex: number) => (
                                  <div key={summaryIndex} className="mb-1 last:mb-0">
                                    <span className="text-gray-400">{summary.SummaryName}:</span>
                                    <span className="text-white ml-1">{summary.Content}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 额外信息 */}
                          {job.raw_data?.Extras && job.raw_data.Extras.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">额外信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {job.raw_data.Extras.map((extra: any, extraIndex: number) => (
                                  <div key={extraIndex} className="mb-1 last:mb-0">
                                    <span className="text-gray-400">{extra.Key}:</span>
                                    <span className="text-white ml-1">{extra.Value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {job.result && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">执行结果:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {job.result}
                              </div>
                            </div>
                          )}

                          {job.failure_reason && (
                            <div className="mt-3">
                              <span className="text-red-400 text-sm">失败原因:</span>
                              <div className="text-red-300 text-sm mt-1 bg-red-500/10 rounded p-2">
                                {job.failure_reason}
                              </div>
                            </div>
                          )}

                          {job.db_record && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">数据库记录:</span>
                              <div className="text-gray-300 text-sm mt-1 bg-white/5 rounded p-2">
                                <pre className="text-xs overflow-x-auto">
                                  {JSON.stringify(job.db_record, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 加载更多提示 */}
              {loadingMore && (
                <div className="mt-6 text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                  <p className="text-gray-300 text-sm">正在加载更多...</p>
                </div>
              )}
              
              {!hasMore && callJobs.length > 0 && (
                <div className="mt-6 text-center py-4">
                  <p className="text-gray-400 text-sm">已加载全部 {totalCount} 条记录</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-white/10 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              {taskType === 2 && (
                <button 
                  onClick={handleSuspendResumeTask.bind(null, 'suspend')}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 rounded-lg transition-colors"
                  style={{ position: 'relative', zIndex: 1000 }}
                >
                  暂停任务
                </button>
              )}
              {taskType === 5 && (
                <button 
                  onClick={handleSuspendResumeTask.bind(null, 'resume')}
                  className="px-4 py-2 bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-lg transition-colors"
                  style={{ position: 'relative', zIndex: 1000 }}
                >
                  重启任务
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg transition-colors"
                style={{ position: 'relative', zIndex: 1000 }}
              >
                刷新状态
              </button>
              <button 
                onClick={handleClose} 
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                style={{ position: 'relative', zIndex: 1000 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 