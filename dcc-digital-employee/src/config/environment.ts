// 环境配置
interface EnvironmentConfig {
  API_BASE_URL: string;
  NODE_ENV: string;
}

// 根据环境变量确定配置
const getEnvironmentConfig = (): EnvironmentConfig => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // 开发环境配置
  if (nodeEnv === 'development') {
    return {
      API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
      NODE_ENV: 'development'
    };
  }
  
  // 生产环境配置
  if (nodeEnv === 'production') {
    return {
      API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
      NODE_ENV: 'production'
    };
  }
  
  // 测试环境配置
  if (nodeEnv === 'test') {
    return {
      API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
      NODE_ENV: 'test'
    };
  }
  
  // 默认配置
  return {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
    NODE_ENV: nodeEnv
  };
};

// 导出环境配置
export const env = getEnvironmentConfig();

// 导出API基础URL
export const API_BASE_URL = env.API_BASE_URL;

// 导出环境信息
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test'; 