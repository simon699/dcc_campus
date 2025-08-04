// Token验证工具函数
import { checkTokenValidity } from '../services/api';

// 全局token失效处理函数
export const handleTokenExpired = () => {
  console.log('Token已失效，正在跳转到登录页面...');
  
  // 清除本地存储的认证信息
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  
  // 清除cookie
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  // 跳转到登录页面
  if (typeof window !== 'undefined') {
    // 使用window.location.href确保页面完全刷新
    window.location.href = '/login';
  }
};

// 检查并验证token
export const validateToken = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('未找到token');
      return false;
    }

    console.log('验证token有效性...');
    const isValid = await checkTokenValidity();
    
    if (!isValid) {
      console.log('Token验证失败');
      handleTokenExpired();
      return false;
    }

    console.log('Token验证成功');
    return true;
  } catch (error) {
    console.error('Token验证过程中发生错误:', error);
    handleTokenExpired();
    return false;
  }
};

// 定期检查token有效性
export const startTokenValidation = (intervalMinutes: number = 5) => {
  const interval = setInterval(async () => {
    const isValid = await validateToken();
    if (!isValid) {
      clearInterval(interval);
    }
  }, intervalMinutes * 60 * 1000);

  return () => clearInterval(interval);
};

// 在页面可见时检查token
export const setupTokenValidationOnVisibility = () => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      console.log('页面变为可见，检查token有效性');
      await validateToken();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}; 