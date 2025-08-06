'use client';

import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../app/datepicker-custom.css';

interface FollowupRecord {
  id: string;
  leadName: string;
  phone: string;
  isInterested?: number | null;
  remark?: string;
  conversation?: any;
  followupTime?: string;
  callDuration?: number;
  nextFollowTime?: string;
}

interface SyncDCCModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: FollowupRecord[];
}

interface FollowupPerson {
  id: string;
  name: string;
  department: string;
}

export default function SyncDCCModal({ isOpen, onClose, selectedRecords }: SyncDCCModalProps) {
  // 同步设置状态
  const [taskName, setTaskName] = useState<string>('同步任务-');
  const [assignmentType, setAssignmentType] = useState<'random' | 'followup_person' | 'specific_person'>('random');
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [taskStartTime, setTaskStartTime] = useState<Date | null>(new Date());
  const [taskEndTime, setTaskEndTime] = useState<Date | null>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 默认一周后

  // 时间校验状态
  const [timeError, setTimeError] = useState<string>('');

  // 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [syncComplete, setSyncComplete] = useState(false);

  // 模拟跟进人员数据
  const followupPersons: FollowupPerson[] = [
    { id: '1', name: '张经理', department: 'DCC经理' },
    { id: '2', name: '李专员', department: '电销专员' },
    { id: '3', name: '王专员', department: '电销专员' },
    { id: '4', name: '赵专员', department: '电销专员' },
    { id: '5', name: '钱专员', department: '电销专员' },
  ];

  // 格式化下次跟进时间
  const formatNextFollowTime = (nextFollowTime: string | null | undefined) => {
    if (!nextFollowTime) return '-';
    try {
      const date = new Date(nextFollowTime);
      return date.toLocaleString('zh-CN');
    } catch {
      return nextFollowTime;
    }
  };

  // 校验时间
  const validateTime = () => {
    if (!taskStartTime || !taskEndTime) {
      setTimeError('请设置开始时间和结束时间');
      return false;
    }
    
    if (taskStartTime >= taskEndTime) {
      setTimeError('结束时间必须晚于开始时间');
      return false;
    }
    
    setTimeError('');
    return true;
  };

  // 处理开始时间变化
  const handleStartTimeChange = (date: Date | null) => {
    setTaskStartTime(date);
    if (date && taskEndTime && date >= taskEndTime) {
      setTimeError('结束时间必须晚于开始时间');
    } else {
      setTimeError('');
    }
  };

  // 处理结束时间变化
  const handleEndTimeChange = (date: Date | null) => {
    setTaskEndTime(date);
    if (date && taskStartTime && taskStartTime >= date) {
      setTimeError('结束时间必须晚于开始时间');
    } else {
      setTimeError('');
    }
  };

  // 处理同步
  const handleSync = async () => {
    if (!taskName.trim()) {
      alert('请输入任务名称');
      return;
    }

    if (assignmentType === 'specific_person' && !selectedPerson) {
      alert('请选择指定跟进人');
      return;
    }

    if (!validateTime()) {
      return;
    }

    // 先切换到进度界面
    setSyncComplete(true);
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatus('正在创建任务...');

    try {
      // 模拟同步过程
      const steps = [
        '正在创建任务...',
        '正在分配跟进人员...',
        '正在同步线索数据...',
        '正在上传到DCC系统...',
        '正在验证数据完整性...',
        '同步完成！'
      ];

      for (let i = 0; i < steps.length; i++) {
        setSyncStatus(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 800));
        setSyncProgress(((i + 1) / steps.length) * 100);
      }

      // 同步完成后，停止进度状态
      setIsSyncing(false);
    } catch (error) {
      setSyncStatus('同步失败，请重试');
      setIsSyncing(false);
    }
  };

  // 重置状态
  const handleClose = () => {
    if (!isSyncing) {
      setTaskName('同步任务-');
      setAssignmentType('random');
      setSelectedPerson('');
      setTaskStartTime(new Date());
      setTaskEndTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setTimeError('');
      setSyncProgress(0);
      setSyncStatus('');
      setSyncComplete(false);
      setIsSyncing(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div>
              <h3 className="text-xl font-semibold text-white">同步到DCC</h3>
              <p className="text-gray-400 text-sm mt-1">将选中的线索同步到DCC系统</p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSyncing}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 弹窗内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {!syncComplete ? (
              <div className="space-y-6">
                {/* 同步设置 */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-white font-medium mb-4">同步设置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 任务名称 */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">任务名称</label>
                      <input
                        type="text"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="请输入任务名称"
                      />
                    </div>

                    {/* 分配方式 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">分配方式</label>
                      <select
                        value={assignmentType}
                        onChange={(e) => setAssignmentType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="random">随机分配</option>
                        <option value="followup_person">分配给线索跟进人</option>
                        <option value="specific_person">指定跟进人</option>
                      </select>
                    </div>

                    {/* 指定跟进人 */}
                    {assignmentType === 'specific_person' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">指定跟进人</label>
                        <select
                          value={selectedPerson}
                          onChange={(e) => setSelectedPerson(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="">请选择跟进人</option>
                          {followupPersons.map(person => (
                            <option key={person.id} value={person.id}>
                              {person.name} - {person.department}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 任务开始时间 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">任务开始时间</label>
                      <DatePicker
                        selected={taskStartTime}
                        onChange={handleStartTimeChange}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholderText="选择开始时间"
                        dateFormat="yyyy-MM-dd HH:mm"
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                      />
                    </div>

                    {/* 任务结束时间 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">任务结束时间</label>
                      <DatePicker
                        selected={taskEndTime}
                        onChange={handleEndTimeChange}
                        minDate={taskStartTime || undefined}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholderText="选择结束时间"
                        dateFormat="yyyy-MM-dd HH:mm"
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                      />
                    </div>

                    {/* 时间错误提示 */}
                    {timeError && (
                      <div className="md:col-span-2">
                        <div className="text-red-400 text-sm mt-2 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {timeError}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 线索列表 */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-white font-medium mb-4">线索列表 ({selectedRecords.length})</h4>
                  <div className="max-h-60 overflow-y-auto">
                    <div className="space-y-3">
                      {selectedRecords.map((record, index) => (
                        <div key={record.id} className="flex items-center space-x-4 p-3 bg-white/5 rounded-lg">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 text-xs font-medium">{index + 1}</span>
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-400 text-xs mb-1">姓名</div>
                              <div className="text-white font-medium">{record.leadName}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs mb-1">手机号</div>
                              <div className="text-white">{record.phone}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs mb-1">下次跟进时间</div>
                              <div className="text-white">
                                {formatNextFollowTime(record.nextFollowTime)}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-xs mb-1">备注</div>
                              <div className="text-white">
                                {record.remark || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                {!isSyncing && (
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleClose}
                      className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSync}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                      创建任务并同步到DCC
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* 同步完成界面 */
              <div className="text-center py-8">
                {isSyncing ? (
                  /* 同步进度界面 */
                  <div className="space-y-6">
                    <div className="mb-6">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">正在同步到DCC</h3>
                      <p className="text-gray-300">请稍候，正在处理您的请求...</p>
                    </div>
                    
                    {/* 同步进度 */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-blue-400 font-medium">{syncStatus}</span>
                        <span className="text-blue-400 text-sm">{Math.round(syncProgress)}%</span>
                      </div>
                      <div className="w-full bg-blue-500/20 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${syncProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 同步成功界面 */
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">同步成功</h3>
                    <p className="text-gray-300">请前去DCC系统查看数据</p>
                  </div>
                )}
                
                {!isSyncing && (
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                  >
                    确定
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}