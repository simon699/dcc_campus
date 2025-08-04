'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getActivityMonitor } from '../utils/activityMonitor';
import { checkTokenValidity } from '../services/api';
import { handleTokenExpired } from '../utils/tokenUtils';

interface User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // 在组件挂载时检查用户是否已登录
    const checkUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const accessToken = localStorage.getItem('access_token');
        
        if (storedUser && accessToken) {
          // 验证token是否有效
          console.log('AuthContext：检查token有效性...');
          const isValid = await checkTokenValidity();
          
          if (isValid) {
            console.log('AuthContext：Token有效，设置用户信息');
            setUser(JSON.parse(storedUser));
            // 启动活动监听器
            getActivityMonitor().start();
          } else {
            console.log('AuthContext：Token无效，清除用户信息并跳转到登录页面');
            // Token无效，清除用户信息并跳转到登录页面
            handleTokenExpired();
          }
        } else {
          console.log('AuthContext：未找到用户信息或token');
        }
      } catch (err) {
        console.error('AuthContext：检查用户信息失败:', err);
        // 发生错误时，清除可能损坏的数据
        handleTokenExpired();
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    
    try {
      // 模拟API请求
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 在实际应用中，这里应该调用API进行身份验证
      if (!username || !password) {
        throw new Error('用户名和密码不能为空');
      }
      
      if (password.length < 3) {
        throw new Error('密码不正确');
      }
      
      const userData = { username };
      
      // 存储用户信息
      localStorage.setItem('user', JSON.stringify(userData));
      document.cookie = `user=${JSON.stringify(userData)}; path=/; max-age=86400; samesite=strict`;
      
      setUser(userData);
      
      // 启动活动监听器
      getActivityMonitor().start();
      
      router.push('/');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('登录失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('AuthContext：用户登出');
    
    // 停止活动监听器
    getActivityMonitor().stopMonitoring();
    
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}