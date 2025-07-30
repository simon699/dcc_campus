'use client';

import { useState } from 'react';

interface QualityItem {
  id: string;
  leadName: string;
  phone: string;
  callTime: string;
  duration: string;
  qualityScore: number;
  analysisResult: string;
  suggestions: string[];
  status: 'analyzing' | 'completed' | 'failed';
  progress: number;
}

interface QualityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: QualityItem[];
}

export default function QualityDrawer({ isOpen, onClose, items }: QualityDrawerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'analyzing':
        return 'text-blue-400 bg-blue-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '质检完成';
      case 'analyzing':
        return '质检中';
      case 'failed':
        return '质检失败';
      default:
        return '未知状态';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
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
              <h2 className="text-xl font-semibold text-white">智能质检分析</h2>
              <p className="text-gray-400 text-sm mt-1">共 {items.length} 条质检记录</p>
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
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium text-lg">{item.leadName}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm space-y-1 mb-3">
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">手机号:</span>
                          <span>{item.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">通话时间:</span>
                          <span>{item.callTime}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">通话时长:</span>
                          <span className="text-blue-300">{item.duration}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400 w-16">质检评分:</span>
                          <span className={`font-bold ${getQualityColor(item.qualityScore)}`}>
                            {item.qualityScore}分
                          </span>
                        </div>
                      </div>

                      {/* 质检进度 */}
                      {item.status === 'analyzing' && (
                        <div className="mb-3">
                          <div className="text-gray-400 text-sm mb-1">质检进度</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* 分析结果 */}
                      {item.status === 'completed' && (
                        <div className="space-y-3">
                          <div>
                            <div className="text-gray-400 text-sm mb-1">分析结果</div>
                            <div className="text-gray-300 text-sm bg-white/5 rounded-lg p-3">
                              {item.analysisResult}
                            </div>
                          </div>
                          
                          {item.suggestions.length > 0 && (
                            <div>
                              <div className="text-gray-400 text-sm mb-1">改进建议</div>
                              <div className="space-y-1">
                                {item.suggestions.map((suggestion, index) => (
                                  <div key={index} className="text-gray-300 text-sm bg-white/5 rounded-lg p-2">
                                    • {suggestion}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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