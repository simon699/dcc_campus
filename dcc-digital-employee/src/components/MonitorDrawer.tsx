'use client';

import React, { useState, useEffect } from 'react';
import CallStatusDrawer from './CallStatusDrawer';

interface CallingTask {
  id: string;
  name: string;
  targetCount: number;
  createdAt: string;
  status: string;
}

interface MonitorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  callingTasks: CallingTask[];
  callProgress?: number;
}

export default function MonitorDrawer({ isOpen, onClose, callingTasks, callProgress = 0 }: MonitorDrawerProps) {
  const [showCallStatus, setShowCallStatus] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CallingTask | null>(null);

  const handleTaskClick = (task: CallingTask) => {
    setSelectedTask(task);
    setShowCallStatus(true);
  };

  const handleClose = () => {
    onClose();
  };

  // 如果没有任务，显示测试数据
  const displayTasks = callingTasks.length > 0 ? callingTasks : [
    {
      id: 'test-1',
      name: '测试外呼任务',
      targetCount: 5,
      createdAt: new Date().toLocaleString(),
      status: 'working'
    }
  ];

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[70] pt-4" 
        onClick={handleClose}
      >
        <div 
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 h-[80vh] flex flex-col" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto p-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">外呼Agent监控</h2>
                <p className="text-gray-300">实时监控外呼Agent的工作状态和任务执行情况</p>
              </div>
              <button 
                onClick={handleClose} 
                className="text-gray-400 hover:text-white transition-colors"
                style={{ position: 'relative', zIndex: 1000 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 外呼Agent状态 */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 animate-pulse"></div>
                  <h3 className="text-lg font-semibold text-white">外呼Agent状态</h3>
                </div>
                <span className="text-blue-300 text-sm font-medium">工作中</span>
              </div>
              
              {/* 总体进度 */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">总体进度</span>
                  <span className="text-blue-300 font-medium">{callProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${callProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-blue-400 font-bold text-lg">{displayTasks.length}</div>
                  <div className="text-gray-400 text-xs">执行中任务</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-green-400 font-bold text-lg">
                    {displayTasks.reduce((sum, task) => sum + task.targetCount, 0)}
                  </div>
                  <div className="text-gray-400 text-xs">目标线索</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-purple-400 font-bold text-lg">
                    {Math.floor(callProgress * displayTasks.reduce((sum, task) => sum + task.targetCount, 0) / 100)}
                  </div>
                  <div className="text-gray-400 text-xs">已完成</div>
                </div>
              </div>
            </div>

            {/* 任务列表 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">执行中的任务</h3>
              
              {displayTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">暂无执行中的任务</h3>
                  <p className="text-gray-400">外呼Agent当前处于空闲状态</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="bg-white/5 border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTaskClick(task);
                      }}
                      style={{ position: 'relative', zIndex: 1000 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                          <h4 className="text-white font-medium">{task.name}</h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-blue-300 text-sm font-medium">执行中</span>
                          <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">目标线索:</span>
                          <span className="text-white ml-2 font-medium">{task.targetCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">创建时间:</span>
                          <span className="text-white ml-2">{task.createdAt}</span>
                        </div>
                      </div>
                      
                      {/* 任务进度 */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">任务进度</span>
                          <span className="text-blue-300">{Math.floor(callProgress / displayTasks.length)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.floor(callProgress / displayTasks.length)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* 点击提示 */}
                      <div className="mt-2 text-xs text-blue-400 text-center">
                        点击查看电话拨打情况
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 pt-0 pb-8 border-t border-white/10">
            <div className="flex justify-end space-x-3">
              <button 
                onClick={handleClose} 
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                style={{ position: 'relative', zIndex: 1000 }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 电话拨打情况抽屉 */}
      {selectedTask && (
        <CallStatusDrawer
          isOpen={showCallStatus}
          onClose={() => {
            setShowCallStatus(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.id}
          taskName={selectedTask.name}
        />
      )}
    </>
  );
} 