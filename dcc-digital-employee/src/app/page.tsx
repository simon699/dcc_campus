'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import MonitorDrawer from '../components/MonitorDrawer';
import CallRecordDrawer from '../components/CallRecordDrawer';
import QualityDrawer from '../components/QualityDrawer';
import ReportDrawer from '../components/ReportDrawer';
import DccBindModal from '../components/DccBindModal';

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
  alerts?: AlertItem[];
  isExpanded?: boolean;
}

interface AlertItem {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'info' | 'error';
  leads?: LeadItem[];
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

interface QualityItem {
  id: string;
  leadName: string;
  phone: string;
  callTime: string;
  duration: string;
  qualityScore: number;
  analysisResult: string;
  suggestions: string[];
  status: 'analyzing' | 'completed' | 'failed';
  progress: number;
}

interface ReportItem {
  id: string;
  title: string;
  type: 'summary' | 'analysis' | 'trend' | 'comparison';
  content: string;
  data?: {
    label: string;
    value: string | number;
    change?: string;
  }[];
  charts?: {
    type: 'line' | 'bar' | 'pie';
    data: any[];
  }[];
  status: 'generating' | 'completed' | 'failed';
  progress: number;
  generateTime: string;
}

export default function Home() {
  const router = useRouter();

  // 机器人数据
  const [robots, setRobots] = useState<RobotCard[]>([
    {
      id: 'monitor',
      name: '数据监控机器人',
      description: '实时监控业务数据，预警异常情况',
      icon: '📈',
      status: 'working',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 },
      alerts: [
        {
          id: '1',
          title: '存在长时间未跟进的线索',
          description: '发现3条超过7天未跟进的线索，建议发起智能外呼，进行跟进',
          type: 'warning',
          leads: [
            { id: '1', name: '张三', phone: '138****1234', customerLevel: 'A级', lastFollowUp: '2024-01-15', nextFollowUp: '2024-01-20', notes: '客户对产品很感兴趣，需要重点跟进', priority: 'high' },
            { id: '2', name: '李四', phone: '139****5678', customerLevel: 'B级', lastFollowUp: '2024-01-10', nextFollowUp: '2024-01-18', notes: '客户表示考虑中，需要定期联系', priority: 'medium' },
            { id: '3', name: '王五', phone: '137****9012', customerLevel: 'A级', lastFollowUp: '2024-01-08', nextFollowUp: '2024-01-16', notes: '高价值客户，有强烈购买意向', priority: 'high' }
          ]
        },
        {
          id: '2',
          title: '存在可转化的线索',
          description: '发现2条高价值转化线索，可发起智能外呼，进行跟进',
          type: 'info',
          leads: [
            { id: '4', name: '赵六', phone: '136****3456', customerLevel: 'A级', lastFollowUp: '2024-01-20', nextFollowUp: '2024-01-25', notes: '客户对价格敏感，需要提供优惠方案', priority: 'high' },
            { id: '5', name: '钱七', phone: '135****7890', customerLevel: 'S级', lastFollowUp: '2024-01-19', nextFollowUp: '2024-01-22', notes: 'VIP客户，需要优先处理', priority: 'high' }
          ]
        }
      ]
    },
    {
      id: 'calling',
      name: '智能外呼机器人',
      description: '自动外呼客户，智能语音交互',
      icon: '📞',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    },
    {
      id: 'quality',
      name: '智能质检机器人',
      description: '自动质检通话质量，提升服务质量',
      icon: '🔍',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    },
    {
      id: 'report',
      name: '数据报告机器人',
      description: '自动生成业务报告，数据可视化展示',
      icon: '📋',
      status: 'idle',
      progress: 0,
      stats: { total: 0, completed: 0, current: 0 }
    }
  ]);

