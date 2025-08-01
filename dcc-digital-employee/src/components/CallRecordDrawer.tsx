'use client';

import { useState } from 'react';

interface CallRecord {
  id: string;
  leadName: string;
  phone: string;
  callTime: string;
  duration: string;
  status: 'success' | 'failed' | 'no-answer' | 'busy';
  result: string;
  notes?: string;
}

interface CallTask {
  id: string;
  leadName: string;
  phone: string;
  status: 'pending' | 'calling' | 'completed' | 'failed';
  progress: number;
}

interface CallRecordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: CallRecord[];
  currentTasks?: CallTask[];
}

export default function CallRecordDrawer({ isOpen, onClose, records, currentTasks = [] }: CallRecordDrawerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      case 'no-answer':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'busy':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '接通成功';
      case 'failed':
        return '拨打失败';
      case 'no-answer':
        return '无人接听';
      case 'busy':
        return '占线';
      default:
        return '未知状态';
    }
  };

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* 侧拉抽屉 */}
      <div className={`
        fixed top-0 right-0 h-full w-[600px] bg-white/10 backdrop-blur-xl border-l border-white/20
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-xl font-semibold text-white">电话拨打记录</h2>
              <p className="text-gray-400 text-sm mt-1">共 {records.length} 条记录</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 抽屉内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 正在拨打的电话 */}
            {currentTasks.filter(task => task.status === 'calling').length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                  正在拨打
                </h3>
                <div className="space-y-3">
                  {currentTasks.filter(task => task.status === 'calling').map((task) => (
                    <div key={task.id} className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{task.leadName}</span>
                        <span className="text-blue-400 text-sm">通话中...</span>
                      </div>
                      <div className="text-gray-300 text-sm mb-3">
                        <div>手机号: {task.phone}</div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <div className="text-blue-400 text-xs mt-1 text-center">
                        {task.progress}% 完成
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 等待拨打的电话 */}
            {currentTasks.filter(task => task.status === 'pending').length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                  等待拨打
                </h3>
                <div className="space-y-2">
                  {currentTasks.filter(task => task.status === 'pending').slice(0, 3).map((task) => (
                    <div key={task.id} className="bg-gray-500/10 rounded-lg p-3 border border-gray-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm">{task.leadName}</span>
                        <span className="text-gray-400 text-xs">等待中</span>
                      </div>
                      <div className="text-gray-400 text-xs mt-1">{task.phone}</div>
                    </div>
                  ))}
                  {currentTasks.filter(task => task.status === 'pending').length > 3 && (
                    <div className="text-gray-400 text-xs text-center py-2">
                      还有 {currentTasks.filter(task => task.status === 'pending').length - 3} 个等待拨打
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 通话记录 */}
            <div className="space-y-4">
              {records.length > 0 && (
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  通话记录
                </h3>
              )}
              {records.map((record) => (
                <div key={record.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-lg">{record.leadName}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(record.status)}`}>
                          {getStatusText(record.status)}
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm space-y-1">
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">手机号:</span>
                          <span>{record.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">拨打时间:</span>
                          <span>{record.callTime}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">通话时长:</span>
                          <span className="text-blue-300">{record.duration}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">通话结果:</span>
                          <span>{record.result}</span>
                        </div>
                        {record.notes && (
                          <div className="flex items-start">
                            <span className="text-gray-400 w-16 mt-1">备注:</span>
                            <span className="text-gray-300 flex-1">{record.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 