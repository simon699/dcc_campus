'use client';

import { useState } from 'react';

interface ReportItem {
  id: string;
  title: string;
  type: 'summary' | 'analysis' | 'trend' | 'comparison';
  content: string;
  data?: {
    label: string;
    value: string | number;
    change?: string;
  }[];
  charts?: {
    type: 'line' | 'bar' | 'pie';
    data: any[];
  }[];
  status: 'generating' | 'completed' | 'failed';
  progress: number;
  generateTime: string;
}

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ReportItem[];
}

export default function ReportDrawer({ isOpen, onClose, items }: ReportDrawerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-500/20';
      case 'generating':
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
        return '生成完成';
      case 'generating':
        return '生成中';
      case 'failed':
        return '生成失败';
      default:
        return '未知状态';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'summary':
        return '📊';
      case 'analysis':
        return '📈';
      case 'trend':
        return '📉';
      case 'comparison':
        return '⚖️';
      default:
        return '📋';
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
              <h2 className="text-xl font-semibold text-white">数据报告</h2>
              <p className="text-gray-400 text-sm mt-1">共 {items.length} 份报告</p>
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
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">{getTypeIcon(item.type)}</span>
                          <span className="text-white font-medium text-lg">{item.title}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      
                      <div className="text-gray-400 text-sm mb-3">
                        生成时间: {item.generateTime}
                      </div>

                      {/* 生成进度 */}
                      {item.status === 'generating' && (
                        <div className="mb-3">
                          <div className="text-gray-400 text-sm mb-1">生成进度</div>
                          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* 报告内容 */}
                      {item.status === 'completed' && (
                        <div className="space-y-3">
                          <div>
                            <div className="text-gray-400 text-sm mb-1">报告内容</div>
                            <div className="text-gray-300 text-sm bg-white/5 rounded-lg p-3">
                              {item.content}
                            </div>
                          </div>
                          
                          {/* 数据指标 */}
                          {item.data && item.data.length > 0 && (
                            <div>
                              <div className="text-gray-400 text-sm mb-2">关键指标</div>
                              <div className="grid grid-cols-2 gap-3">
                                {item.data.map((data, index) => (
                                  <div key={index} className="bg-white/5 rounded-lg p-3">
                                    <div className="text-gray-400 text-xs mb-1">{data.label}</div>
                                    <div className="text-white font-semibold">{data.value}</div>
                                    {data.change && (
                                      <div className={`text-xs ${data.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                                        {data.change}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 图表占位 */}
                          {item.charts && item.charts.length > 0 && (
                            <div>
                              <div className="text-gray-400 text-sm mb-2">数据图表</div>
                              <div className="space-y-2">
                                {item.charts.map((chart, index) => (
                                  <div key={index} className="bg-white/5 rounded-lg p-3">
                                    <div className="text-gray-300 text-sm">
                                      {chart.type === 'line' && '📈 趋势图'}
                                      {chart.type === 'bar' && '📊 柱状图'}
                                      {chart.type === 'pie' && '🥧 饼图'}
                                    </div>
                                    <div className="text-gray-400 text-xs mt-1">
                                      图表数据已生成
                                    </div>
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