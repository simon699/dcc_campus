import { StepType, Step } from './WorkflowSteps';

// 步骤配置
export const createSteps = (): Step[] => [
  {
    id: 'initiate',
    title: '发起计划',
    description: '配置任务或选择智能分析',
    icon: '📋',
    status: 'active'
  },
  {
    id: 'analyze',
    title: '分析数据',
    description: 'AI智能分析客户数据',
    icon: '🔍',
    status: 'pending'
  },
  {
    id: 'call',
    title: '智能外呼',
    description: '机器人自动拨打电话',
    icon: '📞',
    status: 'pending'
  },
  {
    id: 'report',
    title: '数据分析',
    description: '分析外呼结果和效果',
    icon: '📊',
    status: 'pending'
  }
];

// 获取当前步骤状态
export const getStepStatus = (stepId: StepType, currentStep: StepType, steps: Step[]): 'pending' | 'active' | 'completed' | 'error' => {
  const stepIndex = steps.findIndex(s => s.id === stepId);
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  if (stepId === currentStep) return 'active';
  if (stepIndex < currentIndex) return 'completed';
  return 'pending';
};

// 计算匹配的线索数量
export const calculateMatchedCount = (conditions: any[]): number => {
  if (conditions.length === 0) return 1250; // 默认总线索数
  
  let baseCount = 1250;
  let multiplier = 1;
  
  conditions.forEach(condition => {
    // 根据不同的筛选条件调整数量
    switch (condition.id) {
      case 'followTime':
        multiplier *= 0.6; // 时间筛选通常减少60%的数据
        break;
      case 'nextFollowTime':
        multiplier *= 0.4; // 下次跟进时间筛选更严格
        break;
      case 'customerLevel':
        multiplier *= 0.7; // 客户等级筛选
        break;
      case 'source':
        multiplier *= 0.8; // 来源筛选
        break;
      case 'keywords':
        multiplier *= 0.5; // 关键词筛选
        break;
    }
  });
  
  return Math.floor(baseCount * multiplier);
};

// 异步计算匹配的线索数量（调用真实API）
export const calculateMatchedCountAsync = async (conditions: any[]): Promise<number> => {
  try {
    // 构建API请求参数
    const requestParams: any = {
      page: 1,
      page_size: 1 // 只需要获取总数，不需要实际数据
    };
    
    // 处理筛选条件
    conditions.forEach(condition => {
      if (condition.type === 'multiSelect') {
        const values = Array.isArray(condition.value) ? condition.value : [];
        const customValue = condition.customValue || '';
        
        if (values.length > 0 || customValue.trim() !== '') {
          switch (condition.id) {
            case 'followTime':
              // 处理最近跟进时间
              if (customValue.trim()) {
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
              } else if (values.length > 0) {
                const today = new Date();
                values.forEach((value: string) => {
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
              }
              break;
              
            case 'nextFollowTime':
              // 处理下次跟进时间
              if (customValue.trim()) {
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
              } else if (values.length > 0) {
                const today = new Date();
                values.forEach((value: string) => {
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
                
                const levelValues = values.map((v: string) => levelMap[v]).filter((v: number | undefined) => v !== undefined);
                if (levelValues.length > 0) {
                  requestParams.client_level = levelValues;
                }
              }
              break;
              
            case 'source':
              // 处理线索来源
              if (values.length > 0) {
                requestParams.product = values.join(' ');
              }
              break;
          }
        }
      } else if (condition.value && condition.value !== '') {
        // 关键词筛选
        requestParams.phone = condition.value;
      }
    });
    
    // 调用API
    const token = localStorage.getItem('access_token');
    if (!token) {
      // 如果没有令牌，直接使用虚拟计算
      console.log('未找到访问令牌，使用虚拟计算');
      return calculateMatchedCount(conditions);
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
      return result.data?.pagination?.total_count || 0;
    } else {
      throw new Error(result.message || '查询失败');
    }
  } catch (error) {
    console.error('查询线索失败:', error);
    // 如果API调用失败，回退到虚拟计算
    return calculateMatchedCount(conditions);
  }
};

// 更新数据流统计
export const updateDataFlowStats = (currentStep: StepType) => {
  switch (currentStep) {
    case 'initiate':
      return {
        pendingLeads: 0,
        processingTasks: 0,
        completedToday: 0
      };
    case 'analyze':
      return {
        pendingLeads: Math.floor(35 + Math.random() * 10),
        processingTasks: 0,
        completedToday: 0
      };
    case 'call':
      return {
        pendingLeads: Math.floor(20 + Math.random() * 5),
        processingTasks: Math.floor(8 + Math.random() * 8),
        completedToday: Math.floor(15 + Math.random() * 10)
      };
    case 'report':
      return {
        pendingLeads: Math.floor(5 + Math.random() * 3),
        processingTasks: Math.floor(3 + Math.random() * 5),
        completedToday: Math.floor(25 + Math.random() * 15)
      };
    default:
      return {
        pendingLeads: 0,
        processingTasks: 0,
        completedToday: 0
      };
  }
}; 