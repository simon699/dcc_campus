// API服务文件
import { handleTokenExpired } from '../utils/tokenUtils';
import { API_BASE_URL } from '../config/environment';

// Token缓存机制
let tokenCache = {
  token: null as string | null,
  isValid: false,
  lastCheck: 0,
  cacheDuration: 5 * 60 * 1000 // 5分钟缓存
};

// 获取访问令牌
const getAuthToken = (): string | null => {
  const token = localStorage.getItem('access_token');
  tokenCache.token = token;
  return token;
};

// 简化的token校验方法
export const checkTokenValidity = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    tokenCache.isValid = false;
    return false;
  }

  // 检查缓存是否有效
  const now = Date.now();
  if (tokenCache.token === token && 
      tokenCache.isValid && 
      (now - tokenCache.lastCheck) < tokenCache.cacheDuration) {
    return true;
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
      const isValid = result.status === 'success';
      
      // 更新缓存
      tokenCache.isValid = isValid;
      tokenCache.lastCheck = now;
      
      return isValid;
    }
    
    // 更新缓存
    tokenCache.isValid = false;
    tokenCache.lastCheck = now;
    return false;
  } catch (error) {
    console.error('Token验证失败:', error);
    // 更新缓存
    tokenCache.isValid = false;
    tokenCache.lastCheck = now;
    return false;
  }
};

// 检查token是否有效（带缓存）
const isTokenValid = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) {
    return false;
  }

  // 如果缓存中的token不匹配，清除缓存
  if (tokenCache.token !== token) {
    tokenCache.isValid = false;
    tokenCache.lastCheck = 0;
  }

  // 检查缓存是否有效
  const now = Date.now();
  if (tokenCache.isValid && (now - tokenCache.lastCheck) < tokenCache.cacheDuration) {
    return true;
  }

  // 缓存无效，重新验证
  return await checkTokenValidity();
};

