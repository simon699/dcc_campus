// API服务文件
const API_BASE_URL = 'http://localhost:8000/api';

// 获取访问令牌
const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

// 通用API请求函数
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    throw new Error(`API请求失败: ${response.status}`);
  }

  return response.json();
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

  // 获取任务详情
  getCallTaskDetails: async (taskId: string) => {
    return apiRequest(`/call-tasks/list?task_id=${taskId}`);
  },

  // 创建外呼任务
  createCallTask: async (taskData: {
    task_name: string;
    scene_id?: string;
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
  }
};

export default {
  leadsAPI,
  tasksAPI
}; 