'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  @keyframes progress-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .robot-working {
    animation: robot-pulse 2s ease-in-out infinite;
  }

  .robot-glow {
    animation: robot-glow 3s ease-in-out infinite;
  }

  .progress-shimmer {
    animation: progress-shimmer 2s linear infinite;
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

  // 机器人数据
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
      name: '跟进记录Agent',
      description: '查看外呼任务完成情况和跟进记录',
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
  const [callingProgress, setCallingProgress] = useState(0);
  const [callTasks, setCallTasks] = useState<CallTask[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [hasStartedCalling, setHasStartedCalling] = useState(false);
  const [showDccBindModal, setShowDccBindModal] = useState(false);
  const [isDccBound, setIsDccBound] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTaskForScript, setSelectedTaskForScript] = useState<any>(null);
  const [showMonitorDrawer, setShowMonitorDrawer] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedTaskForFollowup, setSelectedTaskForFollowup] = useState<any>(null);
  const [showTaskSelectionModal, setShowTaskSelectionModal] = useState(false);

  // 初始化质检数据
  useEffect(() => {
    // 默认状态下不展示质检和报告数据，只有在实际工作后才会生成数据
    // 只保留外呼记录用于展示
    const mockCallRecords: CallRecord[] = [
      {
        id: 'call-1',
        leadName: '张三',
        phone: '138****1234',
        callTime: '2024-01-25 14:30:25',
        duration: '2分45秒',
        status: 'success',
        result: '客户表示感兴趣，需要进一步跟进',
        notes: '客户对产品有疑问，需要发送详细资料'
      },
      {
        id: 'call-2',
        leadName: '李四',
        phone: '139****5678',
        callTime: '2024-01-25 15:20:10',
        duration: '1分30秒',
        status: 'no-answer',
        result: '无人接听',
        notes: '建议稍后重试'
      }
    ];
    setCallRecords(mockCallRecords);
  }, []);

  // 定期检查任务完成状态
  useEffect(() => {
    const checkTaskCompletionInterval = setInterval(() => {
      // 使用setTimeout避免在渲染过程中直接调用setState
      setTimeout(async () => {
        try {
          const response = await tasksAPI.getCallTasksList();
          if (response.status === 'success') {
            const apiTasks = response.data.tasks || [];
            for (const task of apiTasks) {
              if (task.task_type === 2) { // 只检查正在外呼的任务
                await checkTaskCompletion(task.id, task.task_type);
              }
            }
          }
        } catch (error) {
          console.error('定期检查任务完成状态失败:', error);
        }
      }, 0);
    }, 30000); // 每30秒检查一次

    return () => clearInterval(checkTaskCompletionInterval);
  }, []);

  // 获取任务统计数据
  useEffect(() => {
    const fetchTaskStatistics = async () => {
      if (!isDccBound) return;
      
      try {
        const response = await tasksAPI.getCallTasksStatistics();
        if (response.status === 'success') {
          const stats = response.data;
          
          // 使用setTimeout避免在渲染过程中直接调用setState
          setTimeout(() => {
            setRobots(prev => prev.map(robot => {
              switch (robot.id) {
                case 'task':
                  return {
                    ...robot,
                    stats: {
                      total: stats.task_agent.total,
                      completed: stats.task_agent.created,
                      current: stats.task_agent.total - stats.task_agent.created
                    }
                  };
                case 'script':
                  return {
                    ...robot,
                    stats: {
                      total: stats.script_agent.total,
                      completed: stats.script_agent.created,
                      current: stats.script_agent.total - stats.script_agent.created
                    }
                  };
                case 'calling':
                  return {
                    ...robot,
                    stats: {
                      total: stats.calling_agent.executing_tasks,
                      completed: 0,
                      current: stats.calling_agent.pending_calls
                    },
                    // 根据是否有执行中的任务来决定工作状态
                    status: stats.calling_agent.executing_tasks > 0 ? 'working' : 'idle'
                  };
                case 'followup':
                  return {
                    ...robot,
                    stats: {
                      total: stats.followup_agent.completed_tasks,
                      completed: stats.followup_agent.completed_calls,
                      current: 0
                    },
                    // 跟进记录Agent与外呼Agent保持一致的工作状态
                    status: stats.calling_agent.executing_tasks > 0 ? 'working' : 'idle'
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
    
    // 页面加载时立即检查一次token
    const checkTokenOnLoad = async () => {
      try {
        const isValid = await checkTokenValidity();
        if (!isValid) {
          console.log('页面加载时token验证失败');
          return;
        }
        console.log('页面加载时token验证成功');
      } catch (error) {
        console.error('页面加载时token验证出错:', error);
      }
    };
    
    checkTokenOnLoad();
    
    return cleanup;
  }, []);

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

  // 模拟机器人工作状态 - 对外呼Agent和跟进记录Agent
  useEffect(() => {
    const interval = setInterval(() => {
      setRobots(prev => prev.map(robot => {
        // 外呼Agent和跟进记录Agent在开始外呼后才会随机工作
        if ((robot.id === 'calling' || robot.id === 'followup') && hasStartedCalling && Math.random() < 0.05) {
          const newStatus = robot.status === 'idle' ? 'working' : 'idle';
          const newProgress = newStatus === 'working' ? Math.floor(Math.random() * 100) : 0;
          const newStats = {
            total: Math.floor(Math.random() * 1000),
            completed: Math.floor(Math.random() * 800),
            current: newStatus === 'working' ? Math.floor(Math.random() * 50) : 0
          };
          
          return {
            ...robot,
            status: newStatus,
            progress: newProgress,
            stats: newStats
          };
        }
        return robot;
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [hasStartedCalling]);

  // 处理发起外呼
  const handleStartCalling = (leads: LeadItem[]) => {
    // 设置已开始外呼状态
    setHasStartedCalling(true);
    
    // 启动外呼机器人
    setRobots(prev => prev.map(robot => 
      robot.id === 'calling' 
        ? { ...robot, status: 'working', progress: 0 }
        : robot
    ));
    
    // 重置外呼进度
    setCallingProgress(0);

    // 创建外呼任务
    const tasks: CallTask[] = leads.map((lead, index) => ({
      id: `task-${Date.now()}-${index}`,
      leadName: lead.name,
      phone: lead.phone,
      status: 'pending' as const,
      progress: 0
    }));

    setCallTasks(tasks);

    // 模拟外呼过程
    let currentTaskIndex = 0;
    const simulateCalling = () => {
      if (currentTaskIndex < tasks.length) {
        // 更新当前任务状态
        setCallTasks(prev => prev.map((task, index) => 
          index === currentTaskIndex 
            ? { ...task, status: 'calling', progress: 0 }
            : task
        ));

        // 模拟通话进度
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15 + 5; // 5-20% 随机进度
          
          // 更新外呼机器人进度
          const totalProgress = ((currentTaskIndex + 1) / tasks.length) * 100;
          setCallingProgress(totalProgress);
          
          if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
            
            // 完成当前任务
            setCallTasks(prev => prev.map((task, index) => 
              index === currentTaskIndex 
                ? { ...task, status: 'completed', progress: 100 }
                : task
            ));

            // 添加通话记录
            const currentTask = tasks[currentTaskIndex];
            const isSuccess = Math.random() > 0.3;
            const record: CallRecord = {
              id: `record-${Date.now()}-${currentTaskIndex}`,
              leadName: currentTask.leadName,
              phone: currentTask.phone,
              callTime: new Date().toLocaleString(),
              duration: `${Math.floor(Math.random() * 5) + 1}分${Math.floor(Math.random() * 60)}秒`,
              status: isSuccess ? 'success' : 'no-answer',
              result: isSuccess ? '客户表示感兴趣，需要进一步跟进' : '无人接听',
              notes: isSuccess ? '客户对产品有疑问，需要发送详细资料' : undefined
            };

            setCallRecords(prev => [...prev, record]);

            // 如果通话成功，启动跟进记录Agent
            if (isSuccess) {
              setRobots(prev => prev.map(robot => 
                robot.id === 'followup' 
                  ? { ...robot, status: 'working', progress: 0 }
                  : robot
              ));
              
              // 模拟跟进记录进度
              setTimeout(() => {
                setRobots(prev => prev.map(robot => 
                  robot.id === 'followup' 
                    ? { ...robot, status: 'idle', progress: 0 }
                    : robot
                ));
              }, 2000);
            }

            // 移动到下一个任务
            currentTaskIndex++;
            if (currentTaskIndex < tasks.length) {
              setTimeout(simulateCalling, 1000);
            } else {
              // 所有任务完成，将外呼机器人设置为空闲状态，启动跟进记录Agent
              setTimeout(() => {
                setRobots(prev => prev.map(robot => {
                  if (robot.id === 'calling') {
                    return { ...robot, status: 'idle', progress: 0 };
                  }
                  if (robot.id === 'followup') {
                    return { ...robot, status: 'working', progress: 0 };
                  }
                  return robot;
                }));

                // 模拟跟进记录Agent进度
                let followupProgress = 0;
                
                const followupInterval = setInterval(() => {
                  followupProgress += 6;
                  setRobots(prev => prev.map(robot => 
                    robot.id === 'followup' 
                      ? { ...robot, progress: Math.min(followupProgress, 100) }
                      : robot
                  ));

                  if (followupProgress >= 100) {
                    clearInterval(followupInterval);
                    setRobots(prev => prev.map(robot => 
                      robot.id === 'followup' 
                        ? { ...robot, status: 'idle', progress: 0 }
                        : robot
                    ));
                  }
                }, 600);
              }, 2000);
            }
          } else {
            setCallTasks(prev => prev.map((task, index) => 
              index === currentTaskIndex 
                ? { ...task, progress }
                : task
            ));
          }
        }, 200);

        // 更新外呼机器人总进度
        const totalProgress = ((currentTaskIndex + 1) / tasks.length) * 100;
        setCallingProgress(totalProgress);
      }
    };

    // 开始第一个任务
    setTimeout(simulateCalling, 1000);
  };

  // 处理任务详情查看
  const handleViewTaskDetails = (taskDetails: any) => {
    setTaskLeadsData(taskDetails);
    setShowTaskLeadsDrawer(true);
  };

  // 处理外呼成功回调
  const handleOutboundCallSuccess = async () => {
    // 启动外呼Agent工作状态
    setHasStartedCalling(true);
    setRobots(prev => prev.map(robot => 
      robot.id === 'calling' 
        ? { ...robot, status: 'working', progress: 0 }
        : robot
    ));
    
    // 刷新任务列表
    try {
      const response = await tasksAPI.getCallTasksList();
      if (response.status === 'success') {
        const apiTasks = response.data.tasks || [];
        // 只显示已开始外呼的任务
        const convertedTasks = apiTasks
          .filter((apiTask: any) => apiTask.task_type === 2) // 只显示已开始外呼的任务
          .map((apiTask: any) => ({
            id: apiTask.id.toString(),
            name: apiTask.task_name,
            createdAt: new Date(apiTask.create_time).toLocaleString(),
            conditions: [],
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

        // 自动检查任务完成状态
        for (const task of apiTasks) {
          if (task.task_type === 2) { // 只检查正在外呼的任务
            await checkTaskCompletion(task.id, task.task_type);
          }
        }
      }
    } catch (error) {
      console.error('刷新任务列表失败:', error);
    }
  };

  // 检查任务完成状态
  const checkTaskCompletion = async (taskId: number, taskType: number) => {
    try {
      const response = await tasksAPI.checkTaskCompletion(taskId, taskType);
      if (response.status === 'success') {
        const data = response.data;
        if (data.is_completed) {
          console.log(`任务 ${taskId} 已完成，所有通话都已接通`);
          // 可以在这里添加任务完成的通知逻辑
        }
      }
    } catch (error) {
      console.error('检查任务完成状态失败:', error);
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
        // 调用任务列表API
        const response = await tasksAPI.getCallTasksList();
        if (response.status === 'success') {
          // 转换API数据格式为本地格式，只显示未开始外呼的任务
          const apiTasks = response.data.tasks || [];
          const convertedTasks = apiTasks
            .filter((apiTask: any) => apiTask.task_type !== 2) // 过滤掉已开始外呼的任务
            .map((apiTask: any) => ({
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
          console.error('获取任务列表失败:', response.message);
          alert('获取任务列表失败，请重试');
        }
      } catch (error) {
        console.error('获取任务列表失败:', error);
        alert('获取任务列表失败，请重试');
      }
      return;
    }
    
    // 外呼Agent
    if (robotId === 'calling') {
      try {
        console.log('外呼Agent clicked, 开始获取任务列表...');
        // 刷新任务列表以获取最新状态
        const response = await tasksAPI.getCallTasksList();
        if (response.status === 'success') {
          const apiTasks = response.data.tasks || [];
          // 只显示已开始外呼的任务
          const convertedTasks = apiTasks
            .filter((apiTask: any) => apiTask.task_type === 2) // 只显示已开始外呼的任务
            .map((apiTask: any) => ({
              id: apiTask.id.toString(),
              name: apiTask.task_name,
              createdAt: new Date(apiTask.create_time).toLocaleString(),
              conditions: [],
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
          
          // 检查是否有开始外呼的任务
          console.log('找到外呼任务:', convertedTasks.length, convertedTasks);
          
          if (convertedTasks.length > 0) {
            // 显示外呼Agent监控界面
            console.log('显示外呼Agent监控界面');
            setShowMonitorDrawer(true);
            // 启动外呼Agent工作状态
            setHasStartedCalling(true);
            setRobots(prev => prev.map(robot => 
              robot.id === 'calling' 
                ? { ...robot, status: 'working', progress: 0 }
                : robot
            ));
          } else {
            alert('请先开始外呼活动');
          }
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
    
    // 跟进记录Agent
    if (robotId === 'followup') {
      try {
        // 获取任务列表，让用户选择
        const response = await tasksAPI.getCallTasksList();
        if (response.status === 'success') {
          const apiTasks = response.data.tasks || [];
          // 只显示开始外呼(task_type=2)和外呼完成(task_type=3)的任务
          const filteredTasks = apiTasks.filter((task: any) => task.task_type === 2 || task.task_type === 3);
          if (filteredTasks.length === 0) {
            alert('暂无外呼任务，请先开始外呼活动');
            return;
          }
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
    switch (status) {
      case 'working':
        return '工作中';
      case 'error':
        return '异常';
      default:
        return '空闲';
    }
  };

  // 测试token校验功能
  const handleTestTokenValidation = async () => {
    try {
      const isValid = await checkTokenValidity();
      if (isValid) {
        alert('Token验证成功！');
      } else {
        alert('Token验证失败，将跳转到登录页面');
      }
    } catch (error) {
      console.error('Token验证测试失败:', error);
      alert('Token验证测试失败');
    }
  };

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
              <div className="flex space-x-2">
                {/* Token校验测试按钮 */}
                <button
                  onClick={handleTestTokenValidation}
                  className="px-3 py-1.5 rounded-lg font-medium transition-all duration-200 text-sm bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/30"
                >
                  测试Token校验
                </button>
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
                    {/* 工作状态指示器 - 对外呼Agent和跟进记录Agent显示 */}
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
                        {/* 工作时的旋转光环 - 对外呼Agent和跟进记录Agent显示 */}
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
                        
                        {/* 状态指示器 - 对外呼Agent和跟进记录Agent显示 */}
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

                        {/* 进度条 - 对外呼Agent和跟进记录Agent显示 */}
                        {(robot.id === 'calling' || robot.id === 'followup') && robot.status === 'working' && (
                          <div className="mb-3">
                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500 relative"
                                style={{ 
                                  width: `${robot.id === 'calling' ? callingProgress : 
                                          robot.id === 'followup' ? robot.progress : robot.progress}%` 
                                }}
                              >
                                {/* 进度条动画效果 */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent progress-shimmer"></div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {robot.id === 'calling' ? callingProgress : robot.progress}%
                            </div>
                            {/* 点击提示 */}
                            <div className="text-xs text-blue-400 mt-1 text-center">
                              点击查看详细工作情况
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 统计信息区域 - 为所有Agent提供统一的空间 */}
                      <div className="mt-auto">
                        {/* 统计信息 - 对外呼Agent、跟进记录Agent和话术生成Agent显示 */}
                        {(robot.id === 'calling' || robot.id === 'followup' || robot.id === 'script') && (
                          <div className="grid grid-cols-3 gap-2 text-center mb-3">
                            {robot.id === 'calling' && (
                              <>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                                  <div className="text-gray-400 text-xs">执行中</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                                  <div className="text-gray-400 text-xs">已完成</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                                  <div className="text-gray-400 text-xs">待拨打</div>
                                </div>
                              </>
                            )}
                            {robot.id === 'followup' && (
                              <>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                                  <div className="text-gray-400 text-xs">外呼任务</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                                  <div className="text-gray-400 text-xs">已完成</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                                  <div className="text-gray-400 text-xs">进行中</div>
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
                             robot.id === 'followup' ? '点击选择外呼任务查看跟进记录' : '等待外呼活动开始'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 悬停效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 to-purple-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    
                    {/* 点击波纹效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-active:bg-blue-500/20 transition-all duration-150"></div>
                  </div>

                  {/* 外呼Agent的任务列表 - 只在非工作时显示 */}
                  {robot.id === 'calling' && callTasks.length > 0 && robot.status !== 'working' && (
                    <div className="mt-3 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-1.5 animate-pulse"></div>
                          <span className="text-blue-300 font-medium text-xs">外呼任务</span>
                        </div>
                        <span className="text-blue-400 text-xs font-bold">{callTasks.length} 个任务</span>
                      </div>
                      <div className="space-y-1.5">
                        {callTasks.slice(0, 2).map((task) => (
                          <div key={task.id} className="bg-white/5 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-xs font-medium">{task.leadName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                task.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                task.status === 'calling' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {task.status === 'completed' ? '已完成' :
                                 task.status === 'calling' ? '通话中' : '等待中'}
                              </span>
                            </div>
                            <div className="text-gray-400 text-xs">{task.phone}</div>
                            {task.status === 'calling' && (
                              <div className="mt-1">
                                <div className="w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                    style={{ width: `${task.progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {callTasks.length > 2 && (
                          <div className="text-gray-400 text-xs">
                            还有 {callTasks.length - 2} 个任务...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
        callingTasks={tasks.filter(task => task.task_type === 2)}
        callProgress={callingProgress}
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