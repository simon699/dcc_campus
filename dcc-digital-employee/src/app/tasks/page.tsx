'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import TaskDetailSidebar from '../../components/TaskDetailSidebar';
import TasksDataDashboard from '../../components/TasksDataDashboard';

// 任务接口定义
interface Task {
  id: number;
  task_name: string;
  task_mode: number; // 1=手动，2=自动
  task_type: number; // 1=通知类，2=触达类
  execution_time: string;
  status: number; // 1=未开始，2=执行中，3=已结束，4=已暂停
  creator: string;
  create_time: string;
  update_time: string;
  lead_count: number;
}

export default function TasksPage() {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  
  // 搜索条件
  const [searchParams, setSearchParams] = useState({
    createTimeStart: null as Date | null,
    createTimeEnd: null as Date | null,
    executionTimeStart: null as Date | null,
    executionTimeEnd: null as Date | null,
    taskName: '',
    status: '',
    taskType: '',
    taskMode: '',
  });

  // 状态映射
  const getStatusText = (status: number): string => {
    const statusMap: { [key: number]: string } = {
      1: '未开始',
      2: '执行中', 
      3: '已结束',
      4: '已暂停'
    };
    return statusMap[status] || '未知';
  };

  const getStatusCode = (status: string): number => {
    const statusMap: { [key: string]: number } = {
      '未开始': 1,
      '执行中': 2,
      '已结束': 3,
      '已暂停': 4,
    };
    return statusMap[status] ?? 1;
  };

  const getTaskModeText = (mode: number): string => {
    return mode === 1 ? '手动' : '自动';
  };

  const getTaskTypeText = (type: number): string => {
    return type === 1 ? '通知类' : '触达类';
  };

  // 日期格式化辅助函数
  const formatDateToLocal = (date: Date, isEndTime: boolean = false): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = isEndTime ? '23:59:59' : '00:00:00';
    return `${year}-${month}-${day} ${time}`;
  };

  // 添加日期时间格式化函数
  const formatDateTime = (dateTimeString: string): string => {
    if (!dateTimeString) return '-';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return dateTimeString;
    }
  };

  // 获取任务列表数据
  const fetchTasks = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
      });
      
      if (searchParams.status) {
        queryParams.append('status', getStatusCode(searchParams.status).toString());
      }
      if (searchParams.taskType) {
        queryParams.append('task_type', searchParams.taskType === '通知类' ? '1' : '2');
      }
      
      const response = await fetch(`http://localhost:8000/api/tasks/tasks?${queryParams}`, {
        method: 'GET',
        headers: {
          'access-token': accessToken || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data && Array.isArray(data.data.tasks)) {
          setTasks(data.data.tasks);
          if (data.data.pagination) {
            setTotalPages(data.data.pagination.total_pages);
          }
        } else {
          console.error('Invalid data format:', data);
          setTasks([]);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [currentPage, pageSize, searchParams]);

  // 初始化时获取任务数据
  const fetchTasksWithoutSearch = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      
      const queryParams = new URLSearchParams({
        page: '1',
        page_size: pageSize.toString(),
      });
      
      const response = await fetch(`http://localhost:8000/api/tasks/tasks?${queryParams}`, {
        method: 'GET',
        headers: {
          'access-token': accessToken || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data && Array.isArray(data.data.tasks)) {
          setTasks(data.data.tasks);
          setCurrentPage(1);
          if (data.data.pagination) {
            setTotalPages(data.data.pagination.total_pages);
          }
        } else {
          console.error('Invalid data format:', data);
          setTasks([]);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchTasksWithoutSearch();
  }, []);

  useEffect(() => {
    if (currentPage > 1) {
      fetchTasks();
    }
  }, [currentPage]);

  // 处理搜索条件变化
  const handleSearchChange = (field: string, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 重置搜索条件
  const handleReset = () => {
    setSearchParams({
      createTimeStart: null,
      createTimeEnd: null,
      executionTimeStart: null,
      executionTimeEnd: null,
      taskName: '',
      status: '',
      taskType: '',
      taskMode: '',
    });
    setCurrentPage(1);
    fetchTasksWithoutSearch();
  };

  // 搜索按钮点击事件
  const handleSearch = () => {
    setCurrentPage(1);
    fetchTasks();
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(tasks.map(task => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  // 处理单个选择
  const handleSelectTask = (taskId: number, checked: boolean) => {
    if (checked) {
      setSelectedTasks(prev => [...prev, taskId]);
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  // 处理查看任务详情
  const handleViewTaskDetail = (taskId: number) => {
    setSelectedTaskId(taskId);
    setIsDetailSidebarOpen(true);
  };

  // 更新任务状态
  const handleUpdateTaskStatus = async (taskId: number, newStatus: number) => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/tasks/update_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          task_id: taskId,
          status: newStatus
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          // 刷新任务列表
          fetchTasks();
          alert('任务状态更新成功！');
        } else {
          alert(result.message || '任务状态更新失败');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.detail?.message || '任务状态更新失败');
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
      alert('更新任务状态失败，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* 动态背景粒子效果 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      {/* 返回按钮 */}
      <div className="relative z-10 p-6">
        <button
          onClick={() => window.location.href = '/robots'}
          className="group flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-blue-500/30 rounded-lg text-blue-300 hover:text-white hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
        >
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">返回智能工作台</span>
        </button>
      </div>

      {/* 页面标题 */}
      <div className="relative z-10 text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          任务管理中心
        </h1>
        <p className="text-blue-300/80 text-lg">智能化任务管理，提升执行效率</p>
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pb-8">
        {/* 搜索筛选区域 */}
        <div className="bg-gradient-to-r from-slate-800/50 to-blue-900/30 backdrop-blur-sm border border-blue-500/20 rounded-xl p-6 mb-6 shadow-xl">
          <h2 className="text-xl font-semibold text-blue-300 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            智能筛选
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* 创建时间 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                创建时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.createTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('createTimeStart', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.createTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('createTimeEnd', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 执行时间 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                执行时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.executionTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('executionTimeStart', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.executionTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('executionTimeEnd', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 任务名称 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                任务名称
              </label>
              <input
                type="text"
                value={searchParams.taskName}
                onChange={(e) => handleSearchChange('taskName', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                placeholder="请输入任务名称"
              />
            </div>

            {/* 任务状态 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                任务状态
              </label>
              <select
                value={searchParams.status}
                onChange={(e) => handleSearchChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="">全部</option>
                <option value="未开始">未开始</option>
                <option value="执行中">执行中</option>
                <option value="已结束">已结束</option>
                <option value="已暂停">已暂停</option>
              </select>
            </div>

            {/* 任务类型 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                任务类型
              </label>
              <select
                value={searchParams.taskType}
                onChange={(e) => handleSearchChange('taskType', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="">全部</option>
                <option value="通知类">通知类</option>
                <option value="触达类">触达类</option>
              </select>
            </div>

            {/* 任务方式 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                任务方式
              </label>
              <select
                value={searchParams.taskMode}
                onChange={(e) => handleSearchChange('taskMode', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="">全部</option>
                <option value="手动">手动</option>
                <option value="自动">自动</option>
              </select>
            </div>
          </div>

          {/* 搜索按钮 */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-slate-700/50 border border-slate-500/30 rounded-lg text-slate-300 hover:text-white hover:border-slate-400/50 transition-all duration-300"
            >
              重置
            </button>
            <button
              onClick={handleSearch}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 任务列表区域 */}
        <div className="bg-gradient-to-r from-slate-800/50 to-blue-900/30 backdrop-blur-sm border border-blue-500/20 rounded-xl shadow-xl overflow-hidden">
          {/* 操作按钮区域 */}
          <div className="p-6 flex justify-between items-center border-b border-blue-500/20">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-300/80">
                已选择 {selectedTasks.length} 项
              </span>
            </div>
          </div>

          {/* 任务列表表格 */}
          <div className="relative">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full table-fixed" style={{ minWidth: '1200px' }}>
                <thead className="bg-gradient-to-r from-slate-800/80 to-blue-900/50 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded bg-slate-700/50 border-blue-500/30"
                      />
                    </th>
                    <th className="sticky left-[50px] z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '200px' }}>任务名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>任务类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>任务方式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '120px' }}>任务状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>线索数量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '150px' }}>执行时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>创建人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '150px' }}>创建时间</th>
                    <th className="sticky right-0 z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '150px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={task.id} className="hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 transition-all duration-300 border-b border-blue-500/10">
                      <td className="sticky left-0 z-10 px-4 py-3 bg-gradient-to-r from-slate-800/50 to-blue-900/30">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={(e) => handleSelectTask(task.id, e.target.checked)}
                          className="rounded bg-slate-700/50 border-blue-500/30"
                        />
                      </td>
                      <td className="sticky left-[50px] z-10 px-4 py-3 bg-gradient-to-r from-slate-800/50 to-blue-900/30">
                        <div className="font-medium text-blue-100 truncate" title={task.task_name}>
                          {task.task_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-blue-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.task_type === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
                        }`}>
                          {task.task_type === 1 ? '通知类' : '触达类'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.task_mode === 1 ? 'bg-green-900/50 text-green-300' : 'bg-orange-900/50 text-orange-300'
                        }`}>
                          {task.task_mode === 1 ? '手动' : '自动'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 1 ? 'bg-gray-900/50 text-gray-300' :
                          task.status === 2 ? 'bg-blue-900/50 text-blue-300' :
                          task.status === 3 ? 'bg-green-900/50 text-green-300' :
                          'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-200">{task.lead_count}</td>
                      <td className="px-4 py-3 text-blue-200">{formatDateTime(task.execution_time)}</td>
                      <td className="px-4 py-3 text-blue-200">{task.creator}</td>
                      <td className="px-4 py-3 text-blue-200">{formatDateTime(task.create_time)}</td>
                      <td className="sticky right-0 z-10 px-4 py-3 bg-gradient-to-r from-slate-800/50 to-blue-900/30">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewTaskDetail(task.id)}
                            className="px-3 py-1 bg-blue-600/50 text-blue-200 rounded hover:bg-blue-600/70 transition-colors duration-200 text-sm"
                          >
                            详情
                          </button>
                          {task.status === 1 && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 2)}
                              className="px-3 py-1 bg-green-600/50 text-green-200 rounded hover:bg-green-600/70 transition-colors duration-200 text-sm"
                            >
                              开始
                            </button>
                          )}
                          {task.status === 2 && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 4)}
                              className="px-3 py-1 bg-yellow-600/50 text-yellow-200 rounded hover:bg-yellow-600/70 transition-colors duration-200 text-sm"
                            >
                              暂停
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          <div className="px-6 py-4 border-t border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-500/30 rounded-lg text-slate-300 hover:text-white hover:border-slate-400/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-500/30 rounded-lg text-slate-300 hover:text-white hover:border-slate-400/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-blue-300/80">
                    第 <span className="font-medium text-blue-300">{currentPage}</span> 页，
                    共 <span className="font-medium text-blue-300">{totalPages}</span> 页
                  </p>
                </div>
                <div>
                  <nav className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-blue-300 hover:bg-blue-600/20'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 任务详情侧拉抽屉 */}
      <TaskDetailSidebar 
        isOpen={isDetailSidebarOpen} 
        onClose={() => setIsDetailSidebarOpen(false)} 
        taskId={selectedTaskId}
      />
  </div>
    );
}