'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Layout from '../../components/Layout';
import TaskDetailSidebar from '../../components/TaskDetailSidebar';

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
    <Layout activeMenu="tasks">
      <div className="min-w-[1000px] space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            任务管理
          </h1>
          <p className={`mt-1 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            管理和跟踪您的任务执行情况
          </p>
        </div>

        {/* 搜索区域 */}
        <div className="saas-card">
          <h2 className={`text-lg font-medium mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            搜索筛选
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 创建时间 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                创建时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.createTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('createTimeStart', date)}
                  className="input-field"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.createTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('createTimeEnd', date)}
                  className="input-field"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 执行时间 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                执行时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.executionTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('executionTimeStart', date)}
                  className="input-field"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.executionTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('executionTimeEnd', date)}
                  className="input-field"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 任务名称 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                任务名称
              </label>
              <input
                type="text"
                value={searchParams.taskName}
                onChange={(e) => handleSearchChange('taskName', e.target.value)}
                className="input-field"
                placeholder="请输入任务名称"
              />
            </div>

            {/* 任务状态 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                任务状态
              </label>
              <select
                value={searchParams.status}
                onChange={(e) => handleSearchChange('status', e.target.value)}
                className="input-field"
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
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                任务类型
              </label>
              <select
                value={searchParams.taskType}
                onChange={(e) => handleSearchChange('taskType', e.target.value)}
                className="input-field"
              >
                <option value="">全部</option>
                <option value="通知类">通知类</option>
                <option value="触达类">触达类</option>
              </select>
            </div>

            {/* 任务方式 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                任务方式
              </label>
              <select
                value={searchParams.taskMode}
                onChange={(e) => handleSearchChange('taskMode', e.target.value)}
                className="input-field"
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
              className="btn-secondary"
            >
              重置
            </button>
            <button
              onClick={handleSearch}
              className="btn-primary"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 列表区域 */}
        <div className="saas-card p-0 overflow-hidden min-w-[1000px]">
          {/* 操作按钮区域 */}
          <div className={`p-6 flex justify-between items-center border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                已选择 {selectedTasks.length} 项
              </span>
            </div>
          </div>

          {/* 任务列表表格 */}
          <div className="relative">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full table-fixed" style={{ minWidth: '1200px' }}>
                <thead className={`${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <tr>
                    <th className={`sticky left-0 z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedTasks.length === tasks.length && tasks.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className={`rounded ${
                          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        }`}
                      />
                    </th>
                    <th className={`sticky left-[50px] z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '200px' }}>任务名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>任务类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>任务方式</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '120px' }}>任务状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>线索数量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '180px' }}>执行时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>创建人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '180px' }}>创建时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '200px' }}>操作</th>
                    <th className={`sticky right-0 z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '100px' }}>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className={`${
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    }`}>
                      <td className={`sticky left-0 z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={(e) => handleSelectTask(task.id, e.target.checked)}
                          className={`rounded ${
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                          }`}
                        />
                      </td>
                      <td className={`sticky left-[50px] z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{task.task_name}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{getTaskTypeText(task.task_type)}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{getTaskModeText(task.task_mode)}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <span className={`badge ${
                          task.status === 3 ? 'badge-success' :
                          task.status === 4 ? 'badge-error' :
                          task.status === 2 ? 'badge-warning' :
                          'badge-gray'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{task.lead_count}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{task.execution_time || '-'}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{task.creator}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{task.create_time}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <div className="flex space-x-2">
                          {task.status === 1 && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 2)}
                              className="btn-outline text-xs py-1 px-2"
                            >
                              开始
                            </button>
                          )}
                          {task.status === 2 && (
                            <>
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 4)}
                                className="btn-outline text-xs py-1 px-2"
                              >
                                暂停
                              </button>
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 3)}
                                className="btn-outline text-xs py-1 px-2"
                              >
                                完成
                              </button>
                            </>
                          )}
                          {task.status === 4 && (
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 2)}
                              className="btn-outline text-xs py-1 px-2"
                            >
                              继续
                            </button>
                          )}
                        </div>
                      </td>
                      <td className={`sticky right-0 z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <button 
                          onClick={() => handleViewTaskDetail(task.id)}
                          className="btn-outline text-sm py-1 px-3"
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          <div className={`px-6 py-4 flex items-center justify-between border-t ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn-outline"
              >
                上一页
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn-outline"
              >
                下一页
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  第 <span className="font-medium">{currentPage}</span> 页，
                  共 <span className="font-medium">{totalPages}</span> 页
                </p>
              </div>
              <div>
                <nav className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-300'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === totalPages
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </nav>
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
    </Layout>
  );
}