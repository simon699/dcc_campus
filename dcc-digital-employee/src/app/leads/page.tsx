'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import Layout from '../../components/Layout';
import LeadSidebar from '../../components/LeadSidebar';
import LeadDetailSidebar from '../../components/LeadDetailSidebar';
import TaskSidebar from '../../components/TaskSidebar';

// Define product tree types
type ProductNode = {
  id: string;
  name: string;
  children?: ProductNode[];
};

// 在文件顶部添加类型定义
interface Lead {
  id: number;
  name: string;
  phone: string;
  source: string;
  product: string;
  status: string;
  level: string;
  follower: string;
  lastFollowTime: string;
  nextFollowTime: string;
  aiCall: boolean;
  planVisitTime: string;
  createTime: string;
  remark: string;
  latest_follow_id?: number;
  latest_follow_type?: number;
  latest_follow_time?: string;
  latest_follower?: string;
  latest_next_follow_time?: string;
  latest_plan_visit_time?: string;
  latest_follow_remark?: string;
}

export default function LeadsPage() {
  const { theme } = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [products, setProducts] = useState<ProductNode[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLeadSidebarOpen, setIsLeadSidebarOpen] = useState(false);
  const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
  const [isTaskSidebarOpen, setIsTaskSidebarOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [userName, setUserName] = useState('未知用户');
  
  // 搜索条件
  const [searchParams, setSearchParams] = useState({
    createTimeStart: null as Date | null,
    createTimeEnd: null as Date | null,
    lastFollowTimeStart: null as Date | null,
    lastFollowTimeEnd: null as Date | null,
    nextFollowTimeStart: null as Date | null,
    nextFollowTimeEnd: null as Date | null,
    phone: '',
    level: '',
    status: '',
    product: '',
    aiCall: '',
  });

  // 获取产品信息
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/products/tree', {
        headers: {
          'access-token': accessToken || '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        // 确保数据是数组格式
        if (Array.isArray(data)) {
          setProducts(data);
        } else if (data && Array.isArray(data.data)) {
          setProducts(data.data);
        } else {
          console.error('Invalid products data format:', data);
          setProducts([]);
        }
      } else {
        console.error('Failed to fetch products');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 将产品树扁平化为选项列表
  const flattenProducts = (nodes: ProductNode[], prefix = ''): { value: string; label: string }[] => {
    // 确保 nodes 是数组
    if (!Array.isArray(nodes)) {
      return [];
    }

    const result: { value: string; label: string }[] = [];

    nodes.forEach((node: ProductNode) => {
      const label = prefix ? `${prefix} > ${node.name}` : node.name;
      result.push({ value: node.name, label });

      if (node.children && node.children.length > 0) {
        result.push(...flattenProducts(node.children, label));
      }
    });

    return result;
  };

  // 获取线索列表数据
  // 添加日期格式化辅助函数
  const formatDateToLocal = (date: Date, isEndTime: boolean = false): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = isEndTime ? '23:59:59' : '00:00:00';
    return `${year}-${month}-${day} ${time}`;
  };

  // 然后在fetchLeads函数中使用：
  const fetchLeads = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      
      const requestBody = {
        page: currentPage,
        page_size: pageSize,
        clues_status: searchParams.status ? getStatusCode(searchParams.status) : undefined,
        client_level: searchParams.level ? getLevelCode(searchParams.level) : undefined,
        phone: searchParams.phone || undefined,
        product: searchParams.product || undefined,
        // 使用本地时间格式化
        create_time_start: searchParams.createTimeStart ? formatDateToLocal(searchParams.createTimeStart) : undefined,
        create_time_end: searchParams.createTimeEnd ? formatDateToLocal(searchParams.createTimeEnd, true) : undefined,
        last_follow_time_start: searchParams.lastFollowTimeStart ? formatDateToLocal(searchParams.lastFollowTimeStart) : undefined,
        last_follow_time_end: searchParams.lastFollowTimeEnd ? formatDateToLocal(searchParams.lastFollowTimeEnd, true) : undefined,
        next_follow_time_start: searchParams.nextFollowTimeStart ? formatDateToLocal(searchParams.nextFollowTimeStart) : undefined,
        next_follow_time_end: searchParams.nextFollowTimeEnd ? formatDateToLocal(searchParams.nextFollowTimeEnd, true) : undefined,
        ai_call: searchParams.aiCall ? (searchParams.aiCall === 'true') : undefined,
      };
      
      // 移除 undefined 值
      Object.keys(requestBody).forEach(key => {
        if ((requestBody as any)[key] === undefined) {
          delete (requestBody as {[key: string]: any})[key];
        }
      });
      
      const response = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        const data = await response.json();
        // 修复这里：正确处理返回的数据结构
        if (data && data.data && Array.isArray(data.data.leads_with_follows)) {
          // 将后端返回的数据结构转换为前端需要的格式
          const formattedLeads = data.data.leads_with_follows.map((item: any) => {
            const lead = item.lead_info;
            const follow = item.latest_follow;
            
            return {
              id: lead.id,
              name: lead.client_name,
              phone: lead.phone,
              source: lead.source,
              product: lead.product,
              status: lead.clues_status_text,
              level: lead.client_level_text,
              follower: follow ? follow.follower : (lead.create_name || '-'),
              lastFollowTime: follow ? follow.follow_time : '-',
              nextFollowTime: follow ? follow.next_follow_time : '-',
              aiCall: follow ? follow.follow_type === 2 : false,
              planVisitTime: follow ? follow.plan_visit_time : '-',
              createTime: lead.create_time,
              remark: follow ? follow.remark : '-',
              // 保存原始数据，以便需要时使用
              latest_follow_id: follow ? follow.follow_id : undefined,
              latest_follow_type: follow ? follow.follow_type : undefined,
              latest_follow_time: follow ? follow.follow_time : undefined,
              latest_follower: follow ? follow.follower : undefined,
              latest_next_follow_time: follow ? follow.next_follow_time : undefined,
              latest_plan_visit_time: follow ? follow.plan_visit_time : undefined,
              latest_follow_remark: follow ? follow.remark : undefined
            };
          });
          
          setLeads(formattedLeads);
          
          // 设置分页信息
          if (data.data.pagination) {
            setTotalPages(data.data.pagination.total_pages);
          }
        } else {
          console.error('Invalid data format:', data);
          setLeads([]);
        }
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  }, [currentPage, pageSize, searchParams]);


  // 添加状态码转换函数
  const getStatusCode = (status: string): number => {
    const statusMap: { [key: string]: number } = {
      '已战败': 0,
      '未跟进': 1,
      '跟进中': 2,
      '已成交': 3,
    };
    return statusMap[status] ?? 1; // 默认未跟进
  };

  const getLevelCode = (level: string): number => {
    const levelMap: { [key: string]: number } = {
      'H级': 1,
      'A级': 2,
      'B级': 3,
      'C级': 4,
      'N级': 5,
      'O级': 6,
      'F级': 7,
    };
    return levelMap[level] ?? 5; // 默认N级
  };


  useEffect(() => {
    // 页面加载时获取产品数据
    fetchProducts();
    
    // 获取用户名
    try {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        const tokenParts = accessToken.split('.');
        if (tokenParts && tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          setUserName(payload.username || '未知用户');
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      setUserName('未知用户');
    }
    
    // 初始化时获取线索数据（不带搜索条件）
    fetchLeadsWithoutSearch();
  }, []);

  // 只有当分页变化时重新获取数据（不包括搜索参数变化）
  useEffect(() => {
    if (currentPage > 1) {
      // 如果是翻页操作，使用当前的搜索条件
      fetchLeads();
    }
  }, [currentPage]);

  // 添加一个不带搜索条件的初始化函数
  const fetchLeadsWithoutSearch = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      
      // 只传递分页参数，不传递搜索条件
      const requestBody = {
        page: 1,
        page_size: pageSize,
      };
      
      const response = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data && Array.isArray(data.data.leads_with_follows)) {
          const formattedLeads = data.data.leads_with_follows.map((item: any) => {
            const lead = item.lead_info;
            const follow = item.latest_follow;
            
            return {
              id: lead.id,
              name: lead.client_name,
              phone: lead.phone,
              source: lead.source,
              product: lead.product,
              status: lead.clues_status_text,
              level: lead.client_level_text,
              follower: follow ? follow.follower : (lead.create_name || '-'),
              lastFollowTime: follow ? follow.follow_time : '-',
              nextFollowTime: follow ? follow.next_follow_time : '-',
              aiCall: follow ? follow.follow_type === 2 : false,
              planVisitTime: follow ? follow.plan_visit_time : '-',
              createTime: lead.create_time,
              remark: follow ? follow.remark : '-',
              latest_follow_id: follow ? follow.follow_id : undefined,
              latest_follow_type: follow ? follow.follow_type : undefined,
              latest_follow_time: follow ? follow.follow_time : undefined,
              latest_follower: follow ? follow.follower : undefined,
              latest_next_follow_time: follow ? follow.next_follow_time : undefined,
              latest_plan_visit_time: follow ? follow.plan_visit_time : undefined,
              latest_follow_remark: follow ? follow.remark : undefined
            };
          });
          
          setLeads(formattedLeads);
          setCurrentPage(1);
          
          if (data.data.pagination) {
            setTotalPages(data.data.pagination.total_pages);
          }
        } else {
          console.error('Invalid data format:', data);
          setLeads([]);
        }
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  }, [pageSize]);

  // 处理搜索条件变化（不自动搜索）
  const handleSearchChange = (field: string, value: any) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }));
    // 移除自动重置到第一页的逻辑
    // setCurrentPage(1);
  };

  // 重置搜索条件并重新加载数据
  const handleReset = () => {
    setSearchParams({
      createTimeStart: null,
      createTimeEnd: null,
      lastFollowTimeStart: null,
      lastFollowTimeEnd: null,
      nextFollowTimeStart: null,
      nextFollowTimeEnd: null,
      phone: '',
      level: '',
      status: '',
      product: '',
      aiCall: '',
    });
    setCurrentPage(1);
    // 重置后加载不带搜索条件的数据
    fetchLeadsWithoutSearch();
  };

  // 搜索按钮点击事件
  const handleSearch = () => {
    setCurrentPage(1); // 搜索时重置到第一页
    fetchLeads(); // 使用当前搜索条件进行搜索
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(leads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  // 处理单个选择
  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  // 处理创建任务
  const handleCreateTask = () => {
    if (selectedLeads.length === 0) {
      alert('请选择至少一个线索');
      return;
    }
    setIsTaskSidebarOpen(true);
  };

  // 处理任务创建
  const handleTaskCreate = async (taskData: any) => {
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/tasks/create_task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          alert('任务创建成功！');
          // 清空选择的线索
          setSelectedLeads([]);
          setIsTaskSidebarOpen(false);
        } else {
          alert(result.message || '任务创建失败');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.detail?.message || '任务创建失败');
      }
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('创建任务失败，请重试');
    }
  };

  // 获取选中线索的详细信息
  const getSelectedLeadsData = () => {
    return leads.filter(lead => selectedLeads.includes(lead.id)).map(lead => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      level: lead.level,
      product: lead.product
    }));
  };

  // 处理新建线索
  const handleCreateLead = () => {
    setIsLeadSidebarOpen(true);
  };

  // 处理添加新线索
  // 在 handleAddLead 函数中
  const handleAddLead = (lead: Lead) => {
    // 刷新线索列表
    fetchLeads();
    // 关闭侧边栏
    setIsLeadSidebarOpen(false);
  };

  // 处理查看线索详情
  const handleViewLeadDetail = (leadId: number) => {
    setSelectedLeadId(leadId);
    setIsDetailSidebarOpen(true);
  };

  return (
    <Layout activeMenu="leads">
      {/* 设置页面最小宽度为1000px，屏幕宽了自动拉伸 */}
      <div className="min-w-[1000px] space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className={`text-2xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            线索管理
          </h1>
          <p className={`mt-1 text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            管理和跟踪您的销售线索
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

            {/* 最新跟进时间 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                最新跟进时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.lastFollowTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('lastFollowTimeStart', date)}
                  className="input-field"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.lastFollowTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('lastFollowTimeEnd', date)}
                  className="input-field"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 下次跟进时间 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                下次跟进时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.nextFollowTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('nextFollowTimeStart', date)}
                  className="input-field"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.nextFollowTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('nextFollowTimeEnd', date)}
                  className="input-field"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 手机号 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                手机号
              </label>
              <input
                type="text"
                value={searchParams.phone}
                onChange={(e) => handleSearchChange('phone', e.target.value)}
                className="input-field"
                placeholder="请输入手机号"
              />
            </div>

            {/* 客户等级 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                客户等级
              </label>
              <select
                value={searchParams.level}
                onChange={(e) => handleSearchChange('level', e.target.value)}
                className="input-field"
              >
                <option value="">全部</option>
                <option value="H级">H级</option>
                <option value="A级">A级</option>
                <option value="B级">B级</option>
                <option value="C级">C级</option>
                <option value="N级">N级</option>
              </select>
            </div>

            {/* 线索状态 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                线索状态
              </label>
              <select
                value={searchParams.status}
                onChange={(e) => handleSearchChange('status', e.target.value)}
                className="input-field"
              >
                <option value="">全部</option>
                <option value="未跟进">未跟进</option>
                <option value="跟进中">跟进中</option>
                <option value="已到店">已到店</option>
                <option value="已战败">已战败</option>
                <option value="已成交">已成交</option>
              </select>
            </div>

            {/* 车型 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                车型
              </label>
              <select
                value={searchParams.product}
                onChange={(e) => handleSearchChange('product', e.target.value)}
                className="input-field"
                disabled={isLoadingProducts}
              >
                <option value="">
                  {isLoadingProducts ? '加载产品中...' : '全部'}
                </option>
                {flattenProducts(Array.isArray(products) ? products : []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* AI外呼 */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                AI外呼
              </label>
              <select
                value={searchParams.aiCall}
                onChange={(e) => handleSearchChange('aiCall', e.target.value)}
                className="input-field"
              >
                <option value="">全部</option>
                <option value="true">是</option>
                <option value="false">否</option>
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
              onClick={() => fetchLeads()}
              className="btn-primary"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 列表区域 - 调整容器宽度 */}
        <div className="saas-card p-0 overflow-hidden min-w-[1000px]">
          {/* 操作按钮区域 */}
          <div className={`p-6 flex justify-between items-center border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCreateTask}
                disabled={selectedLeads.length === 0}
                className={selectedLeads.length === 0 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
              >
                
                创建任务
              </button>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                已选择 {selectedLeads.length} 项
              </span>
            </div>
            <button
              onClick={handleCreateLead}
              className="btn-primary"
            >
            
              新建线索
            </button>
          </div>

          {/* 修改表格容器，使用固定宽度并添加水平滚动 */}
          <div className="relative">
            {/* 添加一个滚动容器，设置固定高度和滚动 */}
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full table-fixed" style={{ minWidth: '1200px' }}>
                <thead className={`${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <tr>
                    {/* 固定列：选择框 */}
                    <th className={`sticky left-0 z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className={`rounded ${
                          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        }`}
                      />
                    </th>
                    {/* 固定列：姓名 */}
                    <th className={`sticky left-[50px] z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '100px' }}>姓名</th>
                    {/* 固定列：手机号 */}
                    <th className={`sticky left-[150px] z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '120px' }}>手机号</th>
                    {/* 其他列 */}
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>来源</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '200px' }}>意向产品</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>线索状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>客户等级</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '100px' }}>跟进人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '230px' }}>最新跟进时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '230px' }}>下次跟进时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '80px' }}>AI外呼</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '230px' }}>计划到店时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '230px' }}>创建时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ width: '200px' }}>备注</th>
                    {/* 固定列：详情 */}
                    <th className={`sticky right-0 z-20 px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    }`} style={{ width: '100px' }}>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className={`${
                      theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    }`}>
                      {/* 固定列：选择框 */}
                      <td className={`sticky left-0 z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                          className={`rounded ${
                            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                          }`}
                        />
                      </td>
                      {/* 固定列：姓名 */}
                      <td className={`sticky left-[50px] z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.name}</td>
                      {/* 固定列：手机号 */}
                      <td className={`sticky left-[150px] z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.phone}</td>
                      {/* 其他列 */}
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.source}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.product}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <span className={`badge ${
                          lead.status === '已成交' ? 'badge-success' :
                          lead.status === '已战败' ? 'badge-error' :
                          lead.status === '已到店' ? 'badge-info' :
                          lead.status === '跟进中' ? 'badge-warning' :
                          'badge-gray'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.level}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.follower}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.lastFollowTime}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.nextFollowTime}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <span className={`badge ${
                          lead.aiCall ? 'badge-success' : 'badge-gray'
                        }`}>
                          {lead.aiCall ? '是' : '否'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.planVisitTime}</td>
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>{lead.createTime}</td>
                      {/* 备注列：添加鼠标悬停显示完整内容 */}
                      <td className={`px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <div className="relative group">
                          <div className="truncate max-w-[180px]">{lead.remark || '-'}</div>
                          {lead.remark && (
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-white dark:bg-gray-800 p-2 rounded shadow-lg z-50 max-w-md">
                              {lead.remark}
                            </div>
                          )}
                        </div>
                      </td>
                      {/* 固定列：详情 */}
                      <td className={`sticky right-0 z-10 px-4 py-3 ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}>
                        <button 
                          onClick={() => handleViewLeadDetail(lead.id)}
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
      {/* 添加 LeadSidebar 组件 */}
      <LeadSidebar
        userName={userName}
        isOpen={isLeadSidebarOpen} 
        onClose={() => setIsLeadSidebarOpen(false)} 
        onAddLead={(newLead: Partial<Lead>) => {
          // 将新线索转换为完整的Lead类型
          const completeLead: Partial<Lead> = {
            ...newLead,
            id: 0, // 临时ID,实际会由后端生成
            lastFollowTime: '-',
            nextFollowTime: '-',
            aiCall: false,
            planVisitTime: '-',
            latest_follow_id: undefined,
            latest_follow_type: undefined,
            latest_follow_time: undefined,
            latest_follower: undefined,
            latest_next_follow_time: undefined,
            latest_plan_visit_time: undefined,
            latest_follow_remark: undefined
          };
          // 确保completeLead包含所有必需的Lead属性
          if (completeLead && typeof completeLead.id === 'number') {
            handleAddLead(completeLead as Lead);
          }
        }}
      />
      
      {/* 添加线索详情侧拉抽屉 */}
      <LeadDetailSidebar 
        isOpen={isDetailSidebarOpen} 
        onClose={() => setIsDetailSidebarOpen(false)} 
        leadId={selectedLeadId}
      />
      {/* 添加任务创建侧拉抽屉 */}
      {/* 需要导入TaskSidebar组件 */}
      {/* 需要先导入 TaskSidebar 组件 */}
      {isTaskSidebarOpen && (
        <div className="task-sidebar">
          {/* 需要导入TaskSidebar组件 */}
          <TaskSidebar
            isOpen={isTaskSidebarOpen}
            onClose={() => setIsTaskSidebarOpen(false)}
            selectedLeads={getSelectedLeadsData()}
            onCreateTask={handleTaskCreate}
          />
        </div>
      )}
    </Layout>
  );
}