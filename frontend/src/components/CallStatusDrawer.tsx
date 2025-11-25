'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  initialJobGroupProgress?: any; // 初始任务组进度数据，如果传入则不请求 describe-job-group
}

// 状态缓存
const statusCache = new Map<string, {
  data: any;
  timestamp: number;
  cacheDuration: number;
}>();

export default function CallStatusDrawer({ isOpen, onClose, taskId, taskName, onRefresh, taskType, onTaskTypeChange, initialJobGroupProgress }: CallStatusDrawerProps) {
  const [callJobs, setCallJobs] = useState<CallJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [taskStatus, setTaskStatus] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20); // 固定每页20条，后端可返回新的 page_size
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [jobGroupProgress, setJobGroupProgress] = useState<any>(null); // 任务组进度信息
  const [overviewDataReady, setOverviewDataReady] = useState(false); // 概览数据是否已准备好（避免多次渲染闪烁）
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 防抖定时器
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

  // 清除缓存数据
  const clearCachedData = (cacheKey: string) => {
    statusCache.delete(cacheKey);
  };

  // 获取任务组进度信息
  const fetchJobGroupProgress = useCallback(async () => {
    if (!isOpen || !taskId) return;
    
    try {
      const response = await tasksAPI.describeJobGroup({ task_id: parseInt(taskId) });
      if (response.status === 'success' && response.data) {
        setJobGroupProgress(response.data);
        return true; // 返回成功标志
      }
    } catch (error) {
      console.error('获取任务组进度信息失败:', error);
      // 不显示错误，因为这是辅助信息
    }
    return false;
  }, [isOpen, taskId]);

  // 获取任务执行数据（分页）
  const fetchCallStatus = useCallback(async (pageToLoad: number = currentPage, skipIntervalCheck: boolean = false) => {
    if (!isOpen || !taskId) return;

    if (pendingFetchRef.current) {
      console.log('CallStatusDrawer: 已有请求正在进行，等待完成后重试');
      try {
        await pendingFetchRef.current;
      } catch (e) {
        // 忽略错误
      }
      if (!skipIntervalCheck && pageToLoad === currentPage) {
        return;
      }
    }

    const now = Date.now();
    if (!skipIntervalCheck && now - lastFetchTimeRef.current < minFetchInterval) {
      return;
    }

    lastFetchTimeRef.current = now;
    setLoading(true);
    setError(null);

    const executionCacheKey = `task_execution_${taskId}_${pageToLoad}_${pageSize}`;

    const requestPromise = (async () => {
      try {
        let executionResponse;
        if (isCacheValid(executionCacheKey, 10000)) {
          executionResponse = getCachedData(executionCacheKey);
        } else {
          executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId, 10), pageToLoad, pageSize);
          if (executionResponse?.status === 'success') {
            setCachedData(executionCacheKey, executionResponse, 10000);
          }
        }
        return executionResponse;
      } catch (error) {
        throw error;
      }
    })();

    pendingFetchRef.current = requestPromise;

    try {
      const executionResponse = await requestPromise;

      if (!executionResponse || executionResponse.status !== 'success') {
        throw new Error(executionResponse?.message || '获取任务执行情况失败');
      }

      const taskData = executionResponse.data || {};
      const pagination = taskData.pagination || {};
      const totalJobs = typeof taskData.total_jobs === 'number'
        ? taskData.total_jobs
        : (typeof pagination.total_count === 'number' ? pagination.total_count : 0);

      setTotalCount(totalJobs);
      setCurrentPage(pagination.page || pageToLoad);
      setTotalPages(pagination.total_pages || 1);
      if (pagination.page_size) {
        setPageSize(pagination.page_size);
      }

      const jobsData = Array.isArray(taskData.jobs_data) ? taskData.jobs_data : [];

      if (jobsData.length === 0) {
        if (totalJobs === 0) {
          setError('该任务暂无外呼记录');
        } else {
          setError(`当前页暂无数据（共 ${totalJobs} 条记录）`);
        }
        setCallJobs([]);
        return;
      }

      // 只在第一页加载时更新任务状态信息
      if ((pagination.page || pageToLoad) === 1) {
        const taskStats = taskData.task_stats || {};
        const toNumber = (value: any, fallback = 0) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        };
        setTaskStatus({
          is_completed: Boolean(taskStats.is_completed),
          total_calls: toNumber(taskStats.total_calls, totalJobs),
          connected_calls: toNumber(taskStats.connected_calls),
          not_connected_calls: toNumber(taskStats.not_connected_calls),
          not_started_calls: toNumber(taskStats.not_started_calls),
          query_time: taskData.query_time
        });
      }

      const processedJobs = jobsData.map((job: any) => ({
        job_id: job.JobId || job.job_id || '未开始',
        job_group_id: job.JobGroupId || job.JobGroupID || job.job_group_id || '未开始',
        status: job.Status !== undefined ? job.Status : (job.status !== undefined ? job.status : ''),
        priority: job.Priority ?? job.priority ?? 0,
        created_time: job.created_time || job.createdTime || job.query_time || new Date().toISOString(),
        modified_time: job.modified_time || job.modifiedTime || new Date().toISOString(),
        raw_data: job
      }));

      setCallJobs(processedJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取外呼状态失败');
    } finally {
      setLoading(false);
      pendingFetchRef.current = null;
    }
  }, [currentPage, isOpen, taskId, pageSize, minFetchInterval]);

  useEffect(() => {
    if (isOpen && taskId) {
      // 重置状态
      setCurrentPage(1);
      setTotalPages(1);
      setCallJobs([]);
      setTotalCount(0);
      // 如果传入了初始任务组进度数据，直接使用，否则重置为 null
      setJobGroupProgress(initialJobGroupProgress || null);
      setTaskStatus(null);
      // 如果传入了初始数据，立即标记为准备好，可以立即显示概览
      setOverviewDataReady(!!initialJobGroupProgress);
      // 清除之前的请求锁、初始化标记和定时器
      pendingFetchRef.current = null;
      // 设置加载状态，直到数据加载完成
      setLoading(true);
      setError(null);
      
      // 如果传入了初始任务组进度数据，则只请求列表数据；否则并行请求两个接口
      const loadOverviewData = async () => {
        try {
          if (initialJobGroupProgress) {
            // 如果传入了初始数据，只请求列表数据，概览数据已经准备好
            const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId, 10), 1, pageSize);
            if (executionResponse?.status === 'success') {
              const taskData = executionResponse.data || {};
              const pagination = taskData.pagination || {};
              const totalJobs = typeof taskData.total_jobs === 'number'
                ? taskData.total_jobs
                : (typeof pagination.total_count === 'number' ? pagination.total_count : 0);

              setTotalCount(totalJobs);
              setCurrentPage(pagination.page || 1);
              setTotalPages(pagination.total_pages || 1);
              if (pagination.page_size) {
                setPageSize(pagination.page_size);
              }

              const jobsData = Array.isArray(taskData.jobs_data) ? taskData.jobs_data : [];
              const processedJobs = jobsData.map((job: any) => ({
                job_id: job.JobId || job.job_id || '未开始',
                job_group_id: job.JobGroupId || job.JobGroupID || job.job_group_id || '未开始',
                status: job.Status || job.status || '未开始',
                priority: job.Priority ?? job.priority ?? 0,
                created_time: job.created_time || job.createdTime || job.query_time || new Date().toISOString(),
                modified_time: job.modified_time || job.modifiedTime || new Date().toISOString(),
                raw_data: job
              }));
              setCallJobs(processedJobs);

              // 更新任务状态信息
              const taskStats = taskData.task_stats || {};
              const toNumber = (value: any, fallback = 0) => {
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : fallback;
              };
              setTaskStatus({
                is_completed: Boolean(taskStats.is_completed),
                total_calls: toNumber(taskStats.total_calls, totalJobs),
                connected_calls: toNumber(taskStats.connected_calls),
                not_connected_calls: toNumber(taskStats.not_connected_calls),
                query_time: taskData.query_time
              });
            } else {
              // 如果请求失败，设置错误信息
              setError(executionResponse?.message || '获取任务执行情况失败');
            }
            // 概览数据已经在上面设置为准备好了，这里不需要再设置
          } else {
            // 如果没有传入初始数据，并行调用两个接口
            const [executionResult, jobGroupResult] = await Promise.allSettled([
              (async () => {
                const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId, 10), 1, pageSize);
                if (executionResponse?.status === 'success') {
                  const taskData = executionResponse.data || {};
                  const pagination = taskData.pagination || {};
                  const totalJobs = typeof taskData.total_jobs === 'number'
                    ? taskData.total_jobs
                    : (typeof pagination.total_count === 'number' ? pagination.total_count : 0);

                  setTotalCount(totalJobs);
                  setCurrentPage(pagination.page || 1);
                  setTotalPages(pagination.total_pages || 1);
                  if (pagination.page_size) {
                    setPageSize(pagination.page_size);
                  }

                  const jobsData = Array.isArray(taskData.jobs_data) ? taskData.jobs_data : [];
                  const processedJobs = jobsData.map((job: any) => ({
                    job_id: job.JobId || job.job_id || '未开始',
                    job_group_id: job.JobGroupId || job.JobGroupID || job.job_group_id || '未开始',
                    status: job.Status || job.status || '未开始',
                    priority: job.Priority ?? job.priority ?? 0,
                    created_time: job.created_time || job.createdTime || job.query_time || new Date().toISOString(),
                    modified_time: job.modified_time || job.modifiedTime || new Date().toISOString(),
                    raw_data: job
                  }));
                  setCallJobs(processedJobs);

                  // 更新任务状态信息
                  const taskStats = taskData.task_stats || {};
                  const toNumber = (value: any, fallback = 0) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : fallback;
                  };
                  return {
                    taskStatus: {
                      is_completed: Boolean(taskStats.is_completed),
                      total_calls: toNumber(taskStats.total_calls, totalJobs),
                      connected_calls: toNumber(taskStats.connected_calls),
                      not_connected_calls: toNumber(taskStats.not_connected_calls),
                      not_started_calls: toNumber(taskStats.not_started_calls),
                      query_time: taskData.query_time
                    }
                  };
                }
                return null;
              })(),
              fetchJobGroupProgress()
            ]);

            // 统一更新状态，避免多次渲染
            if (executionResult.status === 'fulfilled' && executionResult.value?.taskStatus) {
              setTaskStatus(executionResult.value.taskStatus);
            }
            if (jobGroupResult.status === 'fulfilled' && jobGroupResult.value) {
              // jobGroupProgress 已经在 fetchJobGroupProgress 中设置了
            }
            
            // 标记概览数据已准备好
            setOverviewDataReady(true);
          }
        } catch (error) {
          console.error('加载概览数据失败:', error);
          setOverviewDataReady(true); // 即使失败也标记为准备好，避免一直不显示
          setError(error instanceof Error ? error.message : '加载数据失败');
        } finally {
          // 加载完成，关闭加载状态
          setLoading(false);
        }
      };

      // 初始加载时不防抖，立即加载
      loadOverviewData();
    } else {
      // 关闭时清除请求锁和初始化标记
      pendingFetchRef.current = null;
      setOverviewDataReady(false);
    }
    
    // 清理定时器
    return () => {
      pendingFetchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskId, initialJobGroupProgress]); // 只依赖 isOpen、taskId 和 initialJobGroupProgress，避免翻页时重复执行

  // 清理缓存
  useEffect(() => {
    return () => {
      // 组件卸载时清理相关缓存
      const cachePrefix = `task_execution_${taskId}_`;
      Array.from(statusCache.keys()).forEach((key) => {
        if (key.startsWith(cachePrefix)) {
          statusCache.delete(key);
        }
      });
    };
  }, [taskId]);

  // 获取状态颜色
  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return 'bg-gray-500/20 text-gray-300';
    
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-300';
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
    if (!status || status === '') return '未开始';
    
    const statusMap: { [key: string]: string } = {
      'Executing': '正在拨打',
      'Succeeded': '已接通',
      'Paused': '暂停',
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

  // 判断是否为失败状态
  const isFailedStatus = (status: string | null | undefined) => {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower === 'failed' || statusLower === 'fail';
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number | string | null | undefined) => {
    if (timestamp === undefined || timestamp === null) return '未知时间';
    let dateValue: Date;
    if (typeof timestamp === 'string') {
      const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
      dateValue = new Date(normalized);
    } else {
      dateValue = new Date(timestamp);
    }
    if (Number.isNaN(dateValue.getTime())) {
      return typeof timestamp === 'string' ? timestamp : '未知时间';
    }
    return dateValue.toLocaleString('zh-CN');
  };

  // 格式化通话时长
  const formatDuration = (duration?: number | null) => {
    if (duration === undefined || duration === null || Number(duration) <= 0) return '0秒';
    const seconds = Math.max(Math.floor(Number(duration) / 1000), 0);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`;
  };

  const getConversationBounds = (conversation?: any[]) => {
    if (!Array.isArray(conversation) || conversation.length === 0) return null;
    const timestamps = conversation
      .map((c) => Number(c?.Timestamp))
      .filter((t) => Number.isFinite(t));
    if (timestamps.length === 0) return null;
    return {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };
  };

  const getReadableDuration = (task: any) => {
    if (!task) return '0秒';
    if (typeof task.Duration === 'number' && task.Duration > 0) {
      return formatDuration(task.Duration);
    }
    const bounds = getConversationBounds(task.Conversation);
    if (bounds && bounds.end > bounds.start) {
      return formatDuration(bounds.end - bounds.start);
    }
    return '0秒';
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

  const handleRefresh = async () => {
    // 清除当前任务的分页缓存，确保刷新时发起新请求
    const cachePrefix = `task_execution_${taskId}_`;
    Array.from(statusCache.keys()).forEach((key) => {
      if (key.startsWith(cachePrefix)) {
        statusCache.delete(key);
      }
    });
    // 重置分页状态
    setCurrentPage(1);
    setTotalPages(1);
    setOverviewDataReady(false); // 重置概览数据准备状态
    
    // 并行调用两个接口，等待都返回后再统一更新状态，避免多次渲染闪烁
    try {
      const [executionResult, jobGroupResult] = await Promise.allSettled([
        (async () => {
          const executionResponse = await tasksAPI.queryTaskExecution(parseInt(taskId, 10), 1, pageSize);
          if (executionResponse?.status === 'success') {
            const taskData = executionResponse.data || {};
            const pagination = taskData.pagination || {};
            const totalJobs = typeof taskData.total_jobs === 'number'
              ? taskData.total_jobs
              : (typeof pagination.total_count === 'number' ? pagination.total_count : 0);

            setTotalCount(totalJobs);
            setCurrentPage(pagination.page || 1);
            setTotalPages(pagination.total_pages || 1);
            if (pagination.page_size) {
              setPageSize(pagination.page_size);
            }

            const jobsData = Array.isArray(taskData.jobs_data) ? taskData.jobs_data : [];
            const processedJobs = jobsData.map((job: any) => ({
              job_id: job.JobId || job.job_id || '未开始',
              job_group_id: job.JobGroupId || job.JobGroupID || job.job_group_id || '未开始',
              status: job.Status || job.status || '未开始',
              priority: job.Priority ?? job.priority ?? 0,
              created_time: job.created_time || job.createdTime || job.query_time || new Date().toISOString(),
              modified_time: job.modified_time || job.modifiedTime || new Date().toISOString(),
              raw_data: job
            }));
            setCallJobs(processedJobs);

            // 更新任务状态信息
            const taskStats = taskData.task_stats || {};
            const toNumber = (value: any, fallback = 0) => {
              const parsed = Number(value);
              return Number.isFinite(parsed) ? parsed : fallback;
            };
            return {
              taskStatus: {
                is_completed: Boolean(taskStats.is_completed),
                total_calls: toNumber(taskStats.total_calls, totalJobs),
                connected_calls: toNumber(taskStats.connected_calls),
                not_connected_calls: toNumber(taskStats.not_connected_calls),
                not_started_calls: toNumber(taskStats.not_started_calls),
                query_time: taskData.query_time
              }
            };
          }
          return null;
        })(),
        fetchJobGroupProgress()
      ]);

      // 统一更新状态，避免多次渲染
      if (executionResult.status === 'fulfilled' && executionResult.value?.taskStatus) {
        setTaskStatus(executionResult.value.taskStatus);
      }
      if (jobGroupResult.status === 'fulfilled' && jobGroupResult.value) {
        // jobGroupProgress 已经在 fetchJobGroupProgress 中设置了
      }
      
      // 标记概览数据已准备好
      setOverviewDataReady(true);
    } catch (error) {
      console.error('刷新概览数据失败:', error);
      setOverviewDataReady(true); // 即使失败也标记为准备好
    }
    
    // 调用父组件的刷新回调函数，更新 leads_task_list 数据
    onRefresh?.();
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    // 翻页时只获取分页数据，不更新任务状态概览
    fetchCallStatus(nextPage, true);
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

  // 检查是否已获取到有效的任务状态概览数据（需要数据准备好且有实际数据）
  const hasOverviewData = useMemo(() => {
    if (!overviewDataReady) return false; // 数据还未准备好，不显示
    return (
      (jobGroupProgress?.progress && (
        jobGroupProgress.progress.total_jobs !== undefined ||
        jobGroupProgress.progress.total_completed !== undefined ||
        jobGroupProgress.progress.failed !== undefined
      )) ||
      (taskStatus && (
        taskStatus.total_calls !== undefined ||
        taskStatus.connected_calls !== undefined ||
        taskStatus.not_connected_calls !== undefined
      ))
    );
  }, [overviewDataReady, jobGroupProgress, taskStatus]);

  // 任务状态概览统计值 - 使用 useMemo 缓存，只在 jobGroupProgress 或 taskStatus 变化时重新计算
  const totalJobsOverview = useMemo(() => {
    return (jobGroupProgress?.progress?.total_jobs ?? taskStatus?.total_calls ?? 0) as number;
  }, [jobGroupProgress?.progress?.total_jobs, taskStatus?.total_calls]);

  const connectedOverview = useMemo(() => {
    return (jobGroupProgress?.progress?.total_completed ?? taskStatus?.connected_calls ?? 0) as number;
  }, [jobGroupProgress?.progress?.total_completed, taskStatus?.connected_calls]);

  const notConnectedOverview = useMemo(() => {
    return (jobGroupProgress?.progress?.failed ?? taskStatus?.not_connected_calls ?? 0) as number;
  }, [jobGroupProgress?.progress?.failed, taskStatus?.not_connected_calls]);

  const executingCombinedOverview = useMemo(() => {
    // executing 是执行中，scheduling 是未开始，不应该相加
    return (jobGroupProgress?.progress?.executing ?? 0) as number;
  }, [jobGroupProgress?.progress?.executing]);

  const notStartedOverview = useMemo(() => {
    // 优先使用后端返回的未开始数量
    const fromJobGroup = jobGroupProgress?.progress?.scheduling ?? 0;
    const fromTaskStatus = taskStatus?.not_started_calls ?? 0;
    
    // 如果后端有返回，直接使用；否则通过计算得出
    if (fromJobGroup > 0 || fromTaskStatus > 0) {
      return Math.max(fromJobGroup, fromTaskStatus);
    }
    
    // 兜底计算：总数 - 已接通 - 未接通 - 执行中
    return Math.max(
      totalJobsOverview - (connectedOverview + notConnectedOverview + executingCombinedOverview),
      0
    );
  }, [totalJobsOverview, connectedOverview, notConnectedOverview, executingCombinedOverview, jobGroupProgress?.progress?.scheduling, taskStatus?.not_started_calls]);

  const progressPercentOverview = useMemo(() => {
    return totalJobsOverview > 0
      ? Math.round(((connectedOverview + notConnectedOverview) / totalJobsOverview) * 100)
      : 0;
  }, [totalJobsOverview, connectedOverview, notConnectedOverview]);

  const isPaused = useMemo(() => {
    return (taskType === 5)
      || ((jobGroupProgress?.status && typeof jobGroupProgress.status === 'string' && jobGroupProgress.status.toLowerCase() === 'paused') as boolean)
      || (taskStatus?.is_paused === true);
  }, [taskType, jobGroupProgress?.status, taskStatus?.is_paused]);

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

          {/* 任务状态概览 - 只在获取到有效数据时显示 */}
          {hasOverviewData && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">任务状态概览</h3>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">任务状态</div>
                  <div className={`text-lg font-medium ${
                    isPaused ? 'text-yellow-300' : (taskStatus?.is_completed ? 'text-green-400' : 'text-blue-400')
                  }`}>
                    {isPaused ? '暂停中' : (taskStatus?.is_completed ? '已完成' : '执行中')}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">总外呼量</div>
                  <div className="text-lg font-medium text-white">{totalJobsOverview}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">已接通</div>
                  <div className="text-lg font-medium text-green-400">{connectedOverview}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">未开始</div>
                  <div className="text-lg font-medium text-gray-300">{notStartedOverview}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">未接通</div>
                  <div className="text-lg font-medium text-red-400">{notConnectedOverview}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">执行中</div>
                  <div className="text-lg font-medium text-blue-400">{executingCombinedOverview}</div>
                </div>
              </div>
              {totalJobsOverview > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">外呼进度</span>
                    <span className="text-sm text-white">{progressPercentOverview}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentOverview}%` }}
                    ></div>
                  </div>
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
                    ? `第 ${currentPage} / ${totalPages} 页 · 共 ${totalCount} 条`
                    : `当前显示 ${callJobs.length} 条记录`}
                </span>
              </div>

              <div className="space-y-3">
                {callJobs.map((job, index) => {
                  const isExpanded = expandedJobs.has(job.job_id);
                  const rawJob: any = job.raw_data || {};
                  const firstContact = rawJob?.Contacts?.[0];
                  const firstTask = Array.isArray(rawJob?.Tasks) ? rawJob.Tasks[0] : undefined;
                  const displayName = firstContact?.ContactName || rawJob?.LeadsName || rawJob?.follow_data?.leads_name || '未知';
                  const displayPhone = firstContact?.PhoneNumber || rawJob?.LeadsPhone || rawJob?.calling_number || rawJob?.follow_data?.leads_phone || '未知';
                  const displayDuration = getReadableDuration(firstTask);
                  const displayTime = firstTask ? formatTimestamp(firstTask.ActualTime ?? firstTask.PlanedTime ?? null) : '未知';

                  return (
                    <div key={job.job_id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      {/* 默认显示信息 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                          <h4 className="text-white font-medium">{displayName}</h4>
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
                          <span className="text-gray-400">电话:</span>
                          <span className="text-white ml-2 break-all">{displayPhone}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">通话时长:</span>
                          <span className="text-white ml-2">{displayDuration}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">拨打时间:</span>
                          <span className="text-white ml-2">{displayTime}</span>
                        </div>
                      </div>

                      {/* 展开的详细信息 */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-400">创建时间:</span>
                              <span className="text-white ml-2">{job.created_time || '未知'}</span>
                            </div>
                          </div>

                          {/* 联系人信息 */}
                          {rawJob?.Contacts && rawJob.Contacts.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">联系人信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {rawJob.Contacts.map((contact: any, contactIndex: number) => (
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

                          {/* 线索跟进信息 */}
                          {rawJob?.follow_data && !isFailedStatus(job.status) && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">线索跟进:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2 space-y-1">
                                <div>最新备注: {rawJob.follow_data.leads_remark || '无'}</div>
                                <div>首次跟进: {rawJob.follow_data.frist_follow_time ? formatTimestamp(rawJob.follow_data.frist_follow_time) : '未知'}</div>
                                <div>最新跟进: {rawJob.follow_data.new_follow_time ? formatTimestamp(rawJob.follow_data.new_follow_time) : '未知'}</div>
                                <div>下次提醒: {rawJob.follow_data.next_follow_time ? formatTimestamp(rawJob.follow_data.next_follow_time) : '未设置'}</div>
                              </div>
                            </div>
                          )}

                          {/* 通话任务详情 */}
                          {rawJob?.Tasks && rawJob.Tasks.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">通话详情:</span>
                              <div className="space-y-2 mt-1">
                                {rawJob.Tasks.map((task: any, taskIndex: number) => (
                                  <div key={taskIndex} className="bg-white/5 rounded p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-400">状态:</span>
                                        <span className={`ml-1 px-1 py-0.5 rounded text-xs ${getStatusColor(task.Status || job.status)}`}>
                                          {getStatusText(task.Status || job.status)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">主叫号码:</span>
                                        <span className="text-white ml-1">{task.CallingNumber || rawJob.calling_number || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">被叫号码:</span>
                                        <span className="text-white ml-1">{task.CalledNumber || rawJob.LeadsPhone || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">通话时长:</span>
                                        <span className="text-white ml-1">{getReadableDuration(task)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">实际时间:</span>
                                        <span className="text-white ml-1">{formatTimestamp(task.ActualTime ?? task.PlanedTime)}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">计划时间:</span>
                                        <span className="text-white ml-1">{formatTimestamp(task.PlanedTime)}</span>
                                      </div>
                                    </div>

                                    {/* 通话对话记录 */}
                                    {Array.isArray(task.Conversation) && task.Conversation.length > 0 && (
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
                          {rawJob?.Summary && rawJob.Summary.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">总结信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {rawJob.Summary.map((summary: any, summaryIndex: number) => (
                                  <div key={summaryIndex} className="mb-1 last:mb-0">
                                    <span className="text-gray-400">{summary.SummaryName}:</span>
                                    <span className="text-white ml-1">{summary.Content}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 额外信息 */}
                          {rawJob?.Extras && rawJob.Extras.length > 0 && (
                            <div className="mt-3">
                              <span className="text-gray-400 text-sm">额外信息:</span>
                              <div className="text-white text-sm mt-1 bg-white/5 rounded p-2">
                                {rawJob.Extras.map((extra: any, extraIndex: number) => (
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

              {totalPages > 1 && (
                <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-xs text-gray-400">
                    每页 {pageSize} 条 · 共 {totalCount} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === 1
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      首页
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === 1
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      上一页
                    </button>
                    <span className="text-gray-300 text-sm">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === totalPages
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        currentPage === totalPages
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      末页
                    </button>
                  </div>
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