  const [selectedRobot, setSelectedRobot] = useState<string | null>(null);
  const [showMonitorDrawer, setShowMonitorDrawer] = useState(false);
  const [showCallRecordDrawer, setShowCallRecordDrawer] = useState(false);
  const [showQualityDrawer, setShowQualityDrawer] = useState(false);
  const [showReportDrawer, setShowReportDrawer] = useState(false);
  const [callingProgress, setCallingProgress] = useState(0);
  const [qualityProgress, setQualityProgress] = useState(0);
  const [reportProgress, setReportProgress] = useState(0);
  const [callTasks, setCallTasks] = useState<CallTask[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [qualityItems, setQualityItems] = useState<QualityItem[]>([]);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [hasStartedCalling, setHasStartedCalling] = useState(false);
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [showAlertDetail, setShowAlertDetail] = useState(false);
  const [showDccBindModal, setShowDccBindModal] = useState(false);

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
        callTime: '2024-01-25 15:15:10',
        duration: '1分58秒',
        status: 'success',
        result: '客户表示考虑中，需要定期联系',
        notes: '客户对价格敏感，需要提供优惠方案'
      },
      {
        id: 'call-3',
        leadName: '王五',
        phone: '137****9012',
        callTime: '2024-01-25 16:05:33',
        duration: '3分12秒',
        status: 'success',
        result: '高价值客户，有强烈购买意向',
        notes: 'VIP客户，需要优先处理'
      }
    ];

    setCallRecords(mockCallRecords);
  }, []);

  useEffect(() => {
    console.log("Home page mounted");
  }, []);

  // 检查是否需要绑定DCC账号
  useEffect(() => {
    const needBindDcc = sessionStorage.getItem('needBindDcc');
    if (needBindDcc === 'true') {
      setShowDccBindModal(true);
      sessionStorage.removeItem('needBindDcc'); // 清除标记，避免重复显示
    }
  }, []);

  // 模拟机器人工作状态
  useEffect(() => {
    const interval = setInterval(() => {
      setRobots(prev => prev.map(robot => {
        // 监控机器人根据开关状态工作
        if (robot.id === 'monitor') {
          if (monitorEnabled) {
            // 开关打开时，监控机器人一直处于工作中
            const newProgress = Math.floor(Math.random() * 100);
            const newStats = {
              total: Math.floor(Math.random() * 1000),
              completed: Math.floor(Math.random() * 800),
              current: Math.floor(Math.random() * 50)
            };
            
            return {
              ...robot,
              status: 'working',
              progress: newProgress,
              stats: newStats
            };
          } else {
            // 开关关闭时，监控机器人处于空闲状态
            return {
              ...robot,
              status: 'idle',
              progress: 0,
              stats: { total: 0, completed: 0, current: 0 }
            };
          }
        }
        // 其他机器人只有在开始外呼后才会随机工作
        if (robot.id !== 'monitor' && hasStartedCalling && Math.random() < 0.05) {
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
  }, [hasStartedCalling, monitorEnabled]);


  // 处理发起外呼
  const handleStartCalling = (leads: LeadItem[]) => {
    // 设置已开始外呼状态
    setHasStartedCalling(true);
    
    // 清除监控预警，表示已处理，但保持监控机器人处于工作状态
    setRobots(prev => prev.map(robot => 
      robot.id === 'monitor' 
        ? { ...robot, alerts: [], status: 'working' }
        : robot
    ));

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
            const record: CallRecord = {
              id: `record-${Date.now()}-${currentTaskIndex}`,
              leadName: currentTask.leadName,
              phone: currentTask.phone,
              callTime: new Date().toLocaleString(),
              duration: `${Math.floor(Math.random() * 5) + 1}分${Math.floor(Math.random() * 60)}秒`,
              status: Math.random() > 0.3 ? 'success' : 'no-answer',
              result: Math.random() > 0.3 ? '客户表示感兴趣，需要进一步跟进' : '无人接听',
              notes: Math.random() > 0.5 ? '客户对产品有疑问，需要发送详细资料' : undefined
            };

            setCallRecords(prev => [...prev, record]);

            // 移动到下一个任务
            currentTaskIndex++;
            if (currentTaskIndex < tasks.length) {
              setTimeout(simulateCalling, 1000);
            } else {
              // 所有任务完成，将外呼机器人设置为空闲状态，启动质检和报告机器人
              setTimeout(() => {
                setRobots(prev => prev.map(robot => {
                  if (robot.id === 'calling') {
                    return { ...robot, status: 'idle', progress: 0 };
                  }
                  if (robot.id === 'quality') {
                    return { ...robot, status: 'working', progress: 0 };
                  }
                  if (robot.id === 'report') {
                    return { ...robot, status: 'working', progress: 0 };
                  }
                  return robot;
                }));

                // 生成质检项目 - 基于实际通话记录
                const qualityItems: QualityItem[] = callRecords.map((record, index) => ({
                  id: `quality-${Date.now()}-${index}`,
                  leadName: record.leadName,
                  phone: record.phone,
                  callTime: record.callTime,
                  duration: record.duration,
                  qualityScore: Math.floor(Math.random() * 30) + 70, // 70-100分
                  analysisResult: '质检分析中...',
                  suggestions: [],
                  status: 'analyzing' as const,
                  progress: 0
                }));

                setQualityItems(qualityItems);
                console.log('质检项目已生成:', qualityItems.length, '个任务');

                // 生成报告项目
                const reportItems: ReportItem[] = [
                  {
                    id: `report-${Date.now()}-1`,
                    title: '外呼效果分析报告',
                    type: 'analysis',
                    content: '',
                    data: [
                      { label: '总通话数', value: callRecords.length },
                      { label: '接通率', value: `${Math.floor((callRecords.filter(r => r.status === 'success').length / callRecords.length) * 100)}%` },
                      { label: '平均通话时长', value: '2分30秒' },
                      { label: '转化意向', value: '3个客户' }
                    ],
                    status: 'generating' as const,
                    progress: 0,
                    generateTime: new Date().toLocaleString()
                  },
                  {
                    id: `report-${Date.now()}-2`,
                    title: '客户跟进建议报告',
                    type: 'summary',
                    content: '',
                    status: 'generating' as const,
                    progress: 0,
                    generateTime: new Date().toLocaleString()
                  }
                ];

                setReportItems(reportItems);

                // 模拟质检进度
                let qualityProgress = 0;
                const qualityInterval = setInterval(() => {
                  qualityProgress += 10;
                  setQualityProgress(qualityProgress);
                  
                  // 更新质检项目进度
                  setQualityItems(prev => prev.map((item, index) => ({
                    ...item,
                    progress: Math.min(qualityProgress, 100)
                  })));

                  if (qualityProgress >= 100) {
                    clearInterval(qualityInterval);
                    
                    // 完成质检，生成分析结果
                    setQualityItems(prev => prev.map((item, index) => {
                      const isHighScore = item.qualityScore >= 85;
                      const isMediumScore = item.qualityScore >= 75 && item.qualityScore < 85;
                      
                      return {
                        ...item,
                        status: 'completed' as const,
                        analysisResult: isHighScore 
                          ? `通话质量优秀！客户${item.leadName}的质检评分为${item.qualityScore}分。语音清晰度98%，语速适中，专业度评分95分。客户反应积极，对产品表现出浓厚兴趣，建议优先跟进。`
                          : isMediumScore
                          ? `通话质量良好。客户${item.leadName}的质检评分为${item.qualityScore}分。语音清晰度92%，语速适中，专业度评分88分。客户有一定兴趣，建议继续跟进。`
                          : `通话质量一般。客户${item.leadName}的质检评分为${item.qualityScore}分。语音清晰度85%，需要改进语速和专业度。建议重新联系客户。`,
                        suggestions: isHighScore 
                          ? [
                              '客户反应积极，建议尽快安排产品演示',
                              '可以适当增加产品详细介绍时间',
                              '注意记录客户的具体需求和预算'
                            ]
                          : isMediumScore
                          ? [
                              '建议在通话中多了解客户具体需求',
                              '可以适当增加产品优势介绍',
                              '注意记录客户反馈的关键信息'
                            ]
                          : [
                              '建议重新联系客户，改进沟通技巧',
                              '可以适当放慢语速，提高清晰度',
                              '建议增加产品价值说明'
                            ]
                      };
                    }));

                    // 质检完成后，开始生成报告
                    setTimeout(() => {
                      // 模拟报告进度
                      let reportProgress = 0;
                      const reportInterval = setInterval(() => {
                        reportProgress += 8;
                        setReportProgress(reportProgress);
                        
                        // 更新报告项目进度
                        setReportItems(prev => prev.map((item, index) => ({
                          ...item,
                          progress: Math.min(reportProgress, 100)
                        })));

                        if (reportProgress >= 100) {
                          clearInterval(reportInterval);
                          
                          // 完成报告生成 - 基于质检结果
                          setReportItems(prev => prev.map(item => {
                            const completedQualityItems = qualityItems.filter(q => q.status === 'completed');
                            const highScoreCount = completedQualityItems.filter(q => q.qualityScore >= 85).length;
                            const mediumScoreCount = completedQualityItems.filter(q => q.qualityScore >= 75 && q.qualityScore < 85).length;
                            const lowScoreCount = completedQualityItems.filter(q => q.qualityScore < 75).length;
                            
                            return {
                              ...item,
                              status: 'completed' as const,
                              content: item.type === 'analysis' 
                                ? `本次外呼活动共完成${callRecords.length}个客户联系，接通率${Math.floor((callRecords.filter(r => r.status === 'success').length / callRecords.length) * 100)}%，平均通话时长2分30秒。质检结果显示：${highScoreCount}个客户通话质量优秀，${mediumScoreCount}个客户通话质量良好，${lowScoreCount}个客户需要改进。其中${highScoreCount + mediumScoreCount}个客户表现出明显兴趣，建议重点跟进。整体外呼效果良好，达到了预期目标。`
                                : `根据质检结果分析，建议对${completedQualityItems.filter(q => q.qualityScore >= 75).map(q => q.leadName).join('、')}等${completedQualityItems.filter(q => q.qualityScore >= 75).length}位客户进行重点跟进，他们对外呼内容反应积极，质检评分较高，有较强的购买意向。建议在3天内进行二次联系，并针对质检建议改进沟通技巧。`
                            };
                          }));
                        }
                      }, 400);
                    }, 1000); // 质检完成后延迟1秒开始生成报告
                  }
                }, 500);
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

    // 3秒后让监控机器人重新开始监控工作
    setTimeout(() => {
      setRobots(prev => prev.map(robot => 
        robot.id === 'monitor' 
          ? { 
              ...robot, 
              status: 'working',
              alerts: [
                {
                  id: 'new-1',
                  title: '发现新的跟进机会',
                  description: '检测到2条新的高价值线索，建议及时跟进',
                  type: 'info',
                  leads: [
                    { id: 'new-1', name: '赵六', phone: '136****3456', customerLevel: 'A级', lastFollowUp: '2024-01-25', nextFollowUp: '2024-01-26', notes: '新客户，对产品表现出兴趣', priority: 'high' },
                    { id: 'new-2', name: '钱七', phone: '135****7890', customerLevel: 'B级', lastFollowUp: '2024-01-25', nextFollowUp: '2024-01-27', notes: '潜在客户，需要进一步了解需求', priority: 'medium' }
                  ]
                }
              ]
            }
          : robot
      ));
    }, 3000);
  };

  // 处理查看监控详情
  const handleViewMonitorDetails = () => {
    setShowMonitorDrawer(true);
  };

  // 处理机器人点击
  const handleRobotClick = (robotId: string) => {
    setSelectedRobot(robotId);
    
    // 根据机器人类型执行不同操作
    switch (robotId) {
      case 'monitor':
        // 监控机器人开关关闭时不允许点击
        if (!monitorEnabled) {
          alert('请先开启监控功能');
          return;
        }
        // 打开监控抽屉
        handleViewMonitorDetails();
        break;
      case 'quality':
        // 查看质检机器人工作情况
        if (!hasStartedCalling) {
          alert('请先开始外呼活动，质检机器人才能开始工作');
        } else if (qualityItems.length > 0) {
          setShowQualityDrawer(true);
        } else {
          alert('暂无质检记录，请先进行外呼活动');
        }
        break;
      case 'calling':
        // 查看外呼机器人工作情况
        if (!hasStartedCalling) {
          alert('请先开始外呼活动');
        } else if (callRecords.length > 0) {
          setShowCallRecordDrawer(true);
        } else {
          console.log('暂无通话记录');
        }
        break;
      case 'report':
        // 查看报告机器人工作情况
        if (!hasStartedCalling) {
          alert('请先开始外呼活动，报告机器人才能开始工作');
        } else if (reportItems.length > 0) {
          setShowReportDrawer(true);
        } else {
          alert('暂无报告记录，请先进行外呼活动');
        }
        break;
    }
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
                <h1 className="text-2xl font-bold text-white mb-1">机器人工作台</h1>
                <p className="text-gray-300 text-sm">监控和管理您的数字员工团队</p>
              </div>
              <button
                onClick={() => router.push('/manual-analysis')}
                className="px-3 py-1.5 rounded-lg font-medium transition-all duration-200 bg-white/10 text-white hover:bg-white/20 text-sm"
              >
                手动分析
              </button>
            </div>

            {/* 监控开关和预警信息区域 */}
            <div className="mb-4">
              {/* 监控开关 */}
              <div className="flex items-center justify-between mb-3 p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                <div className="flex items-center">
                  <span className="text-white font-medium mr-3 text-sm">实时监控</span>
                  <button
                    onClick={() => {
                      const newMonitorEnabled = !monitorEnabled;
                      setMonitorEnabled(newMonitorEnabled);
                      
                      // 如果开启监控，自动展示监控抽屉
                      if (newMonitorEnabled) {
                        setShowMonitorDrawer(true);
                      }
                    }}
                    className={`
                      relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      ${monitorEnabled 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-gray-600 hover:bg-gray-700'
                      }
                    `}
                  >
                    <span
                      className={`
                        inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                        ${monitorEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                      `}
                    />
                    <span className="sr-only">
                      {monitorEnabled ? '关闭监控' : '开启监控'}
                    </span>
                  </button>
                </div>
                <div className="text-xs text-gray-400">
                  {monitorEnabled ? '监控已开启' : '监控已关闭'}
                </div>
              </div>

              {/* 监控预警信息 */}
              {monitorEnabled && (robots.find(r => r.id === 'monitor')?.alerts || []).length > 0 && (
                <div className="bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-red-300 font-semibold text-base">监控预警</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-red-400 text-xs font-bold mr-2">{(robots.find(r => r.id === 'monitor')?.alerts?.length || 0)} 条预警</span>
                      <button 
                        onClick={() => handleViewMonitorDetails()}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(robots.find(r => r.id === 'monitor')?.alerts || []).slice(0, 6).map((alert) => (
                      <div 
                        key={alert.id} 
                        className="bg-white/5 rounded-lg p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setShowAlertDetail(true);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-1.5 ${
                              alert.type === 'warning' ? 'bg-yellow-400' : 
                              alert.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
                            }`}></div>
                            <span className="text-white font-medium text-xs">{alert.title}</span>
                          </div>
                          <span className="text-gray-400 text-xs">{alert.leads?.length || 0} 个客户</span>
                        </div>
                        <p className="text-gray-300 text-xs line-clamp-2">{alert.description}</p>
                      </div>
                    ))}
                  </div>
                  {(robots.find(r => r.id === 'monitor')?.alerts?.length || 0) > 6 && (
                    <div className="mt-3 text-center">
                      <span className="text-gray-400 text-xs">
                        还有 {(robots.find(r => r.id === 'monitor')?.alerts?.length || 0) - 6} 条预警...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 机器人卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {robots.map((robot) => (
                <div key={robot.id}>
                  {/* 机器人卡片 */}
                  <div
                    onClick={() => handleRobotClick(robot.id)}
                    className={`
                      relative group cursor-pointer transition-all duration-500 transform hover:scale-105
                      bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4
                      hover:bg-white/10 hover:border-white/20 hover:shadow-2xl
                      ${selectedRobot === robot.id ? 'ring-2 ring-blue-500/50' : ''}
                      ${robot.status === 'working' ? 'robot-working' : ''}
                    `}
                  >
                    {/* 工作状态指示器 */}
                    {robot.status === 'working' && robot.id !== 'monitor' && (
                      <div className="absolute top-3 right-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                      </div>
                    )}
                    
                    {/* 监控机器人工作状态指示器 */}
                    {robot.id === 'monitor' && monitorEnabled && robot.status === 'working' && (
                      <div className="absolute top-3 right-3">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                      </div>
                    )}

                    {/* 机器人图标 */}
                    <div className="text-center mb-3">
                      <div className={`
                        relative inline-flex items-center justify-center w-12 h-12 rounded-xl
                        text-2xl mb-2 transition-all duration-300 group-hover:scale-110
                        ${robot.id === 'monitor' && !monitorEnabled
                          ? 'bg-gradient-to-br from-gray-500 to-gray-600'
                          : robot.status === 'working' 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 robot-glow' 
                          : 'bg-gradient-to-br from-gray-600 to-gray-700'
                        }
                      `}>
                        {robot.icon}
                        {/* 工作时的旋转光环 */}
                        {robot.status === 'working' && robot.id !== 'monitor' && (
                          <div className="absolute inset-0 rounded-xl border-2 border-blue-400/50 animate-spin"></div>
                        )}
                        {/* 监控机器人工作时的旋转光环 */}
                        {robot.id === 'monitor' && monitorEnabled && robot.status === 'working' && (
                          <div className="absolute inset-0 rounded-xl border-2 border-blue-400/50 animate-spin"></div>
                        )}
                      </div>
                    </div>

                    {/* 机器人信息 */}
                    <div className="text-center">
                      <h3 className="text-base font-semibold text-white mb-1">{robot.name}</h3>
                      <p className="text-xs text-gray-300 mb-3 line-clamp-2">{robot.description}</p>
                      
                      {/* 状态指示器 */}
                      <div className="flex items-center justify-center mb-3">
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getStatusColor(robot.status)}`}></div>
                        <span className={`text-xs ${getStatusColor(robot.status)}`}>
                          {robot.id === 'monitor' && !monitorEnabled ? '已关闭' : getStatusText(robot.status)}
                        </span>
                      </div>

                      {/* 进度条 - 只有非监控机器人显示 */}
                      {robot.status === 'working' && robot.id !== 'monitor' && (
                        <div className="mb-3">
                          <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500 relative"
                              style={{ 
                                width: `${robot.id === 'calling' ? callingProgress : 
                                        robot.id === 'quality' ? qualityProgress : 
                                        robot.id === 'report' ? reportProgress : robot.progress}%` 
                              }}
                            >
                              {/* 进度条动画效果 */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent progress-shimmer"></div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {robot.id === 'calling' ? callingProgress : 
                             robot.id === 'quality' ? qualityProgress : 
                             robot.id === 'report' ? reportProgress : robot.progress}%
                          </div>
                          {/* 点击提示 */}
                          <div className="text-xs text-blue-400 mt-1 text-center">
                            点击查看详细工作情况
                          </div>
                        </div>
                      )}

                      {/* 统计信息 - 只有非监控机器人显示 */}
                      {robot.id !== 'monitor' && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="text-center">
                            <div className="text-blue-400 font-semibold text-sm">{robot.stats.total}</div>
                            <div className="text-gray-400 text-xs">总数</div>
                          </div>
                          <div className="text-center">
                            <div className="text-green-400 font-semibold text-sm">{robot.stats.completed}</div>
                            <div className="text-gray-400 text-xs">已完成</div>
                          </div>
                          <div className="text-center">
                            <div className="text-blue-400 font-semibold text-sm">{robot.stats.current}</div>
                            <div className="text-gray-400 text-xs">进行中</div>
                          </div>
                        </div>
                      )}

                      {/* 点击提示 - 非工作状态 */}
                      {robot.status !== 'working' && robot.id !== 'monitor' && (
                        <div className="text-xs text-gray-400 mt-2 text-center">
                          {hasStartedCalling ? '点击查看工作情况' : '等待外呼活动开始'}
                        </div>
                      )}
                    </div>

                    {/* 悬停效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 to-purple-500/0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    
                    {/* 点击波纹效果 */}
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-active:bg-blue-500/20 transition-all duration-150"></div>

                    {/* 报告机器人的历史记录按钮 */}
                    {robot.id === 'report' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/report-history');
                        }}
                        className="absolute top-4 right-4 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors shadow-lg hover:shadow-xl z-10"
                      >
                        历史记录
                      </button>
                    )}
                  </div>



                  {/* 外呼机器人的任务列表 - 只在非工作时显示 */}
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

                  {/* 质检机器人的任务列表 - 只在非工作时显示，且有数据时显示 */}
                  {robot.id === 'quality' && qualityItems.length > 0 && robot.status !== 'working' && (
                    <div className="mt-3 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse"></div>
                          <span className="text-green-300 font-medium text-xs">质检任务</span>
                        </div>
                        <span className="text-green-400 text-xs font-bold">{qualityItems.length} 个任务</span>
                      </div>
                      <div className="space-y-1.5">
                        {qualityItems.slice(0, 2).map((item) => (
                          <div key={item.id} className="bg-white/5 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-xs font-medium">{item.leadName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                item.qualityScore >= 85 ? 'bg-green-500/20 text-green-300' :
                                item.qualityScore >= 75 ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {item.qualityScore}分
                              </span>
                            </div>
                            <div className="text-gray-400 text-xs">{item.phone}</div>
                          </div>
                        ))}
                        {qualityItems.length > 2 && (
                          <div className="text-gray-400 text-xs">
                            还有 {qualityItems.length - 2} 个任务...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 报告机器人的任务列表 - 只在非工作时显示，且有数据时显示 */}
                  {robot.id === 'report' && reportItems.length > 0 && robot.status !== 'working' && (
                    <div className="mt-3 bg-purple-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-purple-400 rounded-full mr-1.5 animate-pulse"></div>
                          <span className="text-purple-300 font-medium text-xs">报告任务</span>
                        </div>
                        <span className="text-purple-400 text-xs font-bold">{reportItems.length} 个任务</span>
                      </div>
                      <div className="space-y-1.5">
                        {reportItems.slice(0, 2).map((item) => (
                          <div key={item.id} className="bg-white/5 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-white text-xs font-medium">{item.title}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                item.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                item.status === 'generating' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {item.status === 'completed' ? '已完成' :
                                 item.status === 'generating' ? '生成中' : '失败'}
                              </span>
                            </div>
                            <div className="text-gray-400 text-xs">{item.type}</div>
                          </div>
                        ))}
                        {reportItems.length > 2 && (
                          <div className="text-gray-400 text-xs">
                            还有 {reportItems.length - 2} 个任务...
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

      {/* 监控预警侧拉抽屉 */}
      <MonitorDrawer
        isOpen={showMonitorDrawer}
        onClose={() => setShowMonitorDrawer(false)}
        alerts={robots.find(r => r.id === 'monitor')?.alerts || []}
        onStartCalling={handleStartCalling}
      />

      {/* 电话拨打记录侧拉抽屉 */}
      <CallRecordDrawer
        isOpen={showCallRecordDrawer}
        onClose={() => setShowCallRecordDrawer(false)}
        records={callRecords}
      />

      {/* 智能质检侧拉抽屉 */}
      <QualityDrawer
        isOpen={showQualityDrawer}
        onClose={() => setShowQualityDrawer(false)}
        items={qualityItems}
      />

      {/* 数据报告侧拉抽屉 */}
      <ReportDrawer
        isOpen={showReportDrawer}
        onClose={() => setShowReportDrawer(false)}
        items={reportItems}
      />

      {/* 预警详情侧拉抽屉 */}
      {selectedAlert && (
        <div className={`
          fixed top-0 right-0 h-full w-[600px] bg-white/10 backdrop-blur-xl border-l border-white/20
          transform transition-transform duration-300 ease-in-out z-50
          ${showAlertDetail ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="h-full flex flex-col">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-xl font-semibold text-white">预警详情</h2>
                <p className="text-gray-400 text-sm mt-1">{selectedAlert.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowAlertDetail(false);
                  setSelectedAlert(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 抽屉内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* 预警信息 */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <div className={`w-4 h-4 rounded-full mr-3 ${
                    selectedAlert.type === 'warning' ? 'bg-yellow-400' : 
                    selectedAlert.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
                  }`}></div>
                  <h3 className="text-lg font-semibold text-white">{selectedAlert.title}</h3>
                </div>
                <p className="text-gray-300 mb-4">{selectedAlert.description}</p>
                <div className="flex items-center text-sm text-gray-400">
                  <span>类型：</span>
                  <span className={`ml-2 px-2 py-1 rounded ${
                    selectedAlert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                    selectedAlert.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {selectedAlert.type === 'warning' ? '警告' : 
                     selectedAlert.type === 'error' ? '错误' : '信息'}
                  </span>
                </div>
              </div>

              {/* 批量外呼按钮 - 移到上面 */}
              {selectedAlert.leads && selectedAlert.leads.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={() => handleStartCalling(selectedAlert.leads || [])}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      批量外呼跟进 ({selectedAlert.leads?.length || 0} 个客户)
                    </div>
                  </button>
                </div>
              )}

              {/* 相关客户 */}
              {selectedAlert.leads && selectedAlert.leads.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-4">相关客户 ({selectedAlert.leads.length} 个)</h4>
                  <div className="space-y-4">
                    {selectedAlert.leads.map((lead) => (
                      <div key={lead.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium text-lg">{lead.name}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                lead.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                lead.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-green-500/20 text-green-300'
                              }`}>
                                {lead.priority === 'high' ? '高优先级' : 
                                 lead.priority === 'medium' ? '中优先级' : '低优先级'}
                              </span>
                            </div>
                            <div className="text-gray-300 text-sm mb-3">
                              <div className="flex items-center mb-1">
                                <span className="text-gray-400 w-16">手机号:</span>
                                <span>{lead.phone}</span>
                              </div>
                              <div className="flex items-center mb-1">
                                <span className="text-gray-400 w-16">客户等级:</span>
                                <span className="text-blue-300">{lead.customerLevel}</span>
                              </div>
                              <div className="flex items-center mb-1">
                                <span className="text-gray-400 w-16">最近跟进:</span>
                                <span>{lead.lastFollowUp}</span>
                              </div>
                              <div className="flex items-center mb-1">
                                <span className="text-gray-400 w-16">下次跟进:</span>
                                <span className="text-yellow-300">{lead.nextFollowUp}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-gray-400 w-16 mt-1">备注:</span>
                                <span className="text-gray-300 flex-1">{lead.notes}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleStartCalling([lead])}
                            className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex-shrink-0"
                          >
                            发起外呼
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 移除固定在底部的批量外呼按钮 */}
          </div>
        </div>
      )}

      {/* 遮罩层 */}
      {showAlertDetail && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => {
            setShowAlertDetail(false);
            setSelectedAlert(null);
          }}
        />
      )}

      {/* DCC绑定弹窗 */}
      <DccBindModal
        isOpen={showDccBindModal}
        onClose={() => setShowDccBindModal(false)}
      />
    </div>
  );
} 