// 清除token缓存
export const clearTokenCache = () => {
  tokenCache.isValid = false;
  tokenCache.lastCheck = 0;
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

  // 异步检查token有效性，不阻塞请求
  const tokenCheckPromise = isTokenValid();
  
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
      clearTokenCache();
      handleTokenExpired();
      throw new Error('登录已过期，请重新登录');
    }
    
    // 先读取响应体（无论成功或失败）
    const responseData = await response.json();
    
    // 如果响应不成功，尝试返回响应体（可能包含错误信息）
    if (!response.ok) {
      // 对于400错误，返回响应体让调用方处理（可能包含code=4008等特殊错误码）
      if (response.status === 400) {
        // FastAPI 通常在 HTTPException 中包一层 { detail: {...} }
        const normalized = (responseData && (responseData as any).detail) ? (responseData as any).detail : responseData;
        return normalized;
      }
      throw new Error(`API请求失败: ${response.status}`);
    }

    // 异步检查token有效性，如果无效则清除缓存
    tokenCheckPromise.then(isValid => {
      if (!isValid) {
        clearTokenCache();
      }
    }).catch(() => {
      // token检查失败，清除缓存
      clearTokenCache();
    });

    return responseData;
  } catch (error) {
    // 如果是网络错误或其他错误，也检查token
    if (error instanceof TypeError) {
      // 网络错误，可能是token问题
      console.log('网络错误，检查token有效性');
      const isValid = await tokenCheckPromise;
      if (!isValid) {
        clearTokenCache();
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
  // 分页获取任务列表（新接口 /task_list）
  getTaskListPaged: async (page: number = 1, pageSize: number = 20, options?: { taskTypes?: number[] }) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize)
    });
    if (options?.taskTypes && options.taskTypes.length > 0) {
      params.append('task_types', options.taskTypes.join(','));
    }

    const res = await apiRequest(`/task_list?${params.toString()}`, {
      method: 'GET'
    });
    return res; // 直接返回后端结构，包含 data.items 与 data.pagination
  },

  // 适配器：将 /task_list items 转为组件 Task 格式
  adaptTaskListItems: (items: Array<any>) => {
    return (items || []).map((i: any) => ({
      id: String(i.id),
      name: i.task_name,
      conditions: [],
      targetCount: i.leads_count,
      createdAt: i.create_time,
      status: i.task_type === 3 ? 'completed' : 'pending',
      organization_id: undefined,
      create_name: undefined,
      script_id: undefined,
      task_type: i.task_type,
      size_desc: undefined
    }));
  },

  // 获取任务统计数据（带请求去重，防止并发请求）
  getCallTasksStatistics: (() => {
    let pendingRequest: Promise<any> | null = null;
    
    return async () => {
      // 如果已经有正在进行的请求，直接返回该请求的 Promise
      if (pendingRequest) {
        console.log('task-stats 请求正在进行中，等待现有请求完成...');
        return pendingRequest;
      }
      
      // 创建新的请求
      pendingRequest = apiRequest('/task-stats')
        .then((response) => {
          pendingRequest = null; // 请求完成后清除
          return response;
        })
        .catch((error) => {
          pendingRequest = null; // 请求失败后也清除
          throw error;
        });
      
      return pendingRequest;
    };
  })(),

  // 获取任务详情（包括 leads_task_list 数据）
  getCallTaskDetails: async (taskId: string | number) => {
    const response = await apiRequest('/tasks', {
      method: 'GET'
    });
    
    if (response.status === 'success' && response.data) {
      // 从任务列表中查找指定任务
      const task = Array.isArray(response.data) 
        ? response.data.find((t: any) => String(t.id) === String(taskId))
        : null;
      
      if (task) {
        return {
          status: 'success',
          code: 200,
          message: '获取任务详情成功',
          data: task
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: '未找到指定任务'
        };
      }
    }
    
    return response;
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
      leads_type: string[];
      leads_product: string[];
      first_follow_start?: string;
      first_follow_end?: string;
      latest_follow_start?: string;
      latest_follow_end?: string;
      next_follow_start?: string;
      next_follow_end?: string;
      is_arrive?: number[];
      [key: string]: any;
    };
  }) => {
    return apiRequest('/create-autoCall-tasks', {
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
  },

  // 检查任务完成状态
  checkTaskStatus: async (taskId: string) => {
    return apiRequest(`/check_task_status/${taskId}`);
  },

  // 获取任务状态详情
  getTaskStatusDetails: async (taskId: string) => {
    return apiRequest(`/task_status_details/${taskId}`);
  },

  // 查询任务执行情况（新接口）
  queryTaskExecution: async (
    taskId: number,
    page: number = 1,
    pageSize: number = 20,
    skipRecording: boolean = true,
    onlyFollowed: boolean = false,
    interest?: number | null,
    applyUpdate: boolean = false
  ) => {
    return apiRequest('/query-task-execution', {
      method: 'POST',
      body: JSON.stringify((() => {
        const payload: any = {
          task_id: taskId,
          page,
          page_size: pageSize,
          skip_recording: skipRecording,
          only_followed: onlyFollowed,
          apply_update: applyUpdate
        };
        if (interest !== undefined && interest !== null) {
          payload.interest = interest;
        }
        return payload;
      })())
    });
  },

  // 启动后台分批执行（runId模式）
  startQueryExecutionRun: async (params: {
    task_id: number;
    batch_size?: number;
    sleep_ms?: number;
    skip_recording?: boolean;
  }) => {
    return apiRequest('/start-query-execution-run', {
      method: 'POST',
      body: JSON.stringify({
        task_id: params.task_id,
        batch_size: params.batch_size ?? 100,
        sleep_ms: params.sleep_ms ?? 200,
        skip_recording: params.skip_recording ?? true,
      })
    });
  },

  // 查询后台运行进度
  getQueryExecutionRun: async (runId: number) => {
    return apiRequest(`/get-query-execution-run?run_id=${runId}`, {
      method: 'GET'
    });
  },

  // 获取任务统计信息（新接口）
  getTaskStatistics: async (taskId: number) => {
    return apiRequest('/task-statistics', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId
      })
    });
  },

  // 获取已完成的任务列表（跟进Agent专用）
  // 已废弃：请使用 getTaskListPaged 并在前端筛选 task_type

  // 批量检查任务状态
  batchCheckTaskStatus: async (taskIds: string[]) => {
    return apiRequest('/batch_check_task_status', {
      method: 'POST',
      body: JSON.stringify({ job_ids: taskIds })
    });
  },

  // 更新任务script_id
  updateTaskScriptId: async (taskId: number, scriptId: string) => {
    return apiRequest('/update-script-id', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        script_id: scriptId
      })
    });
  },

  // 开始外呼任务
  startCallTask: async (taskId: string) => {
    return apiRequest('/start-call-task', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId
      })
    });
  },

  // 暂停/重启任务
  suspendResumeTask: async (taskId: number, action: 'suspend' | 'resume') => {
    return apiRequest('/suspend-resume-task', {
      method: 'POST',
      body: JSON.stringify({
        action: action,
        task_id: taskId
      })
    });
  },

  // 控制自动化任务监控
  controlAutoTask: async (action: 'start' | 'stop' | 'check') => {
    return apiRequest('/auto-task', {
      method: 'POST',
      body: JSON.stringify({
        action: action
      })
    });
  },

  // 查询任务组详情和执行情况
  describeJobGroup: async (params: { job_group_id?: string; task_id?: number }) => {
    return apiRequest('/describe-job-group', {
      method: 'POST',
      body: JSON.stringify(params)
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