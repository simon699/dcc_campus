'use client';

import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config/environment';

export default function TestEnv() {
  const [envInfo, setEnvInfo] = useState<any>({});

  useEffect(() => {
    // 获取环境变量信息
    const envData = {
      API_BASE_URL,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      NODE_ENV: process.env.NODE_ENV,
      'process.env.NEXT_PUBLIC_API_BASE_URL': process.env.NEXT_PUBLIC_API_BASE_URL,
    };

    setEnvInfo(envData);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">环境变量测试页面</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">环境变量信息</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(envInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API测试</h2>
          <button 
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/health`);
                const data = await response.json();
                alert(`API测试成功: ${JSON.stringify(data)}`);
              } catch (error) {
                alert(`API测试失败: ${error}`);
              }
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            测试API连接
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">登录API测试</h2>
          <button 
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    username: 'test',
                    password: 'test123'
                  }),
                });
                const data = await response.json();
                alert(`登录API测试结果: ${JSON.stringify(data)}`);
              } catch (error) {
                alert(`登录API测试失败: ${error}`);
              }
            }}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            测试登录API
          </button>
        </div>
      </div>
    </div>
  );
}
