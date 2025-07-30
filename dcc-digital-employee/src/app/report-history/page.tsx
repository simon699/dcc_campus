'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

interface HistoryRecord {
  id: string;
  date: string;
  monitorAlerts: {
    title: string;
    description: string;
    leadCount: number;
  }[];
  callResults: {
    totalCalls: number;
    successRate: number;
    averageDuration: string;
    conversionCount: number;
  };
  qualityResults: {
    totalQuality: number;
    highScoreCount: number;
    mediumScoreCount: number;
    lowScoreCount: number;
    averageScore: number;
  };
  reportResults: {
    title: string;
    type: string;
    summary: string;
  }[];
}

export default function ReportHistoryPage() {
  const router = useRouter();
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    // 模拟历史记录数据
    const mockHistory: HistoryRecord[] = [
      {
        id: '1',
        date: '2024-01-25',
        monitorAlerts: [
          {
            title: '存在长时间未跟进的线索',
            description: '发现3条超过7天未跟进的线索，建议发起智能外呼，进行跟进',
            leadCount: 3
          },
          {
            title: '存在可转化的线索',
            description: '发现2条高价值转化线索，可发起智能外呼，进行跟进',
            leadCount: 2
          }
        ],
        callResults: {
          totalCalls: 5,
          successRate: 80,
          averageDuration: '2分30秒',
          conversionCount: 3
        },
        qualityResults: {
          totalQuality: 5,
          highScoreCount: 2,
          mediumScoreCount: 2,
          lowScoreCount: 1,
          averageScore: 82
        },
        reportResults: [
          {
            title: '外呼效果分析报告',
            type: 'analysis',
            summary: '本次外呼活动共完成5个客户联系，接通率80%，平均通话时长2分30秒。质检结果显示：2个客户通话质量优秀，2个客户通话质量良好，1个客户需要改进。其中4个客户表现出明显兴趣，建议重点跟进。'
          },
          {
            title: '客户跟进建议报告',
            type: 'summary',
            summary: '根据质检结果分析，建议对张三、李四、王五、赵六等4位客户进行重点跟进，他们对外呼内容反应积极，质检评分较高，有较强的购买意向。'
          }
        ]
      },
      {
        id: '2',
        date: '2024-01-24',
        monitorAlerts: [
          {
            title: '存在长时间未跟进的线索',
            description: '发现4条超过7天未跟进的线索，建议发起智能外呼，进行跟进',
            leadCount: 4
          }
        ],
        callResults: {
          totalCalls: 4,
          successRate: 75,
          averageDuration: '2分15秒',
          conversionCount: 2
        },
        qualityResults: {
          totalQuality: 4,
          highScoreCount: 1,
          mediumScoreCount: 2,
          lowScoreCount: 1,
          averageScore: 78
        },
        reportResults: [
          {
            title: '外呼效果分析报告',
            type: 'analysis',
            summary: '本次外呼活动共完成4个客户联系，接通率75%，平均通话时长2分15秒。质检结果显示：1个客户通话质量优秀，2个客户通话质量良好，1个客户需要改进。其中3个客户表现出明显兴趣，建议重点跟进。'
          },
          {
            title: '客户跟进建议报告',
            type: 'summary',
            summary: '根据质检结果分析，建议对张三、李四、王五等3位客户进行重点跟进，他们对外呼内容反应积极，质检评分较高，有较强的购买意向。'
          }
        ]
      }
    ];

    setHistoryRecords(mockHistory);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* 背景动画 */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        <Header />
        
        <main className="pt-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">报告历史记录</h1>
                  <p className="text-gray-300">查看历史监控预警、外呼结果和质检分析</p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-white/10 text-white hover:bg-white/20"
                >
                  返回工作台
                </button>
              </div>
            </div>

            {/* 历史记录列表 */}
            <div className="space-y-6">
              {historyRecords.map((record) => (
                <div key={record.id} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">{record.date}</h2>
                    <span className="text-gray-400 text-sm">记录ID: {record.id}</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 监控预警 */}
                    <div className="bg-red-500/10 rounded-xl border border-red-500/20 p-4">
                      <h3 className="text-lg font-semibold text-red-300 mb-3">监控预警</h3>
                      <div className="space-y-3">
                        {record.monitorAlerts.map((alert, index) => (
                          <div key={index} className="bg-white/5 rounded-lg p-3">
                            <div className="text-white font-medium mb-1">{alert.title}</div>
                            <div className="text-gray-300 text-sm mb-2">{alert.description}</div>
                            <div className="text-red-400 text-xs">涉及 {alert.leadCount} 个客户</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 外呼结果 */}
                    <div className="bg-blue-500/10 rounded-xl border border-blue-500/20 p-4">
                      <h3 className="text-lg font-semibold text-blue-300 mb-3">外呼结果</h3>
                      <div className="space-y-3">
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">总通话数</span>
                            <span className="text-white font-semibold">{record.callResults.totalCalls}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">接通率</span>
                            <span className="text-green-400 font-semibold">{record.callResults.successRate}%</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">平均时长</span>
                            <span className="text-blue-300 font-semibold">{record.callResults.averageDuration}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">转化意向</span>
                            <span className="text-purple-400 font-semibold">{record.callResults.conversionCount}个客户</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 质检结果 */}
                    <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4">
                      <h3 className="text-lg font-semibold text-green-300 mb-3">质检结果</h3>
                      <div className="space-y-3">
                        <div className="bg-white/5 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">质检总数</span>
                            <span className="text-white font-semibold">{record.qualityResults.totalQuality}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">优秀(85+)</span>
                            <span className="text-green-400 font-semibold">{record.qualityResults.highScoreCount}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">良好(75-84)</span>
                            <span className="text-yellow-400 font-semibold">{record.qualityResults.mediumScoreCount}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">需改进(&lt;75)</span>
                            <span className="text-red-400 font-semibold">{record.qualityResults.lowScoreCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">平均评分</span>
                            <span className="text-blue-400 font-semibold">{record.qualityResults.averageScore}分</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 报告结果 */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-purple-300 mb-3">生成报告</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {record.reportResults.map((report, index) => (
                        <div key={index} className="bg-purple-500/10 rounded-xl border border-purple-500/20 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">{report.title}</span>
                            <span className="text-purple-400 text-xs">{report.type === 'analysis' ? '分析报告' : '总结报告'}</span>
                          </div>
                          <div className="text-gray-300 text-sm">{report.summary}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 