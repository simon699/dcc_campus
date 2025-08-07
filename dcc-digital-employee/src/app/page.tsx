'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { tasksAPI, checkTokenValidity } from '../services/api';
import { setupTokenValidationOnVisibility } from '../utils/tokenUtils';
import Header from '../components/Header';
import CallRecordDrawer from '../components/CallRecordDrawer';
import DccBindModal from '../components/DccBindModal';
import TaskCreationDrawer from '../components/TaskCreationDrawer';
import TaskListDrawer from '../components/TaskListDrawer';
import TaskSelectionDrawer from '../components/TaskSelectionDrawer';
import ScriptGenerationDrawer from '../components/ScriptGenerationDrawer';
import TaskDetailDrawer from '../components/TaskDetailDrawer';
import TaskLeadsDrawer from '../components/TaskLeadsDrawer';
import MonitorDrawer from '../components/MonitorDrawer';
import FollowupModal from '../components/FollowupModal';
import TaskSelectionModal from '../components/TaskSelectionModal';

// 自定义动画样式
const robotAnimations = `
  @keyframes robot-pulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
    }
  }

  @keyframes robot-glow {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  .robot-working {
    animation: robot-pulse 2s ease-in-out infinite;
  }

  .robot-glow {
    animation: robot-glow 3s ease-in-out infinite;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

interface RobotCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'idle' | 'working' | 'error';
  progress: number;
  stats: {
    total: number;
    completed: number;
    current: number;
  };
  isExpanded?: boolean;
}

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  customerLevel: string;
  lastFollowUp: string;
  nextFollowUp: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
}

interface CallTask {
  id: string;
  leadName: string;
  phone: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  progress: number;
}

interface CallRecord {
  id: string;
  leadName: string;
  phone: string;
  callTime: string;
  duration: string;
  status: 'success' | 'failed' | 'no-answer' | 'busy';
  result: string;
  notes?: string;
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // 机器人数据 - 初始化为空状态
  const [robots, setRobots] = useState<RobotCard[]>([
    {
      id: 'task',
      name: '任务Agent',
      description: '智能任务分配和管理，优化工作流程',
      icon: '📋',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    },
    {
      id: 'script',
      name: '话术生成Agent',
      description: '智能生成个性化话术，提升沟通效果',
      icon: '💬',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    },
    {
      id: 'calling',
      name: '外呼Agent',
      description: '智能外呼客户，自动语音交互',
      icon: '📞',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    },
    {
      id: 'followup',
      name: '跟进Agent',
      description: '监控进行中的线索和已完成的任务',
      icon: '📝',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    }
  ]);

  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [showCallRecordDrawer, setShowCallRecordDrawer] = useState(false);
  const [showTaskCreationDrawer, setShowTaskCreationDrawer] = useState(false);
  const [showTaskListDrawer, setShowTaskListDrawer] = useState(false);
  const [showTaskSelectionDrawer, setShowTaskSelectionDrawer] = useState(false);
  const [showScriptGenerationDrawer, setShowScriptGenerationDrawer] = useState(false);
  const [showTaskDetailDrawer, setShowTaskDetailDrawer] = useState(false);
  const [showTaskLeadsDrawer, setShowTaskLeadsDrawer] = useState(false);
  const [taskLeadsData, setTaskLeadsData] = useState<any>(null);

  const [callTasks, setCallTasks] = useState<CallTask[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [showDccBindModal, setShowDccBindModal] = useState(false);
  const [isDccBound, setIsDccBound] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskForScript, setSelectedTaskForScript] = useState<any>(null);
  const [showMonitorDrawer, setShowMonitorDrawer] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedTaskForFollowup, setSelectedTaskForFollowup] = useState<any>(null);
  const [showTaskSelectionModal, setShowTaskSelectionModal] = useState(false);





  // 获取任务统计数据
  useEffect(() => {
    const fetchTaskStatistics = async () => {
      if (!isDccBound) return;
      
      try {
        const response = await tasksAPI.getCallTasksStatistics();
        if (response.status === 'success') {
          const statsData = response.data;
          
          // 添加调试信息
          console.log('DEBUG - Task statistics response:', response);
          console.log('DEBUG - Stats data:', statsData);
          
          // 将数组转换为按task_type索引的对象
          const statsByType = statsData.reduce((acc: any, item: any) => {
            acc[item.task_type] = item;
            return acc;
          }, {});
          
          // 使用setTimeout避免在渲染过程中直接调用setState
          setTimeout(() => {
            setRobots(prev => prev.map(robot => {
              switch (robot.id) {
                case 'task':
                  // 任务Agent：显示已创建的任务数量
                  const taskStats = statsByType[1] || { count: 0, leads_count: 0 };
                  return {
                    ...robot,
                    stats: {
                      total: taskStats.count,
                      completed: 0, // 已创建的任务都是待处理的
                      current: taskStats.count
                    }
                  };
                case 'script':
                  // 话术生成Agent：显示总任务和待生成任务数
                  // 待生成任务就是 call_type = 1 的
                  const scriptStats = statsByType[1] || { count: 0, leads_count: 0 };
                  return {
                    ...robot,
                    stats: {
                      total: scriptStats.count, // 总任务数
                      completed: 0, // 已生成话术的任务数（暂时设为0，后续可以根据script_id判断）
                      current: scriptStats.count // 待生成任务数（call_type = 1）
                    },
                    // 话术生成Agent：只有在有待生成话术的任务时才显示为工作中
                    status: scriptStats.count > 0 ? 'working' : 'idle'
                  };
                case 'calling':
                  // 外呼Agent：显示外呼中的任务（task_type=2）和外呼完成的任务（task_type=3）
                  const executingStats = statsByType[2] || { count: 0, leads_count: 0 };
                  const completedStats = statsByType[3] || { count: 0, leads_count: 0 };
                  const totalCallingTasks = executingStats.count + completedStats.count;
                  
                  return {
                    ...robot,
                    stats: {
                      total: totalCallingTasks, // 总外呼任务数
                      completed: completedStats.count, // 外呼完成的任务数（task_type=3）
                      current: executingStats.count  // 外呼中的任务数（task_type=2）
                    },
                    // 外呼Agent：根据是否有外呼中的任务来决定工作状态
                    status: executingStats.count > 0 ? 'working' : 'idle'
                  };
                case 'followup':
                  // 跟进Agent：展示跟进中的任务（task_type=3）和跟进完成的任务（task_type=4）
                  const followupInProgressStats = statsByType[3] || { count: 0, leads_count: 0 };
                  const followupCompletedStats = statsByType[4] || { count: 0, leads_count: 0 };
                  
                  return {
                    ...robot,
                    stats: {
                      total: followupInProgressStats.count + followupCompletedStats.count, // 总跟进任务数
                      completed: followupCompletedStats.count, // 跟进完成的任务数（task_type=4）
                      current: followupInProgressStats.count  // 跟进中的任务数（task_type=3）
                    },
                    // 跟进Agent：如果有跟进中的任务或跟进完成的任务时显示为工作中
                    status: (followupInProgressStats.count > 0 || followupCompletedStats.count > 0) ? 'working' : 'idle'
                  };
                default:
                  return robot;
              }
            }));
          }, 0);
        }
      } catch (error) {
        console.error('获取任务统计数据失败:', error);
      }
    };

    fetchTaskStatistics();
    
    // 定期刷新统计数据以更新工作状态
    const interval = setInterval(fetchTaskStatistics, 10000); // 每10秒刷新一次
    
    return () => clearInterval(interval);
  }, [isDccBound]);

  // 初始化token验证
  useEffect(() => {
    console.log("Home page mounted");
    
    // 设置页面可见性变化时的token验证
    const cleanup = setupTokenValidationOnVisibility();
    
    return cleanup;
  }, []); // 空依赖数组，确保只执行一次

  // 检查DCC绑定状态
  useEffect(() => {
    const checkDccBinding = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.dcc_user) {
          setIsDccBound(true);
        } else {
          setIsDccBound(false);
          setShowDccBindModal(true);
        }
      }
    };

    // 延迟检查，确保页面完全加载
    const timer = setTimeout(checkDccBinding, 500);
    return () => clearTimeout(timer);
  }, []);

  // 处理任务详情查看
  const handleViewTaskDetails = (taskDetails: any) => {
    setTaskLeadsData(taskDetails);
    setShowTaskLeadsDrawer(true);
  };

  // 处理刷新任务详情
  const handleRefreshTaskDetails = async (taskId: string) => {
    try {
      // 重新获取任务详情，包括 leads_task_list 数据
      const response = await tasksAPI.getCallTaskDetails(taskId);
      if (response.status === 'success') {
        console.log('任务详情已刷新:', response.data);
        // 如果当前正在显示任务线索抽屉，则更新数据
        if (showTaskLeadsDrawer && taskLeadsData?.task_info?.id === parseInt(taskId)) {
          setTaskLeadsData(response.data);
        }
      }
    } catch (error) {
      console.error('刷新任务详情失败:', error);
    }
  };

  // 处理外呼成功回调
  const handleOutboundCallSuccess = async () => {
    // 刷新任务列表
    try {
      const response = await tasksAPI.getCallTasksList();
      if (response.status === 'success') {
        const apiTasks = response.data.tasks || [];
        // 显示已开始外呼和已完成的任务
        const convertedTasks = apiTasks
                      .filter((apiTask: any) => apiTask.task_type === 2 || apiTask.task_type === 3 || apiTask.task_type === 4) // 显示正在外呼、已完成和跟进完成的任务
          .map((apiTask: any) => ({
            id: apiTask.id.toString(),
            name: apiTask.task_name,
            createdAt: new Date(apiTask.create_time).toLocaleString(),
            conditions: [],
            targetCount: apiTask.leads_count,
            filteredCount: apiTask.leads_count,
            status: (apiTask.task_type === 3 || apiTask.task_type === 4) ? 'completed' : 'calling' as const,
            organization_id: apiTask.organization_id,
            create_name: apiTask.create_name,
            script_id: apiTask.script_id,
            task_type: apiTask.task_type,
            size_desc: apiTask.size_desc
          }));
        
        setTasks(convertedTasks);
      }
    } catch (error) {
      console.error('刷新任务列表失败:', error);
    }
  };



  // 处理机器人点击
  const handleRobotClick = async (robotId: string) => {
    // 检查是否已绑定DCC账号
    if (!isDccBound) {
      alert('请先绑定DCC账号才能进行操作');
      setShowDccBindModal(true);
      return;
    }

    setSelectedRobot(robotId);
    
    // 任务Agent直接进入创建任务页面
    if (robotId === 'task') {
      setShowTaskCreationDrawer(true);
      return;
    }
    
    // 话术生成Agent
    if (robotId === 'script') {
      try {
        // 调用话术生成任务列表API
        const response = await tasksAPI.getScriptTasksList();
        if (response.status === 'success') {
          // 转换API数据格式为本地格式
          const apiTasks = response.data || []; // 直接使用response.data，因为返回的是数组
          const convertedTasks = apiTasks.map((apiTask: any) => ({
            id: apiTask.id.toString(),
            name: apiTask.task_name,
            createdAt: new Date(apiTask.create_time).toLocaleString(),
            conditions: [], // API中没有筛选条件信息，暂时为空
            targetCount: apiTask.leads_count,
            filteredCount: apiTask.leads_count,
            status: 'pending' as const,
            organization_id: apiTask.organization_id,
            create_name: apiTask.create_name,
            script_id: apiTask.script_id,
            task_type: apiTask.task_type,
            size_desc: apiTask.size_desc
          }));
          
          setTasks(convertedTasks);
          setShowTaskSelectionDrawer(true);
        } else {
          console.error('获取话术生成任务列表失败:', response.message);
          alert('获取话术生成任务列表失败，请重试');
        }
      } catch (error) {
        console.error('获取话术生成任务列表失败:', error);
        alert('获取话术生成任务列表失败，请重试');
      }
      return;
    }
    
    // 外呼Agent
    if (robotId === 'calling') {
      try {
        console.log('外呼Agent clicked, 开始获取任务列表...');
        // 调用/tasks端点获取任务列表
        const response = await tasksAPI.getCallTasksList();
        if (response.status === 'success') {
          // API返回的是数组格式，不是包含tasks字段的对象
          const apiTasks = response.data || [];
          
          // 过滤出task_type = 2或3的任务（外呼中的任务和外呼完成的任务）
          const filteredTasks = apiTasks.filter((task: any) => 
            task.task_type === 2 || task.task_type === 3
          );
          
          console.log('DEBUG - All tasks:', apiTasks);
          console.log('DEBUG - Filtered tasks (type 2 or 3):', filteredTasks);
          
          if (filteredTasks.length === 0) {
            // 没有外呼相关的任务，显示提示
            alert('暂无外呼中或外呼完成的任务，请先发起任务并发起外呼');
            return;
          }
          
          // 转换过滤后的任务数据
          const convertedTasks = filteredTasks.map((apiTask: any) => ({
              id: apiTask.id.toString(),
              name: apiTask.task_name,
              createdAt: new Date(apiTask.create_time).toLocaleString(),
              conditions: [],
              targetCount: apiTask.leads_count,
              filteredCount: apiTask.leads_count,
              status: apiTask.task_type === 3 ? 'completed' : 'calling' as const, // task_type=3是外呼完成，其他是外呼中
              organization_id: apiTask.organization_id,
              create_name: apiTask.create_name,
              script_id: apiTask.script_id,
              task_type: apiTask.task_type,
              size_desc: apiTask.size_desc
            }));
          
          setTasks(convertedTasks);
          

          
          // 显示外呼Agent监控界面
          console.log('显示外呼Agent监控界面');
          setShowMonitorDrawer(true);
        } else {
          console.error('获取任务列表失败:', response.message);
          alert('获取任务列表失败，请重试');
        }
      } catch (error) {
        console.error('获取任务列表失败:', error);
        alert('获取任务列表失败，请重试');
      }
      return;
    }
    
    // 跟进Agent
    if (robotId === 'followup') {
      try {
        // 获取任务列表，显示跟进中的任务（task_type = 3）和跟进完成的任务（task_type = 4）
        const response = await tasksAPI.getCallTasksList();
        if (response.status === 'success') {
          // API返回的是数组格式，不是包含tasks字段的对象
          const apiTasks = response.data || [];
          // 过滤出跟进中和跟进完成的任务（task_type = 3 或 task_type = 4）
          const followupTasks = apiTasks.filter((task: any) => task.task_type === 3 || task.task_type === 4);
          
          if (followupTasks.length === 0) {
            alert('暂无跟进中或跟进完成的任务，请等待任务进入跟进阶段');
            return;
          }
          
          // 转换任务数据格式
          const convertedTasks = followupTasks.map((apiTask: any) => ({
            id: apiTask.id.toString(),
            name: apiTask.task_name,
            createdAt: new Date(apiTask.create_time).toLocaleString(),
            conditions: [],
            targetCount: apiTask.leads_count,
            filteredCount: apiTask.leads_count,
            status: apiTask.task_type === 4 ? 'completed' : 'calling' as const, // task_type=4是跟进完成，其他是跟进中
            organization_id: apiTask.organization_id,
            create_name: apiTask.create_name,
            script_id: apiTask.script_id,
            task_type: apiTask.task_type,
            size_desc: apiTask.size_desc
          }));
          
          setTasks(convertedTasks);
          
          // 显示任务选择模态框
          setShowTaskSelectionModal(true);
        } else {
          console.error('获取任务列表失败:', response.message);
          alert('获取任务列表失败，请重试');
        }
      } catch (error) {
        console.error('获取任务列表失败:', error);
        alert('获取任务列表失败，请重试');
      }
      return;
    }
  };

  // 处理任务选择
  const handleTaskSelectForFollowup = (task: any) => {
    setSelectedTaskForFollowup(task);
    setShowFollowupModal(true);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'idle': '空闲',
      'working': '工作中',
      'error': '错误'
    };
    return statusMap[status] || status;
  };

  // 如果正在加载或验证token，显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              DCC 数字员工
            </h1>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse delay-500" />
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <span className="text-gray-300 text-sm">
              {loading ? '正在加载...' : '正在验证登录状态...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 如果没有用户信息，跳转到登录页面
  if (!user) {
    return null; // 返回null，让AuthContext处理跳转
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 自定义动画样式 */}
      <style jsx>{robotAnimations}</style>
      
      {/* 动态背景粒子效果 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        <Header />
        
        <main className="pt-4 px-4 sm:px-6 lg:px-8 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题和手动分析按钮 */}
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Agent工作台</h1>
                <p className="text-gray-300 text-sm">
                  {isDccBound ? '监控和管理您的智能Agent团队' : '请先绑定DCC账号以开始使用'}
                </p>
                {!isDccBound && (
                  <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-yellow-200 text-xs">需要绑定DCC账号才能使用系统功能</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 机器人卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {robots.map((robot) => (
                <div key={robot.id}>
                  {/* 机器人卡片 */}
                  <div
                    onClick={() => handleRobotClick(robot.id)}
                    className={`
                      relative group transition-all duration-500 transform
                      bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4
                      min-h-[280px] flex flex-col justify-between
                      ${isDccBound 
                        ? 'cursor-pointer hover:scale-105 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl' 
                        : 'cursor-not-allowed opacity-60'
                      }
                      ${selectedRobot === robot.id ? 'ring-2 ring-blue-500/50' : ''}
                      ${robot.id === 'calling' && robot.status === 'working' ? 'robot-working' : ''}
                      ${robot.id === 'followup' && robot.status === 'working' ? 'robot-working' : ''}
                    `}
                  >
                    {/* 工作状态指示器 - 对外呼Agent和跟进Agent显示 */}
                    {(robot.id === 'calling' || robot.id === 'followup') && robot.status === 'working' && (
                      <div className="absolute top-3 right-3">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${robot.id === 'calling' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                        <div className={`absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-75 ${robot.id === 'calling' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                      </div>
                    )}

                    {/* 机器人图标 */}
                    <div className="text-center mb-3">
                      <div className={`
                        relative inline-flex items-center justify-center w-12 h-12 rounded-xl
                        text-2xl mb-2 transition-all duration-300 group-hover:scale-110
                        ${robot.id === 'calling' && robot.status === 'working' 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 robot-glow' 
                          : robot.id === 'followup' && robot.status === 'working'
                          ? 'bg-gradient-to-br from-green-500 to-blue-600 robot-glow'
                          : 'bg-gradient-to-br from-gray-600 to-gray-700'
                        }
                      `}>
                        {robot.icon}
                        {/* 工作时的旋转光环 - 对外呼Agent和跟进Agent显示 */}
                        {robot.id === 'calling' && robot.status === 'working' && (
                          <div className="absolute inset-0 rounded-xl border-2 border-blue-400/50 animate-spin"></div>
                        )}
                        {robot.id === 'followup' && robot.status === 'working' && (
                          <div className="absolute inset-0 rounded-xl border-2 border-green-400/50 animate-spin"></div>
                        )}
                      </div>
                    </div>

                    {/* 机器人信息 */}
                    <div className="text-center flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">{robot.name}</h3>
                        <p className="text-xs text-gray-300 mb-3 line-clamp-2">{robot.description}</p>
                        
                        {/* 状态指示器 - 对外呼Agent和跟进Agent显示 */}
                        {(robot.id === 'calling' || robot.id === 'followup') && (
                          <div className="flex items-center justify-center mb-3">
                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusColor(robot.status)}`}></div>
                            <span className={`text-xs ${getStatusColor(robot.status)}`}>
                              {getStatusText(robot.status)}
                            </span>
                            {/* 工作状态下的点击提示 */}
                            {robot.status === 'working' && (
                              <div className="ml-2 text-xs text-blue-400 animate-pulse">
                                点击查看
                              </div>
                            )}
                          </div>
                        )}


                      </div>

                      {/* 统计信息区域 - 为所有Agent提供统一的空间 */}
                      <div className="mt-auto">
                        {/* 统计信息 - 对外呼Agent、跟进Agent和话术生成Agent显示 */}
                        {(robot.id === 'calling' || robot.id === 'followup' || robot.id === 'script') && (
                          <div className="grid grid-cols-3 gap-2 text-center mb-3">
                            {robot.id === 'calling' && (
                              <>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                                  <div className="text-gray-400 text-xs">总外呼任务</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                                  <div className="text-gray-400 text-xs">外呼完成</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                                  <div className="text-gray-400 text-xs">外呼中</div>
                                </div>
                              </>
                            )}
                            {robot.id === 'followup' && (
                              <>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                                  <div className="text-gray-400 text-xs">总跟进任务</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                                  <div className="text-gray-400 text-xs">跟进完成</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                                  <div className="text-gray-400 text-xs">跟进中</div>
                                </div>
                              </>
                            )}
                            {robot.id === 'script' && (
                              <>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                                  <div className="text-gray-400 text-xs">总任务</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                                  <div className="text-gray-400 text-xs">已生成</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                                  <div className="text-gray-400 text-xs">待生成</div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* 任务Agent的占位区域 - 保持高度一致 */}
                        {robot.id === 'task' && (
                          <div className="h-[60px] flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-gray-400 text-xs">任务管理</div>
                              <div className="text-gray-500 text-xs mt-1">智能分配</div>
                            </div>
                          </div>
                        )}

                        {/* 点击提示 - 非工作状态 */}
                        {robot.status !== 'working' && (
                          <div className="text-xs text-gray-400 mt-2 text-center">
                            {!isDccBound ? '请先绑定DCC账号' : 
                             robot.id === 'task' ? '点击创建任务' :
                             robot.id === 'script' ? '点击生成话术' :
                             robot.id === 'calling' ? '点击查看外呼任务' :
                             robot.id === 'followup' ? '点击查看跟进记录' : '等待外呼活动开始'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 悬停效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 to-purple-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    
                    {/* 点击波纹效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-active:bg-blue-500/20 transition-all duration-150"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* 电话拨打记录侧拉抽屉 */}
      <CallRecordDrawer
        isOpen={showCallRecordDrawer}
        onClose={() => setShowCallRecordDrawer(false)}
        records={callRecords}
        currentTasks={callTasks}
      />

      {/* DCC绑定弹窗 */}
      <DccBindModal
        isOpen={showDccBindModal}
        onClose={() => setShowDccBindModal(false)}
        onBindSuccess={() => setIsDccBound(true)}
      />

      {/* 任务列表抽屉 */}
      <TaskListDrawer
        isOpen={showTaskListDrawer}
        onClose={() => setShowTaskListDrawer(false)}
        tasks={tasks}
        onViewTaskDetails={handleViewTaskDetails}
      />

      {/* 任务选择抽屉 */}
      <TaskSelectionDrawer
        isOpen={showTaskSelectionDrawer}
        onClose={() => setShowTaskSelectionDrawer(false)}
        onTaskSelect={(task) => {
          setSelectedTaskForScript(task);
          setShowTaskSelectionDrawer(false);
          setShowTaskDetailDrawer(true);
        }}
        tasks={tasks}
      />

      {/* 任务详情抽屉 */}
      <TaskDetailDrawer
        isOpen={showTaskDetailDrawer}
        onClose={() => setShowTaskDetailDrawer(false)}
        selectedTask={selectedTaskForScript}
        onConfigureScript={(task) => {
          setShowTaskDetailDrawer(false);
          setShowScriptGenerationDrawer(true);
        }}
        onStartCalling={(task) => {
          // 处理开始外呼逻辑
          console.log('开始外呼任务:', task);
        }}
        onOutboundCallSuccess={handleOutboundCallSuccess}
      />

      {/* 话术生成抽屉 */}
      <ScriptGenerationDrawer
        isOpen={showScriptGenerationDrawer}
        onClose={() => setShowScriptGenerationDrawer(false)}
        selectedTask={selectedTaskForScript}
        onBackToTaskDetail={() => {
          setShowScriptGenerationDrawer(false);
          setShowTaskDetailDrawer(true);
        }}
      />

      {/* 任务线索抽屉 */}
      <TaskLeadsDrawer
        isOpen={showTaskLeadsDrawer}
        onClose={() => setShowTaskLeadsDrawer(false)}
        taskInfo={taskLeadsData?.task_info}
        taskLeads={taskLeadsData?.task_details || []}
        onRefresh={() => {
          if (taskLeadsData?.task_info?.id) {
            handleRefreshTaskDetails(taskLeadsData.task_info.id.toString());
          }
        }}
      />

      {/* 任务创建抽屉 */}
      <TaskCreationDrawer
        isOpen={showTaskCreationDrawer}
        onClose={() => setShowTaskCreationDrawer(false)}
        onTaskCreated={(taskData) => {
          console.log('任务创建成功:', taskData);
          setShowTaskCreationDrawer(false);
          // 可以在这里添加任务创建成功后的处理逻辑
        }}
      />

      {/* 外呼监控抽屉 */}
      <MonitorDrawer
        isOpen={showMonitorDrawer}
        onClose={() => setShowMonitorDrawer(false)}
        callingTasks={tasks}

        onTasksUpdate={(updatedTasks) => {
          // 更新tasks状态
          setTasks(prevTasks => {
            const newTasks = [...prevTasks];
            updatedTasks.forEach(updatedTask => {
              const index = newTasks.findIndex(task => task.id === updatedTask.id);
              if (index !== -1) {
                newTasks[index] = updatedTask;
              }
            });
            return newTasks;
          });
          

        }}
        onRefreshTaskDetails={handleRefreshTaskDetails}
      />

      {/* 跟进记录弹窗 */}
      <FollowupModal
        isOpen={showFollowupModal}
        onClose={() => setShowFollowupModal(false)}
        selectedTaskId={selectedTaskForFollowup?.id}
      />

      {/* 任务选择模态框 */}
      <TaskSelectionModal
        isOpen={showTaskSelectionModal}
        onClose={() => setShowTaskSelectionModal(false)}
        onTaskSelect={handleTaskSelectForFollowup}
      />
    </div>
  );
} 