// API服务文件
import { handleTokenExpired } from '../utils/tokenUtils';

const API_BASE_URL = 'http://localhost:8000/api';

// 获取访问令牌
const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// 简化的token校验方法
export const checkTokenValidity = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token,
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result.status === 'success';
    }
    return false;
  } catch (error) {
    console.error('Token验证失败:', error);
    return false;
  }
};

// 检查token是否有效
const isTokenValid = async (): Promise<boolean> => {
  return await checkTokenValidity();
};

// 通用API请求函数
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  // 如果没有token，直接跳转到登录页面
  if (!token) {
    console.log('未找到token，跳转到登录页面');
    handleTokenExpired();
    throw new Error('未登录，请先登录');
  }

  // 检查token是否有效
  const isValid = await isTokenValid();
  if (!isValid) {
    console.log('Token验证失败，跳转到登录页面');
    handleTokenExpired();
    throw new Error('登录已过期，请重新登录');
  }
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'access-token': token }),
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // 如果响应状态是401（未授权），说明token无效
    if (response.status === 401) {
      console.log('收到401响应，token无效，跳转到登录页面');
      handleTokenExpired();
      throw new Error('登录已过期，请重新登录');
    }
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // 如果是网络错误或其他错误，也检查token
    if (error instanceof TypeError) {
      // 网络错误，可能是token问题
      console.log('网络错误，检查token有效性');
      const isValid = await isTokenValid();
      if (!isValid) {
        handleTokenExpired();
        throw new Error('登录已过期，请重新登录');
      }
    }
    throw error;
  }
};

// 线索相关API
export const leadsAPI = {
  // 获取线索统计信息
  getStatistics: async (filterBy: 'product' | 'type' | 'both' | 'arrive') => {
    return apiRequest(`/leads/statistics?filter_by=${filterBy}`);
  },

  // 根据筛选条件获取线索统计信息
  getFilteredStatistics: async (filters: any, filterBy: 'product' | 'type' | 'both') => {
    return apiRequest(`/leads/statistics/filtered?filter_by=${filterBy}`, {
      method: 'POST',
      body: JSON.stringify(filters)
    });
  },

  // 获取叠加筛选条件的统计信息
  getFilteredCount: async (filters: any, filterBy?: 'product' | 'type' | 'both' | 'arrive') => {
    const params = new URLSearchParams();
    
    // 只有当filterBy有值时才添加筛选维度参数
    if (filterBy) {
      params.append('filter_by', filterBy);
    }
    
    // 添加筛选参数
    if (filters.leads_product) params.append('leads_product', filters.leads_product);
    if (filters.leads_type) params.append('leads_type', filters.leads_type);
    if (filters.first_follow_start) params.append('first_follow_start', filters.first_follow_start);
    if (filters.first_follow_end) params.append('first_follow_end', filters.first_follow_end);
    if (filters.latest_follow_start) params.append('latest_follow_start', filters.latest_follow_start);
    if (filters.latest_follow_end) params.append('latest_follow_end', filters.latest_follow_end);
    if (filters.next_follow_start) params.append('next_follow_start', filters.next_follow_start);
    if (filters.next_follow_end) params.append('next_follow_end', filters.next_follow_end);
    if (filters.first_arrive_start) params.append('first_arrive_start', filters.first_arrive_start);
    if (filters.first_arrive_end) params.append('first_arrive_end', filters.first_arrive_end);
    if (filters.is_arrive !== undefined) params.append('is_arrive', filters.is_arrive.toString());
    
    return apiRequest(`/leads/statistics?${params.toString()}`);
  }
};

// 任务相关API
export const tasksAPI = {
  // 获取外呼任务列表
  getCallTasksList: async () => {
    return apiRequest('/call-tasks/list');
  },

  // 获取任务统计数据
  getCallTasksStatistics: async () => {
    return apiRequest('/call-tasks/statistics');
  },

  // 获取任务详情
  getCallTaskDetails: async (taskId: string) => {
    return apiRequest(`/call-tasks/list?task_id=${taskId}`);
  },

  // 检查任务完成状态
  checkTaskCompletion: async (taskId: number, taskType: number) => {
    return apiRequest('/check_task_completion', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        task_type: taskType
      })
    });
  },

  // 获取任务跟进记录
  getTaskFollowupRecords: async (taskId: number) => {
    return apiRequest(`/task_followup_records/${taskId}`);
  },

  // 创建外呼任务
  createCallTask: async (taskData: {
    task_name: string;
    script_id?: string;
    size_desc: {
      leads_product?: string;
      next_follow_start?: string;
      next_follow_end?: string;
      [key: string]: any;
    };
  }) => {
    return apiRequest('/call-tasks/create', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  // 创建任务（保留原有接口）
  createTask: async (taskData: any) => {
    return apiRequest('/tasks/create', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  // 发起外呼
  createOutboundCall: async (outboundData: {
    job_group_name: string;
    job_group_description: string;
    strategy_json?: {
      RepeatBy?: string;
      maxAttemptsPerDay?: number;
      minAttemptInterval?: number;
    };
    lead_ids: number[];
    script_id?: string;
    extras?: Array<{
      key: string;
      value: string;
    }>;
  }) => {
    return apiRequest('/create_outbound_call', {
      method: 'POST',
      body: JSON.stringify(outboundData)
    });
  },

  // 查询外呼任务
  queryOutboundCall: async (jobIds: string[]) => {
    return apiRequest('/query_outbound_call', {
      method: 'POST',
      body: JSON.stringify({ job_ids: jobIds })
    });
  }
};

// 场景相关API
export const scenesAPI = {
  // 获取场景列表
  getScenes: async () => {
    return apiRequest('/scenes');
  },

  // 获取场景详情
  getSceneDetails: async (sceneId: string) => {
    return apiRequest(`/scenes/${sceneId}`);
  },

  // 创建场景
  createScene: async (sceneData: {
    scene_name: string;
    scene_detail: string;
    scene_type: number;
    bot_name: string;
    bot_sex?: number;
    bot_age?: number;
    bot_post?: string;
    bot_style?: string;
    dialogue_target?: string;
    dialogue_bg?: string;
    dialogue_skill?: string;
    dialogue_flow?: string;
    dialogue_constraint?: string;
    dialogue_opening_prompt?: string;
    scene_tags?: Array<{
      tag_name: string;
      tag_detail: string;
      tags: string;
    }>;
  }) => {
    return apiRequest('/create_scene', {
      method: 'POST',
      body: JSON.stringify(sceneData)
    });
  }
};

export default {
  leadsAPI,
  tasksAPI
}; 