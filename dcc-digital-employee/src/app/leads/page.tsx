'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import LeadSidebar from '@/components/LeadSidebar';
import LeadDetailSidebar from '@/components/LeadDetailSidebar';
import TaskSidebar from '@/components/TaskSidebar';

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
  const router = useRouter();
  const urlSearchParams = useSearchParams();
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

  // 添加状态码转换函数（移到这里）
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


  // 处理URL参数的函数
  const parseUrlParams = useCallback(() => {
    const params = {
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
    };

    // 处理日期参数
    const createTimeStart = urlSearchParams.get('createTimeStart');
    const createTimeEnd = urlSearchParams.get('createTimeEnd');
    const lastFollowTimeStart = urlSearchParams.get('lastFollowTimeStart');
    const lastFollowTimeEnd = urlSearchParams.get('lastFollowTimeEnd');
    const nextFollowTimeStart = urlSearchParams.get('nextFollowTimeStart');
    const nextFollowTimeEnd = urlSearchParams.get('nextFollowTimeEnd');
    
    if (createTimeStart) {
      params.createTimeStart = new Date(createTimeStart);
    }
    if (createTimeEnd) {
      params.createTimeEnd = new Date(createTimeEnd);
    }
    if (lastFollowTimeStart) {
      params.lastFollowTimeStart = new Date(lastFollowTimeStart);
    }
    if (lastFollowTimeEnd) {
      params.lastFollowTimeEnd = new Date(lastFollowTimeEnd);
    }
    if (nextFollowTimeStart) {
      params.nextFollowTimeStart = new Date(nextFollowTimeStart);
    }
    if (nextFollowTimeEnd) {
      params.nextFollowTimeEnd = new Date(nextFollowTimeEnd);
    }

    // 处理字符串参数
    const phone = urlSearchParams.get('phone');
    const level = urlSearchParams.get('level');
    const status = urlSearchParams.get('status');
    const product = urlSearchParams.get('product');
    const aiCall = urlSearchParams.get('aiCall');
    
    if (phone) {
      params.phone = phone;
    }
    if (level) {
      params.level = level;
    }
    if (status) {
      params.status = status;
    }
    if (product) {
      params.product = product;
    }
    if (aiCall) {
      params.aiCall = aiCall;
    }

    return params;
  }, [urlSearchParams]);

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
    
    // 解析URL参数并设置搜索条件
    const urlParams = parseUrlParams();
    const hasUrlParams = Object.values(urlParams).some(value => 
      value !== null && value !== '' && value !== undefined
    );
    
    if (hasUrlParams) {
      // 如果有URL参数，设置搜索条件并执行搜索
      setSearchParams(urlParams);
      // 延迟执行搜索，确保searchParams已更新
      setTimeout(() => {
        fetchLeads();
      }, 100);
    } else {
      // 如果没有URL参数，执行默认的无搜索条件查询
      fetchLeadsWithoutSearch();
    }
  }, []); // 移除 parseUrlParams 依赖，只在组件挂载时执行一次

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
          线索管理中心
        </h1>
        <p className="text-blue-300/80 text-lg">智能化线索管理，提升转化效率</p>
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

            {/* 最新跟进时间 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                最新跟进时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.lastFollowTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('lastFollowTimeStart', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.lastFollowTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('lastFollowTimeEnd', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 下次跟进时间 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                下次跟进时间
              </label>
              <div className="flex space-x-2">
                <DatePicker
                  selected={searchParams.nextFollowTimeStart}
                  onChange={(date: Date | null) => handleSearchChange('nextFollowTimeStart', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="开始时间"
                />
                <DatePicker
                  selected={searchParams.nextFollowTimeEnd}
                  onChange={(date: Date | null) => handleSearchChange('nextFollowTimeEnd', date)}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                  placeholderText="结束时间"
                />
              </div>
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                手机号
              </label>
              <input
                type="text"
                value={searchParams.phone}
                onChange={(e) => handleSearchChange('phone', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 placeholder-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                placeholder="请输入手机号"
              />
            </div>

            {/* 客户等级 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                客户等级
              </label>
              <select
                value={searchParams.level}
                onChange={(e) => handleSearchChange('level', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="" className="bg-slate-800">全部</option>
                <option value="H级" className="bg-slate-800">H级</option>
                <option value="A级" className="bg-slate-800">A级</option>
                <option value="B级" className="bg-slate-800">B级</option>
                <option value="C级" className="bg-slate-800">C级</option>
                <option value="N级" className="bg-slate-800">N级</option>
              </select>
            </div>

            {/* 线索状态 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                线索状态
              </label>
              <select
                value={searchParams.status}
                onChange={(e) => handleSearchChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="" className="bg-slate-800">全部</option>
                <option value="未跟进" className="bg-slate-800">未跟进</option>
                <option value="跟进中" className="bg-slate-800">跟进中</option>
                <option value="已到店" className="bg-slate-800">已到店</option>
                <option value="已战败" className="bg-slate-800">已战败</option>
                <option value="已成交" className="bg-slate-800">已成交</option>
              </select>
            </div>

            {/* 车型 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                车型
              </label>
              <select
                value={searchParams.product}
                onChange={(e) => handleSearchChange('product', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
                disabled={isLoadingProducts}
              >
                <option value="" className="bg-slate-800">
                  {isLoadingProducts ? '加载产品中...' : '全部'}
                </option>
                {flattenProducts(Array.isArray(products) ? products : []).map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-800">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* AI外呼 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-blue-300/90">
                AI外呼
              </label>
              <select
                value={searchParams.aiCall}
                onChange={(e) => handleSearchChange('aiCall', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 hover:border-blue-400/40"
              >
                <option value="" className="bg-slate-800">全部</option>
                <option value="true" className="bg-slate-800">是</option>
                <option value="false" className="bg-slate-800">否</option>
              </select>
            </div>
          </div>

          {/* 搜索按钮 */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-slate-700/50 border border-slate-500/30 rounded-lg text-slate-300 hover:text-white hover:border-slate-400/50 transition-all duration-300 hover:shadow-lg"
            >
              重置
            </button>
            <button
              onClick={() => fetchLeads()}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 border border-blue-500/30 rounded-lg text-white hover:from-blue-500 hover:to-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 列表区域 */}
        <div className="bg-gradient-to-r from-slate-800/50 to-blue-900/30 backdrop-blur-sm border border-blue-500/20 rounded-xl overflow-hidden shadow-xl min-w-[1000px]">
          {/* 操作按钮区域 */}
          <div className="p-6 flex justify-between items-center border-b border-blue-500/20">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCreateTask}
                disabled={selectedLeads.length === 0}
                className={selectedLeads.length === 0 
                  ? 'px-4 py-2 bg-slate-700/30 border border-slate-500/20 rounded-lg text-slate-500 cursor-not-allowed' 
                  : 'px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 border border-green-500/30 rounded-lg text-white hover:from-green-500 hover:to-emerald-500 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/25'
                }
              >
                创建任务
              </button>
              <span className="text-sm text-blue-300/80">
                已选择 <span className="text-blue-300 font-medium">{selectedLeads.length}</span> 项
              </span>
            </div>
            <button
              onClick={handleCreateLead}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 border border-blue-500/30 rounded-lg text-white hover:from-blue-500 hover:to-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
            >
              新建线索
            </button>
          </div>

          {/* 表格容器 */}          
          <div className="relative">
            {leads.length === 0 ? (
              // 空状态提示
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-blue-300/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-blue-300/90 mb-2">暂无线索数据</h3>
                  <p className="text-sm text-blue-300/60 mb-6">
                    当前筛选条件下没有找到相关线索，您可以：
                  </p>
                  <div className="space-y-2 text-sm text-blue-300/70">
                    <p>• 调整筛选条件重新搜索</p>
                    <p>• 清空筛选条件查看全部线索</p>
                    <p>• 创建新的线索</p>
                  </div>
                  <div className="mt-6 flex justify-center space-x-3">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-slate-700/50 border border-slate-500/30 rounded-lg text-slate-300 hover:text-white hover:border-slate-400/50 transition-all duration-300"
                    >
                      重置筛选
                    </button>
                    <button
                      onClick={handleCreateLead}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 border border-blue-500/30 rounded-lg text-white hover:from-blue-500 hover:to-purple-500 transition-all duration-300"
                    >
                      新建线索
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // 原有的表格内容
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full table-fixed" style={{ minWidth: '1200px' }}>
                  <thead className="bg-gradient-to-r from-slate-800/80 to-blue-900/50">
                  <tr>
                    {/* 固定列：选择框 */}
                    <th className="sticky left-0 z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded bg-slate-700/50 border-blue-500/30 text-blue-500 focus:ring-blue-500/50"
                      />
                    </th>
                    {/* 固定列：姓名 */}
                    <th className="sticky left-[50px] z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '100px' }}>姓名</th>
                    {/* 固定列：手机号 */}
                    <th className="sticky left-[150px] z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '120px' }}>手机号</th>
                    {/* 其他列 */}
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>来源</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '200px' }}>意向产品</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>线索状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>客户等级</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '100px' }}>跟进人</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '230px' }}>最新跟进时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '230px' }}>下次跟进时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '80px' }}>AI外呼</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '230px' }}>计划到店时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '230px' }}>创建时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-blue-300" style={{ width: '200px' }}>备注</th>
                    {/* 固定列：详情 */}
                    <th className="sticky right-0 z-20 px-4 py-3 text-left text-sm font-medium text-blue-300 bg-gradient-to-r from-slate-800/80 to-blue-900/50" style={{ width: '100px' }}>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr key={lead.id} className="hover:bg-gradient-to-r hover:from-blue-900/20 hover:to-purple-900/20 transition-all duration-300 border-b border-blue-500/10">
                      {/* 固定列：选择框 */}
                      <td className="sticky left-0 z-10 px-4 py-3 bg-gradient-to-r from-slate-800/60 to-blue-900/40">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                          className="rounded bg-slate-700/50 border-blue-500/30 text-blue-500 focus:ring-blue-500/50"
                        />
                      </td>
                      {/* 固定列：姓名 */}
                      <td className="sticky left-[50px] z-10 px-4 py-3 bg-gradient-to-r from-slate-800/60 to-blue-900/40 text-blue-100">{lead.name}</td>
                      {/* 固定列：手机号 */}
                      <td className="sticky left-[150px] z-10 px-4 py-3 bg-gradient-to-r from-slate-800/60 to-blue-900/40 text-blue-100">{lead.phone}</td>
                      {/* 其他列 */}
                      <td className="px-4 py-3 text-blue-100">{lead.source}</td>
                      <td className="px-4 py-3 text-blue-100">{lead.product}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.status === '已成交' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                          lead.status === '已战败' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                          lead.status === '已到店' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                          lead.status === '跟进中' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                          'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        }`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-100">{lead.level}</td>
                      <td className="px-4 py-3 text-blue-100">{lead.follower}</td>
                      <td className="px-4 py-3 text-blue-100">{lead.lastFollowTime}</td>
                      <td className="px-4 py-3 text-blue-100">{lead.nextFollowTime}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.aiCall ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                        }`}>
                          {lead.aiCall ? '是' : '否'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-100">{lead.planVisitTime}</td>
                      <td className="px-4 py-3 text-blue-100">{lead.createTime}</td>
                      {/* 备注列：添加鼠标悬停显示完整内容 */}
                      <td className="px-4 py-3">
                        <div className="relative group">
                          <div className="truncate max-w-[180px] text-blue-100">{lead.remark || '-'}</div>
                          {lead.remark && (
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-slate-800/90 backdrop-blur-sm border border-blue-500/30 p-2 rounded-lg shadow-xl z-50 max-w-md text-blue-100">
                              {lead.remark}
                            </div>
                          )}
                        </div>
                      </td>
                      {/* 固定列：详情 */}
                      <td className="sticky right-0 z-10 px-4 py-3 bg-gradient-to-r from-slate-800/60 to-blue-900/40">
                        <button 
                          onClick={() => handleViewLeadDetail(lead.id)}
                          className="px-3 py-1 text-sm bg-gradient-to-r from-blue-600/50 to-purple-600/50 border border-blue-500/30 rounded-lg text-blue-300 hover:text-white hover:from-blue-500/70 hover:to-purple-500/70 transition-all duration-300"
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
          


          {/* 分页 */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-blue-500/20">
            <div className="flex-1 flex justify-between sm:hidden">
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
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'opacity-50 cursor-not-allowed text-slate-500'
                        : 'hover:bg-blue-600/20 text-blue-300 hover:text-white'
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
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            : 'hover:bg-blue-600/20 text-blue-300 hover:text-white'
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
                        ? 'opacity-50 cursor-not-allowed text-slate-500'
                        : 'hover:bg-blue-600/20 text-blue-300 hover:text-white'
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
    </div>
  </div>
  );
}