'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../app/datepicker-custom.css';
import { tasksAPI } from '../services/api';
import SyncDCCModal from './SyncDCCModal';
import * as XLSX from 'xlsx';

interface FollowupRecord {
  id: string;
  leadName: string;
  phone: string;
  isInterested?: number | null; // 有无意向：null=待跟进, 0=无法判断, 1=有意向, 2=无意向
  remark?: string; // 备注
  conversation?: any; // 对话记录
  followupTime?: string; // 跟进时间
  callDuration?: number; // 通话时长
  nextFollowTime?: string; // 下次跟进时间
}

interface TaskInfo {
  id: number;
  task_name: string;
  task_type: number;
  create_time: string;
  leads_count: number;
  is_completed: boolean;
}

interface TaskStatistics {
  total_leads: number;      // 线索数量
  pending_follow: number;   // 待跟进数量（is_interested为空）
  unable_to_judge: number;  // 无法判断数量（is_interested=0）
  interested: number;       // 有意向数量（is_interested=1）
  not_interested: number;   // 无意向数量（is_interested=2）
}

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTaskId?: number;
}



export default function FollowupModal({ 
  isOpen, 
  onClose, 
  selectedTaskId
}: FollowupModalProps) {
  const [followupRecords, setFollowupRecords] = useState<FollowupRecord[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [taskStatistics, setTaskStatistics] = useState<TaskStatistics | null>(null);
  const [jobGroupProgress, setJobGroupProgress] = useState<any>(null); // 任务组进度信息
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');
  
  // 分页相关状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [totalJobs, setTotalJobs] = useState(0);
  
  // 筛选和展开状态
  const [interestFilter, setInterestFilter] = useState<'all' | 'pending' | 'unable_to_judge' | 'interested' | 'not_interested'>('all');
  const [nextFollowFilter, setNextFollowFilter] = useState<'all' | 'has_next_follow' | 'no_next_follow' | 'custom_range'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  
  // 新增：勾选状态
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // 新增：同步DCC弹窗状态
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 当弹窗打开且有选中的任务时，获取任务跟进记录
  useEffect(() => {
    if (isOpen && selectedTaskId) {
      // 清空选择状态
      setSelectedRecords(new Set());
      setSelectAll(false);
      setShowSyncModal(false);
      setCustomStartDate(null);
      setCustomEndDate(null);
      setNextFollowFilter('all');
      setInterestFilter('all');
      // 重置分页状态
      setPage(1);
      setHasMore(true);
      setFollowupRecords([]);
      fetchTaskData(false);
    }
  }, [isOpen, selectedTaskId]);

  // 处理统计卡片点击
  const handleStatisticsCardClick = (filterType: 'pending' | 'unable_to_judge' | 'interested' | 'not_interested') => {
    setActiveTab('records');
    setInterestFilter(filterType);
  };

  // 获取任务数据函数（支持追加模式）
  const fetchTaskData = useCallback(async (append: boolean = false) => {
    if (!selectedTaskId) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const currentPage = append ? page : 1;
      
      // 只在首次加载时获取任务统计信息
      if (!append) {
        // 先获取任务组进度信息，用于检查状态
        try {
          const progressResponse = await tasksAPI.describeJobGroup({ task_id: selectedTaskId });
          if (progressResponse.status === 'success' && progressResponse.data) {
            setJobGroupProgress(progressResponse.data);
          }
        } catch (error) {
          console.error('获取任务组进度信息失败:', error);
          // 不显示错误，因为这是辅助信息
        }
        
        const statisticsResponse = await tasksAPI.getTaskStatistics(selectedTaskId);
        
        if (statisticsResponse.status === 'success') {
          setTaskStatistics(statisticsResponse.data);
        } else {
          setError(statisticsResponse.message || '获取任务统计信息失败');
        }
      }

      // 获取任务执行情况（用于获取执行记录）- 支持分页，只查询已跟进的记录
      // 根据意向筛选将 interest 映射为 0/1/2 或 undefined
      const interestMap: Record<string, number | null | undefined> = {
        all: undefined,
        pending: null, // null 交给前端过滤，后端只查已跟进
        unable_to_judge: 0,
        interested: 1,
        not_interested: 2,
      };
      const interestValue = interestMap[interestFilter];
      const executionResponse = await tasksAPI.queryTaskExecution(
        selectedTaskId,
        currentPage,
        pageSize,
        true,
        true,
        interestValue === null ? undefined : interestValue
      );
      
      if (executionResponse.status === 'success') {
        const data = executionResponse.data;
        
        // 只在首次加载时构建任务信息
        if (!append) {
          // 使用接口返回的实际 task_type，而不是硬编码
          const actualTaskType = data.task_type || 1;
          // 使用接口返回的 task_stats 中的 is_completed 来判断是否完成
          const taskStats = data.task_stats || {};
          const isCompleted = taskStats.is_completed !== undefined ? taskStats.is_completed : (actualTaskType >= 3);
          
          const taskInfo: TaskInfo = {
            id: data.task_id,
            task_name: data.task_name,
            task_type: actualTaskType, // 使用接口返回的实际任务类型
            create_time: data.query_time,
            leads_count: data.total_jobs,
            is_completed: isCompleted // 使用接口返回的 is_completed
          };
          setTaskInfo(taskInfo);
          setTotalJobs(data.total_jobs || 0);
        }
        
        // 更新分页信息
        if (data.pagination) {
          const { page: currentPageNum, total_pages } = data.pagination;
          setHasMore(currentPageNum < total_pages);
          if (!append) {
            setPage(2); // 首次加载后，下次加载第二页
          } else {
            setPage(currentPageNum + 1); // 追加模式，设置下一页
          }
        }
        
        // 转换jobs_data为跟进记录格式
        const newFollowupRecords: FollowupRecord[] = data.jobs_data.map((job: any, index: number) => {
          const task = job.Tasks?.[0]; // 取第一个任务
          const contact = job.Contacts?.[0]; // 取第一个联系人
          const followData = job.follow_data; // 跟进数据
          
          // 确保正确获取 is_interested 值 - 从job根级别获取
          let isInterested = null;
          if (job.is_interested !== undefined) {
            isInterested = job.is_interested;
          }
          
          // 获取下次跟进时间
          let nextFollowTime = null;
          if (followData?.next_follow_time) {
            nextFollowTime = followData.next_follow_time;
          }
          
          // 调试信息：只在开发环境显示
          if (process.env.NODE_ENV === 'development' && !append) {
            console.log(`Record ${index}:`, {
              leadName: contact?.ContactName || '未知客户',
              isInterested: isInterested,
              jobIsInterested: job.is_interested,
              followData: followData,
              nextFollowTime: nextFollowTime
            });
          }
          
          // 使用 job_id 作为唯一标识，而不是 index
          const uniqueId = job.JobId || `record_${currentPage}_${index}`;
          
          return {
            id: uniqueId,
            leadName: contact?.ContactName || '未知客户',
            phone: contact?.PhoneNumber || task?.CalledNumber || '未知号码',
            isInterested: isInterested,
            remark: followData?.leads_remark || '',
            conversation: task?.Conversation || [],
            followupTime: task?.ActualTime ? new Date(task.ActualTime).toLocaleString() : '未知时间',
            callDuration: task?.Duration ? Math.floor(task.Duration / 1000) : 0,
            nextFollowTime: nextFollowTime
          };
        });
        
        // 追加模式：将新数据追加到现有数据；首次加载：替换数据
        if (append) {
          setFollowupRecords(prev => [...prev, ...newFollowupRecords]);
        } else {
          setFollowupRecords(newFollowupRecords);
        }
      } else {
        setError(executionResponse.message || '获取任务执行情况失败');
      }
    } catch (error) {
      console.error('获取任务数据失败:', error);
      setError('获取任务数据失败，请重试');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, pageSize, interestFilter]);

  // 当意向筛选变化时，重新请求第一页（后端带筛选，前端仍做补充过滤）
  useEffect(() => {
    if (!isOpen || !selectedTaskId) return;
    setPage(1);
    setHasMore(true);
    setFollowupRecords([]);
    fetchTaskData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestFilter, isOpen, selectedTaskId]);

  // 加载更多数据
  const loadMore = useCallback(async () => {
    if (!selectedTaskId || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      await fetchTaskData(true);
    } catch (error) {
      console.error('加载更多数据失败:', error);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, fetchTaskData]);

  // 定期刷新数据（只刷新第一页）
  useEffect(() => {
    if (!isOpen || !selectedTaskId) return;

    const refreshData = () => {
      // 刷新时重置到第一页
      setPage(1);
      setHasMore(true);
      setFollowupRecords([]);
      // 直接调用fetchTaskData，在非追加模式下它总是使用page=1
      fetchTaskData(false);
    };

    // 每30秒刷新一次数据
    const interval = setInterval(refreshData, 30000);
    
    return () => clearInterval(interval);
  }, [isOpen, selectedTaskId, fetchTaskData]);
  
  // 滚动加载更多
  useEffect(() => {
    if (!isOpen || activeTab !== 'records') return;
    
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      // 当滚动到距离底部100px时开始加载
      if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore && hasMore && !loading) {
        loadMore();
      }
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isOpen, activeTab, loadingMore, hasMore, loading, loadMore]);

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredRecords.map(record => record.id));
      setSelectedRecords(allIds);
      setSelectAll(true);
    }
  };

  // 处理单个选择
  const handleSelectRecord = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
    
    // 更新全选状态
    const allFilteredIds = new Set(filteredRecords.map(record => record.id));
    setSelectAll(newSelected.size === allFilteredIds.size && allFilteredIds.size > 0);
  };

  // 获取选中的记录
  const getSelectedRecords = () => {
    return filteredRecords.filter(record => selectedRecords.has(record.id));
  };



  const getTaskStatusText = (taskType: number, isCompleted: boolean) => {
    if (isCompleted) return '已完成';
    switch (taskType) {
      case 1:
        return '已创建';
      case 2:
        return '开始外呼';
      case 3:
        return '跟进中';
      case 4:
        return '跟进完成';
      default:
        return '未知状态';
    }
  };

  const getTaskStatusColor = (taskType: number, isCompleted: boolean) => {
    if (isCompleted) return 'text-green-400 bg-green-500/20';
    switch (taskType) {
      case 1:
        return 'text-blue-400 bg-blue-500/20';
      case 2:
        return 'text-yellow-400 bg-yellow-500/20';
      case 3:
        return 'text-blue-400 bg-blue-500/20';
      case 4:
        return 'text-green-400 bg-green-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getInterestStatusText = (isInterested: number | null) => {
    if (isInterested === null) return '待跟进';
    if (isInterested === 0) return '无法判断';
    if (isInterested === 1) return '有意向';
    if (isInterested === 2) return '无意向';
    return '未知';
  };

  const getInterestStatusColor = (isInterested: number | null) => {
    if (isInterested === null) return 'text-yellow-400 bg-yellow-500/20';
    if (isInterested === 0) return 'text-orange-400 bg-orange-500/20';
    if (isInterested === 1) return 'text-green-400 bg-green-500/20';
    if (isInterested === 2) return 'text-red-400 bg-red-500/20';
    return 'text-gray-400 bg-gray-500/20';
  };

  // 筛选记录
  const filteredRecords = followupRecords.filter(record => {
    // 意向筛选
    let interestMatch = true;
    if (interestFilter === 'pending') interestMatch = record.isInterested === null;
    else if (interestFilter === 'unable_to_judge') interestMatch = record.isInterested === 0;
    else if (interestFilter === 'interested') interestMatch = record.isInterested === 1;
    else if (interestFilter === 'not_interested') interestMatch = record.isInterested === 2;
    
    // 下次跟进时间筛选
    let nextFollowMatch = true;
    if (nextFollowFilter === 'has_next_follow') nextFollowMatch = !!record.nextFollowTime;
    else if (nextFollowFilter === 'no_next_follow') nextFollowMatch = !record.nextFollowTime;
    else if (nextFollowFilter === 'custom_range') {
      if (!record.nextFollowTime) {
        nextFollowMatch = false;
      } else {
        try {
          const recordDate = new Date(record.nextFollowTime);
          
          if (customStartDate && customEndDate) {
            nextFollowMatch = recordDate >= customStartDate && recordDate <= customEndDate;
          } else if (customStartDate) {
            nextFollowMatch = recordDate >= customStartDate;
          } else if (customEndDate) {
            nextFollowMatch = recordDate <= customEndDate;
          } else {
            nextFollowMatch = true;
          }
        } catch {
          nextFollowMatch = false;
        }
      }
    }
    
    return interestMatch && nextFollowMatch;
  });

  // 切换展开状态
  const toggleRecordExpansion = (recordId: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  // 格式化通话时长
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0秒';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  };

  // 格式化下次跟进时间
  const formatNextFollowTime = (nextFollowTime: string | null | undefined) => {
    if (!nextFollowTime) return '-';
    try {
      const date = new Date(nextFollowTime);
      return date.toLocaleString('zh-CN');
    } catch {
      return nextFollowTime;
    }
  };

  // 渲染对话记录
  const renderConversation = (conversation: any) => {
    if (!conversation) return null;
    
    // 如果conversation是数组格式（新接口格式）
    if (Array.isArray(conversation)) {
      return (
        <div className="space-y-3">
          {conversation.map((item, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                item.Speaker === 'Robot' ? 'bg-blue-500/20' : 'bg-green-500/20'
              }`}>
                <span className={`text-xs font-medium ${
                  item.Speaker === 'Robot' ? 'text-blue-400' : 'text-green-400'
                }`}>
                  {item.Speaker === 'Robot' ? 'AI' : '客'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">
                  {item.Speaker === 'Robot' ? 'AI助手' : '客户'}
                </div>
                <div className="text-sm text-white bg-white/5 p-3 rounded-lg">
                  {item.Script || '无内容'}
                </div>
                {item.Summary && item.Summary.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="text-xs text-blue-400 mb-1">对话摘要：</div>
                    {item.Summary.map((summary: any, summaryIndex: number) => (
                      <div key={summaryIndex} className="text-xs text-blue-300">
                        {summary.SummaryName}: {summary.Content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // 如果conversation是对象格式（旧格式兼容）
    if (typeof conversation === 'object' && !Array.isArray(conversation)) {
      return (
        <div className="space-y-3">
          {Object.entries(conversation).map(([key, value]: [string, any], index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                key.includes('assistant') || key.includes('ai') ? 'bg-blue-500/20' : 'bg-green-500/20'
              }`}>
                <span className={`text-xs font-medium ${
                  key.includes('assistant') || key.includes('ai') ? 'text-blue-400' : 'text-green-400'
                }`}>
                  {key.includes('assistant') || key.includes('ai') ? 'AI' : '客'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">
                  {key.includes('assistant') || key.includes('ai') ? 'AI助手' : '客户'}
                </div>
                <div className="text-sm text-white bg-white/5 p-3 rounded-lg">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // 如果是字符串格式
    return (
      <div className="text-sm text-white bg-white/5 p-3 rounded-lg">
        {conversation}
      </div>
    );
  };

  // 导出Excel方法
  const handleExportExcel = () => {
    const selected = getSelectedRecords();
    if (selected.length === 0) {
      alert('请至少选择一条记录进行导出');
      return;
    }
    // 组装导出数据
    const exportData = selected.map(record => ({
      姓名: record.leadName,
      手机号: record.phone,
      有无意向: getInterestStatusText(record.isInterested ?? null),
      下次跟进时间: record.nextFollowTime ? formatNextFollowTime(record.nextFollowTime) : '-',
      备注: record.remark || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '跟进记录');
    XLSX.writeFile(wb, '跟进记录.xlsx');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col">
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-white">跟进记录Agent</h2>
              <p className="text-gray-400 text-sm mt-1">任务执行情况和通话记录</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 弹窗内容 - 支持滚动 */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
            {/* 加载状态 */}
            {loading && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <span className="text-blue-400 ml-2">正在加载任务数据...</span>
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* 任务信息 */}
            {taskInfo && (
              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{taskInfo.task_name}</h3>
                    <p className="text-gray-400 text-sm">创建时间：{taskInfo.create_time}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* 外呼状态指示器 */}
                    {taskInfo.task_type === 2 && (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-blue-400 text-sm">外呼进行中</span>
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded text-sm ${getTaskStatusColor(taskInfo.task_type, taskInfo.is_completed)}`}>
                      {getTaskStatusText(taskInfo.task_type, taskInfo.is_completed)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">线索数量：</span>
                    <span className="text-white">{taskInfo.leads_count}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">任务状态：</span>
                    <span className="text-white">{taskInfo.is_completed ? '已完成' : '进行中'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">外呼状态：</span>
                    <span className={taskInfo.task_type === 2 ? 'text-blue-400' : 'text-green-400'}>
                      {taskInfo.task_type === 2 ? '进行中' : '已完成'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 标签页切换 */}
            <div className="mb-6">
              <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'overview'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  任务概览
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'records'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  执行记录
                </button>
              </div>
            </div>

            {/* 任务概览 */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 任务组进度信息 */}
                {jobGroupProgress && jobGroupProgress.progress && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <h4 className="text-white font-medium mb-4">任务执行进度</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-blue-400 font-semibold text-lg">{jobGroupProgress.progress.total_jobs || 0}</div>
                        <div className="text-gray-400 text-xs">总任务数</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-green-400 font-semibold text-lg">{jobGroupProgress.progress.total_completed || 0}</div>
                        <div className="text-gray-400 text-xs">已完成</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-blue-400 font-semibold text-lg">{jobGroupProgress.progress.executing || 0}</div>
                        <div className="text-gray-400 text-xs">执行中</div>
                      </div>
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-yellow-400 font-semibold text-lg">{jobGroupProgress.progress.scheduling || 0}</div>
                        <div className="text-gray-400 text-xs">调度中</div>
                      </div>
                    </div>
                    {jobGroupProgress.progress.total_jobs > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">完成进度</span>
                          <span className="text-sm text-white">
                            {Math.round((jobGroupProgress.progress.total_completed / jobGroupProgress.progress.total_jobs) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(jobGroupProgress.progress.total_completed / jobGroupProgress.progress.total_jobs) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                    {jobGroupProgress.status && (
                      <div className="mt-3 text-xs text-gray-400">
                        任务组状态: <span className="text-white">{jobGroupProgress.status}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 任务统计信息 */}
                {taskStatistics && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <h4 className="text-white font-medium mb-4">执行情况详情</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 bg-white/5 rounded-lg">
                        <div className="text-blue-400 font-semibold text-lg">{taskStatistics.total_leads}</div>
                        <div className="text-gray-400 text-xs">线索数量</div>
                      </div>
                      <div 
                        className="text-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => handleStatisticsCardClick('pending')}
                      >
                        <div className="text-yellow-400 font-semibold text-lg">{taskStatistics.pending_follow}</div>
                        <div className="text-gray-400 text-xs">待跟进数量</div>
                      </div>
                      <div 
                        className="text-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => handleStatisticsCardClick('unable_to_judge')}
                      >
                        <div className="text-orange-400 font-semibold text-lg">{taskStatistics.unable_to_judge}</div>
                        <div className="text-gray-400 text-xs">无法判断数量</div>
                      </div>
                      <div 
                        className="text-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => handleStatisticsCardClick('interested')}
                      >
                        <div className="text-green-400 font-semibold text-lg">{taskStatistics.interested}</div>
                        <div className="text-gray-400 text-xs">有意向数量</div>
                      </div>
                      <div 
                        className="text-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => handleStatisticsCardClick('not_interested')}
                      >
                        <div className="text-red-400 font-semibold text-lg">{taskStatistics.not_interested}</div>
                        <div className="text-gray-400 text-xs">无意向数量</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 执行记录列表 */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                {/* 第一行：标题和操作按钮 */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">执行记录</h3>
                  <div className="flex items-center space-x-2">
                    {/* 导出Excel按钮 */}
                    <button
                      onClick={handleExportExcel}
                      disabled={selectedRecords.size === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedRecords.size > 0
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-white/10 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      导出Excel
                    </button>
                    {/* 同步DCC按钮 */}
                    <button
                      onClick={() => setShowSyncModal(true)}
                      disabled={selectedRecords.size === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedRecords.size > 0
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : 'bg-white/10 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      同步DCC ({selectedRecords.size})
                    </button>
                  </div>
                </div>
                
                {/* 第二行：筛选器 */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* 意向筛选 */}
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm whitespace-nowrap">意向筛选：</span>
                      <select
                        value={interestFilter}
                        onChange={(e) => setInterestFilter(e.target.value as any)}
                        className="bg-white/5 border border-white/20 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400"
                      >
                        <option value="all">全部</option>
                        <option value="pending">待跟进</option>
                        <option value="unable_to_judge">无法判断</option>
                        <option value="interested">有意向</option>
                        <option value="not_interested">无意向</option>
                      </select>
                    </div>
                    
                    {/* 下次跟进筛选 */}
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm whitespace-nowrap">下次跟进：</span>
                      <select
                        value={nextFollowFilter}
                        onChange={(e) => setNextFollowFilter(e.target.value as any)}
                        className="bg-white/5 border border-white/20 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-400"
                      >
                        <option value="all">全部</option>
                        <option value="has_next_follow">有下次跟进</option>
                        <option value="no_next_follow">无下次跟进</option>
                        <option value="custom_range">自定义区间</option>
                      </select>
                    </div>
                    
                    {/* 自定义时间区间 */}
                    {nextFollowFilter === 'custom_range' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-sm whitespace-nowrap">时间区间：</span>
                        <DatePicker
                          selected={customStartDate}
                          onChange={(date) => setCustomStartDate(date)}
                          selectsStart
                          startDate={customStartDate || undefined}
                          endDate={customEndDate || undefined}
                          className="bg-white/5 border border-white/20 rounded px-3 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                          placeholderText="开始时间"
                          dateFormat="yyyy-MM-dd HH:mm"
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                        />
                        <span className="text-gray-400 text-sm">至</span>
                        <DatePicker
                          selected={customEndDate}
                          onChange={(date) => setCustomEndDate(date)}
                          selectsEnd
                          startDate={customStartDate || undefined}
                          endDate={customEndDate || undefined}
                          minDate={customStartDate || undefined}
                          className="bg-white/5 border border-white/20 rounded px-3 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                          placeholderText="结束时间"
                          dateFormat="yyyy-MM-dd HH:mm"
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                        />
                      </div>
                    )}
                    
                    {/* 结果统计 */}
                    <div className="flex items-center space-x-3 ml-auto">
                      {loading && (
                        <div className="flex items-center text-blue-400 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                          <span className="ml-2">正在加载...</span>
                        </div>
                      )}
                      <span className="text-gray-400 text-sm">
                        筛选结果：{filteredRecords.length}/{followupRecords.length}
                        {totalJobs > 0 && ` / ${totalJobs}`}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* 全选功能 */}
                {filteredRecords.length > 0 && (
                  <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-400 focus:ring-2"
                      />
                      <span className="text-white text-sm">全选</span>
                    </label>
                    <span className="text-gray-400 text-sm">
                      已选择 {selectedRecords.size} 条记录
                    </span>
                  </div>
                )}
                
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>暂无符合条件的执行记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredRecords.map((record) => (
                      <div key={record.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                        {/* 记录头部 - 可点击展开 */}
                        <div className="p-4">
                          <div className="flex items-start space-x-3">
                            {/* 勾选框 */}
                            <div className="flex-shrink-0 pt-1">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(record.id)}
                                onChange={() => handleSelectRecord(record.id)}
                                className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-400 focus:ring-2"
                              />
                            </div>
                            
                            {/* 记录内容 */}
                            <div className="flex-1 cursor-pointer" onClick={() => toggleRecordExpansion(record.id)}>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {/* 姓名 */}
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">姓名</div>
                                  <div className="text-white font-medium">{record.leadName}</div>
                                </div>
                                
                                {/* 手机号 */}
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">手机号</div>
                                  <div className="text-white">{record.phone}</div>
                                </div>
                                
                                {/* 有无意向 */}
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">有无意向</div>
                                  <span className={`px-2 py-1 rounded text-xs ${getInterestStatusColor(record.isInterested ?? null)}`}>
                                    {getInterestStatusText(record.isInterested ?? null)}
                                  </span>
                                </div>
                                
                                {/* 下次跟进时间 - 仅在有意的记录中显示 */}
                                {record.isInterested === 1 && (
                                  <div>
                                    <div className="text-gray-400 text-xs mb-1">下次跟进时间</div>
                                    <div className="text-white text-sm">
                                      {formatNextFollowTime(record.nextFollowTime)}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 备注 */}
                                <div>
                                  <div className="text-gray-400 text-xs mb-1">备注</div>
                                  <div className="text-white text-sm">
                                    {record.remark || '-'}
                                  </div>
                                </div>
                              </div>
                              
                              {/* 展开指示器 */}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                                <div className="flex items-center space-x-4 text-xs text-gray-400">
                                  {record.followupTime && (
                                    <span>执行时间：{record.followupTime}</span>
                                  )}
                                  {record.callDuration && (
                                    <span>通话时长：{formatDuration(record.callDuration)}</span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-400">
                                    {expandedRecords.has(record.id) ? '收起' : '展开对话'}
                                  </span>
                                  <svg 
                                    className={`w-4 h-4 text-gray-400 transition-transform ${
                                      expandedRecords.has(record.id) ? 'rotate-180' : ''
                                    }`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* 展开的对话内容 */}
                        {expandedRecords.has(record.id) && record.conversation && (
                          <div className="px-4 pb-4 border-t border-white/10">
                            <div className="mt-4">
                              <div className="flex items-center mb-3">
                                <svg className="w-4 h-4 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="text-purple-400 font-medium text-sm">通话对话</span>
                              </div>
                              {renderConversation(record.conversation)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 加载更多指示器 */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span className="text-blue-400 ml-2 text-sm">加载更多数据...</span>
                  </div>
                )}
                
                {/* 没有更多数据提示 */}
                {!hasMore && followupRecords.length > 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    已加载全部数据
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 同步DCC弹窗 */}
      <SyncDCCModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        selectedRecords={getSelectedRecords()}
      />
    </>
  );
} 