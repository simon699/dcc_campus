'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// 定义产品树类型
type ProductNode = {
  id: number;
  name: string;
  children?: ProductNode[];
};

// 定义线索详情类型
interface LeadDetail {
  id: number;
  name: string;
  phone: string;
  source: string;
  product: string;
  status: string;
  level: string;
  follower_name: string;
  lastFollowTime: string;
  nextFollowTime: string;
  aiCall: boolean;
  planVisitTime: string;
  createTime: string;
  remark: string;
}

// 定义跟进记录类型
interface FollowRecord {
  follow_id: number;
  follow_time: string;
  follower: string;
  follower_name: string;  // 添加跟进人姓名字段
  follow_type: number;
  next_follow_time: string;
  plan_visit_time: string;
  remark: string;
  product?: string;
}
  

interface LeadDetailSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number | null;
}

export default function LeadDetailSidebar({ isOpen, onClose, leadId }: LeadDetailSidebarProps) {
  const { theme } = useTheme();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [followRecords, setFollowRecords] = useState<FollowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingFollow, setIsAddingFollow] = useState(false);
  const [showAddFollowForm, setShowAddFollowForm] = useState(false);
  const [products, setProducts] = useState<ProductNode[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  
  // 新增跟进记录表单状态（去掉follow_type，增加product选择）
  const [newFollow, setNewFollow] = useState({
    next_follow_time: null as Date | null,
    plan_visit_time: null as Date | null,
    remark: '',
    product: '',
    client_level: null as number | null,
    clues_status: null as number | null
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (leadId) {
        fetchLeadDetail();
        fetchFollowRecords();
        fetchProducts(); // 添加获取产品数据
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, leadId]);

  // 获取线索详情
  const fetchLeadDetail = async () => {
    if (!leadId) return;
    
    setIsLoading(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/leads/query_with_latest_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          page: 1,
          page_size: 1000,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data && Array.isArray(data.data.leads_with_follows)) {
          const lead = data.data.leads_with_follows.find((item: any) => item.lead_info.id === leadId);
          if (lead) {
            const leadInfo = lead.lead_info;
            const follow = lead.latest_follow;
            
            setLeadDetail({
              id: leadInfo.id,
              name: leadInfo.client_name,
              phone: leadInfo.phone,
              source: leadInfo.source,
              product: leadInfo.product,
              status: leadInfo.clues_status_text,
              level: leadInfo.client_level_text,
              follower_name: follow ? follow.follower_name : (leadInfo.create_name || '-'),
              lastFollowTime: follow ? follow.follow_time : '-',
              nextFollowTime: follow ? follow.next_follow_time : '-',
              aiCall: follow ? follow.follow_type === 2 : false,
              planVisitTime: follow ? follow.plan_visit_time : '-',
              createTime: leadInfo.create_time,
              remark: follow ? follow.remark : '-'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching lead detail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取跟进记录
  const fetchFollowRecords = async () => {
    if (!leadId) return;
    
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/follows/${leadId}`, {
        headers: {
          'access-token': accessToken || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // 修改这里：处理实际的 API 响应格式
        if (data && data.data && Array.isArray(data.data.跟进记录)) {
          // 转换字段名称以匹配前端期望的格式
          const formattedRecords = data.data.跟进记录.map((record: any) => ({
            follow_id: record.id,
            follow_time: record.follow_time,
            follower: record.follower_id,           // 映射跟进人ID
            follower_name: record.follower_name,    // 添加跟进人姓名映射
            follow_type: record.follow_type,
            next_follow_time: record.next_follow_time,
            plan_visit_time: record.plan_visit_time,
            remark: record.remark
          }));
          setFollowRecords(formattedRecords);
        } else {
          console.log('No follow records found or invalid format:', data);
          setFollowRecords([]);
        }
      }
    } catch (error) {
      console.error('Error fetching follow records:', error);
    }
  };

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

  // 处理添加跟进记录（去掉follow_type，默认为手动跟进）
  const handleAddFollow = async () => {
    if (!leadId) return;
    
    setIsAddingFollow(true);
    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/create_follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': accessToken || '',
        },
        body: JSON.stringify({
          clues_id: leadId,
          follow_type: 1, // 固定为手动跟进
          next_follow_time: newFollow.next_follow_time,
          plan_visit_time: newFollow.plan_visit_time,
          remark: newFollow.remark,
          product: newFollow.product || undefined,
          client_level: newFollow.client_level || undefined,
          clues_status: newFollow.clues_status || undefined
        }),
      });
      
      if (response.ok) {
        // 重新获取数据
        await fetchLeadDetail();
        await fetchFollowRecords();
        
        // 重置表单
        setNewFollow({
          next_follow_time: null,
          plan_visit_time: null,
          remark: '',
          product: '',
          client_level: null,
          clues_status: null
        });
        setShowAddFollowForm(false);
        alert('跟进记录添加成功');
      } else {
        alert('添加跟进记录失败');
      }
    } catch (error) {
      console.error('Error adding follow record:', error);
      alert('添加跟进记录失败');
    } finally {
      setIsAddingFollow(false);
    }
  };

  const handleClose = () => {
    setShowAddFollowForm(false);
    setLeadDetail(null);
    setFollowRecords([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={handleClose}
      ></div>

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[1000px] lg:w-[1200px] border-l z-50 overflow-y-auto animate-slide-down ${
          theme === 'dark'
            ? 'bg-gray-900 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                线索详情
              </h3>
              <p className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                查看线索信息和跟进记录
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : leadDetail ? (
            <div className="space-y-6">
              {/* 线索信息卡片 */}
              <div className="saas-card">
                <h4 className={`text-md font-medium mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  线索信息
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      客户姓名
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.name}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      手机号
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.phone}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      来源
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.source}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      意向产品
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.product}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      线索状态
                    </label>
                    <span className={`badge ${
                      leadDetail.status === '已成交' ? 'badge-success' :
                      leadDetail.status === '已战败' ? 'badge-error' :
                      leadDetail.status === '已到店' ? 'badge-info' :
                      leadDetail.status === '跟进中' ? 'badge-warning' :
                      'badge-gray'
                    }`}>
                      {leadDetail.status}
                    </span>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      客户等级
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.level}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      跟进人
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.follower_name}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      创建时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.createTime}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      最新跟进时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.lastFollowTime}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      下次跟进时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.nextFollowTime}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      计划到店时间
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.planVisitTime}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      AI外呼
                    </label>
                    <span className={`badge ${
                      leadDetail.aiCall ? 'badge-success' : 'badge-gray'
                    }`}>
                      {leadDetail.aiCall ? '是' : '否'}
                    </span>
                  </div>
                </div>
                {leadDetail.remark && leadDetail.remark !== '-' && (
                  <div className="mt-4">
                    <label className={`block text-sm font-medium mb-1 ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      备注
                    </label>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {leadDetail.remark}
                    </p>
                  </div>
                )}
              </div>

              {/* 跟进记录 */}
              <div className="saas-card p-0 overflow-hidden">
                <div className={`p-6 flex justify-between items-center border-b ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <h4 className={`text-md font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    跟进记录
                  </h4>
                  <button
                    onClick={() => setShowAddFollowForm(!showAddFollowForm)}
                    className="btn-primary"
                  >
                    添加跟进
                  </button>
                </div>

                {/* 添加跟进记录表单 */}
                {showAddFollowForm && (
                  <div className={`p-6 border-b ${
                    theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <h5 className={`text-sm font-medium mb-4 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      添加跟进记录
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          意向产品
                        </label>
                        <select
                          value={newFollow.product}
                          onChange={(e) => setNewFollow(prev => ({ ...prev, product: e.target.value }))}
                          className="input-field"
                        >
                          <option value="">不更新</option>
                          {flattenProducts(products).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          客户等级
                        </label>
                        <select
                          value={newFollow.client_level || ''}
                          onChange={(e) => setNewFollow(prev => ({ ...prev, client_level: e.target.value ? parseInt(e.target.value) : null }))}
                          className="input-field"
                        >
                          <option value="">不更新</option>
                          <option value={1}>H级</option>
                          <option value={2}>A级</option>
                          <option value={3}>B级</option>
                          <option value={4}>C级</option>
                          <option value={5}>N级</option>
                          <option value={6}>O级</option>
                          <option value={7}>F级</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          下次跟进时间
                        </label>
                        <DatePicker
                          selected={newFollow.next_follow_time}
                          onChange={(date: Date | null) => setNewFollow(prev => ({ ...prev, next_follow_time: date }))}
                          className="input-field"
                          placeholderText="选择下次跟进时间"
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="yyyy-MM-dd HH:mm"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          计划到店时间
                        </label>
                        <DatePicker
                          selected={newFollow.plan_visit_time}
                          onChange={(date: Date | null) => setNewFollow(prev => ({ ...prev, plan_visit_time: date }))}
                          className="input-field"
                          placeholderText="选择计划到店时间"
                          showTimeSelect
                          timeFormat="HH:mm"
                          timeIntervals={15}
                          dateFormat="yyyy-MM-dd HH:mm"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          线索状态
                        </label>
                        <select
                          value={newFollow.clues_status || ''}
                          onChange={(e) => setNewFollow(prev => ({ ...prev, clues_status: e.target.value ? parseInt(e.target.value) : null }))}
                          className="input-field"
                        >
                          <option value="">不更新</option>
                          <option value={1}>未跟进</option>
                          <option value={2}>跟进中</option>
                          <option value={3}>已成交</option>
                          <option value={0}>已战败</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        跟进备注
                      </label>
                      <textarea
                        value={newFollow.remark}
                        onChange={(e) => setNewFollow(prev => ({ ...prev, remark: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="请输入跟进备注"
                        maxLength={500}
                      />
                    </div>
                    <div className="flex justify-end space-x-3 mt-4">
                      <button
                        onClick={() => setShowAddFollowForm(false)}
                        className="btn-secondary"
                        disabled={isAddingFollow}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddFollow}
                        className="btn-primary"
                        disabled={isAddingFollow}
                      >
                        {isAddingFollow ? '添加中...' : '添加跟进'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 跟进记录表格 */}
                <div className="overflow-auto max-h-[400px]">
                  <table className="w-full table-fixed">
                    <thead className={`${
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    }`}>
                      <tr>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '200px'}}>跟进时间</th>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '150px'}}>跟进人</th>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '150px'}}>跟进类型</th>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '200px'}}>下次跟进时间</th>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '200px'}}>计划到店时间</th>
                        <th className="px-2 py-2 text-left text-sm font-medium" style={{width: '200px'}}>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followRecords.length > 0 ? (
                        followRecords.map((record) => (
                          <tr key={record.follow_id} className="h-12 border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 text-sm" style={{width: '200px'}}>
                              <div className="truncate">{record.follow_time}</div>
                            </td>
                            <td className="px-2 py-1 text-sm" style={{width: '150px'}}>
                              <div className="truncate">{record.follower_name}</div>
                            </td>
                            <td className="px-2 py-1 text-sm" style={{width: '150px'}}>
                              <span className={`badge ${
                                record.follow_type === 2 ? 'badge-info' : 'badge-gray'
                              }`}>
                                {record.follow_type === 2 ? 'AI电话' : '手动跟进'}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-sm" style={{width: '200px'}}>
                              <div className="truncate">{record.next_follow_time || '-'}</div>
                            </td>
                            <td className="px-2 py-1 text-sm" style={{width: '200px'}}>
                              <div className="truncate">{record.plan_visit_time || '-'}</div>
                            </td>
                            <td className="px-2 py-1 text-sm relative" style={{width: '200px'}}>
                              <div 
                                className="truncate cursor-pointer hover:text-blue-600 transition-colors"
                                title={record.remark || '-'}
                                onMouseEnter={(e) => {
                                  if (record.remark && record.remark.length > 20) {
                                    const tooltip = document.createElement('div');
                                    tooltip.className = `absolute z-50 p-2 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs break-words ${
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-900'
                                    }`;
                                    tooltip.style.top = '-40px';
                                    tooltip.style.left = '0';
                                    tooltip.textContent = record.remark;
                                    tooltip.id = `tooltip-${record.follow_id}`;
                                    e.currentTarget.appendChild(tooltip);
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  const tooltip = document.getElementById(`tooltip-${record.follow_id}`);
                                  if (tooltip) {
                                    tooltip.remove();
                                  }
                                }}
                              >
                                {record.remark || '-'}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8">
                            暂无跟进记录
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className={`text-center py-8 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              未找到线索信息
            </div>
          )}
        </div>
      </div>
    </>
  );
}