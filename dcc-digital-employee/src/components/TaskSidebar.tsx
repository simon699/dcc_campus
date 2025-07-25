'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface Lead {
  id: number;
  name: string;
  phone: string;
  level: string;
  product: string;
}

interface TaskSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onCreateTask: (taskData: any) => void;
}

export default function TaskSidebar({ isOpen, onClose, selectedLeads, onCreateTask }: TaskSidebarProps) {
  const { theme } = useTheme();
  const [taskName, setTaskName] = useState('');
  const [taskMode, setTaskMode] = useState(1); // 1=手动, 2=自动
  const [taskType, setTaskType] = useState(1); // 1=通知类, 2=触达类
  const [executionTime, setExecutionTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setTaskName('');
    setTaskMode(1);
    setTaskType(1);
    setExecutionTime(null);
  };

  // 关闭侧边栏时重置表单
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // 处理保存任务
  const handleSave = async () => {
    if (!taskName.trim()) {
      alert('请输入任务名称');
      return;
    }

    if (taskMode === 2 && !executionTime) {
      alert('自动任务必须设置执行时间');
      return;
    }

    if (selectedLeads.length === 0) {
      alert('请选择至少一个线索');
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData = {
        task_name: taskName,
        task_mode: taskMode,
        task_type: taskType,
        execution_time: executionTime ? formatDateToServer(executionTime) : null,
        lead_ids: selectedLeads.map(lead => lead.id)
      };

      await onCreateTask(taskData);
      onClose();
    } catch (error) {
      console.error('创建任务失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 格式化日期为服务器格式
  const formatDateToServer = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* 侧拉抽屉 */}
      <div className={`fixed right-0 top-0 h-full w-96 z-50 transform transition-transform duration-300 ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
      } shadow-xl`}>
        {/* 头部 */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            创建任务
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 任务名称 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              任务名称 *
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="input-field"
              placeholder="请输入任务名称"
            />
          </div>

          {/* 任务方式 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              任务方式 *
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value={1}
                  checked={taskMode === 1}
                  onChange={(e) => setTaskMode(Number(e.target.value))}
                  className="mr-2"
                />
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  手动
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value={2}
                  checked={taskMode === 2}
                  onChange={(e) => setTaskMode(Number(e.target.value))}
                  className="mr-2"
                />
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  自动
                </span>
              </label>
            </div>
          </div>

          {/* 任务执行时间（仅自动任务显示） */}
          {taskMode === 2 && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                任务执行时间 *
              </label>
              <DatePicker
                selected={executionTime}
                onChange={(date: Date | null) => setExecutionTime(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                className="input-field"
                placeholderText="请选择执行时间"
                minDate={new Date()}
              />
            </div>
          )}

          {/* 任务类型 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              任务类型 *
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value={1}
                  checked={taskType === 1}
                  onChange={(e) => setTaskType(Number(e.target.value))}
                  className="mr-2"
                />
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  通知类
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value={2}
                  checked={taskType === 2}
                  onChange={(e) => setTaskType(Number(e.target.value))}
                  className="mr-2"
                />
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  触达类
                </span>
              </label>
            </div>
          </div>

          {/* 选择的线索列表 */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              选择的线索 ({selectedLeads.length})
            </label>
            <div className={`border rounded-lg p-3 max-h-60 overflow-y-auto ${
              theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
            }`}>
              {selectedLeads.length === 0 ? (
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  未选择任何线索
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedLeads.map((lead) => (
                    <div key={lead.id} className={`p-2 rounded border ${
                      theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {lead.name}
                          </p>
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            {lead.phone}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            {lead.level}
                          </p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {lead.product}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className={`p-6 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}