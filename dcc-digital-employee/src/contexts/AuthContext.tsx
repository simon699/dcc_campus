'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getActivityMonitor } from '../utils/activityMonitor';
import { checkTokenValidity } from '../services/api';
import { handleTokenExpired } from '../utils/tokenUtils';
import { API_BASE_URL } from '../config/environment';

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
    const checkUser = async () => {
      setLoading(true);
      
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
            console.log('AuthContext：Token无效，跳转到登录页面');
            handleTokenExpired();
            return;
          }
        } else {
          console.log('AuthContext：未找到用户信息或token，跳转到登录页面');
          router.push('/login');
          return;
        }
      } catch (err) {
        console.error('AuthContext：检查用户信息失败:', err);
        handleTokenExpired();
        return;
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]); // 移除isTokenValidating依赖

  const login = async (username: string, password: string) => {
    setLoading(true);
    
    try {
      console.log('AuthContext：开始登录流程');
      
      // 调用API进行身份验证
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('登录失败');
      }

      const result = await response.json();
      console.log('AuthContext：登录API响应', result);

      if (result.status === 'success' && result.data) {
        const { user_info, access_token } = result.data;
        
        const userData = { 
          username: user_info.username,
          dcc_user: user_info.dcc_user 
        };
        
        console.log('AuthContext：准备存储用户数据', userData);
        
        // 存储用户信息和token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('access_token', access_token);
        
        // 设置cookie
        document.cookie = `user=${JSON.stringify({ username: user_info.username })}; path=/; max-age=86400; samesite=lax`;
        document.cookie = `access_token=${access_token}; path=/; max-age=86400; samesite=lax`;
        
        // 检查是否需要绑定DCC账号
        if (!user_info.dcc_user) {
          // 将需要绑定DCC的信息存储到sessionStorage
          sessionStorage.setItem('needBindDcc', 'true');
        }
        
        console.log('AuthContext：设置用户状态');
        setUser(userData);
        
        // 启动活动监听器
        getActivityMonitor().start();
        
        console.log('AuthContext：登录成功，准备跳转');
        // 延迟跳转，确保状态更新完成
        setTimeout(() => {
          console.log('AuthContext：执行跳转到首页');
          router.push('/');
        }, 200);
      } else {
        throw new Error(result.message || '登录失败');
      }
    } catch (error) {
      console.error('AuthContext：登录失败', error);
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