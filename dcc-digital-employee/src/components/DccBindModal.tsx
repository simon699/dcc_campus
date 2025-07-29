'use client';

import React, { useState, useEffect } from 'react';

interface DccBindModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DccBindModal({ isOpen, onClose }: DccBindModalProps) {
  const [step, setStep] = useState(1);
  const [dccUsername, setDccUsername] = useState('');
  const [dccPassword, setDccPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // 生成验证码
  const generateCaptcha = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let captchaString = '';
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      captchaString += chars[randomIndex];
    }
    setCaptchaCode(captchaString);
  };

  useEffect(() => {
    if (isOpen && step === 1) {
      generateCaptcha();
    }
  }, [isOpen, step]);

  // 模拟分析进度
  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step]);

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!dccUsername || !dccPassword) {
      setError('请输入DCC用户名和密码');
      return;
    }

    if (!captcha) {
      setError('请输入验证码');
      return;
    }

    if (captcha !== captchaCode) {
      setError('验证码错误');
      generateCaptcha();
      setCaptcha('');
      return;
    }

    setIsLoading(true);

    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/dcc/associate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({ dcc_user: dccUsername }),
      });

      if (!response.ok) {
        throw new Error('绑定失败');
      }

      const result = await response.json();

      if (result.status === 'success') {
        // 更新本地存储的用户信息
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.dcc_user = dccUsername;
          localStorage.setItem('user', JSON.stringify(user));
        }
        
        setStep(2);
        setAnalysisProgress(0);
      } else {
        throw new Error(result.message || '绑定失败');
      }
    } catch (err) {
      setError('绑定失败，请重试');
      console.error('Bind error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisComplete = () => {
    onClose();
    setStep(1);
    setAnalysisProgress(0);
    setDccUsername('');
    setDccPassword('');
    setCaptcha('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
        {step === 1 ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">绑定DCC账号</h2>
              <p className="text-gray-300">请绑定您的DCC账号以继续使用系统</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleBind} className="space-y-4">
              <div>
                <label htmlFor="dcc-username" className="block text-sm font-medium mb-2 text-gray-300">
                  DCC用户名
                </label>
                <input
                  type="text"
                  id="dcc-username"
                  value={dccUsername}
                  onChange={(e) => setDccUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                  placeholder="请输入DCC用户名"
                  required
                />
              </div>

              <div>
                <label htmlFor="dcc-password" className="block text-sm font-medium mb-2 text-gray-300">
                  DCC密码
                </label>
                <input
                  type="password"
                  id="dcc-password"
                  value={dccPassword}
                  onChange={(e) => setDccPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                  placeholder="请输入DCC密码"
                  required
                />
              </div>

              <div>
                <label htmlFor="dcc-captcha" className="block text-sm font-medium mb-2 text-gray-300">
                  验证码
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    id="dcc-captcha"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                    placeholder="请输入验证码"
                    maxLength={4}
                    required
                  />
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="w-24 h-11 rounded-lg border border-blue-500/30 font-mono text-lg font-bold transition-all duration-200 flex items-center justify-center tracking-wider bg-gradient-to-r from-blue-600/50 to-purple-600/50 text-blue-300 hover:from-blue-500/70 hover:to-purple-500/70 hover:text-white"
                    title="点击刷新验证码"
                  >
                    {captchaCode}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    绑定中...
                  </div>
                ) : (
                  '绑定'
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">正在分析</h2>
              <p className="text-gray-300">系统正在分析您的DCC账号信息</p>
            </div>

            <div className="mb-8">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-16 h-16 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-400 animate-spin" style={{ animationDirection: 'reverse' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(analysisProgress, 100)}%` }}
                ></div>
              </div>
              
              <p className="text-gray-300 text-sm">
                {analysisProgress >= 100 ? '分析完成' : '正在分析中...'}
              </p>
            </div>

            {analysisProgress >= 100 && (
              <button
                onClick={handleAnalysisComplete}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              >
                完成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 