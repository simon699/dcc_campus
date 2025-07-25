'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Define the Lead type
type Lead = {
  id?: number;
  name: string;
  phone: string;
  product: string;
  level: string;
  status: string;
  source: string;
  follower?: string;
};

// Define product tree types
type ProductNode = {
  id: number;
  name: string;
  children?: ProductNode[];
};

// Define API response types based on backend implementation
type ApiSuccessResponse = {
  status: 'success';
  code: 1000;
  message: string;
  data: {
    id: number;
    organ_id: string;
    client_name: string;
    phone: string;
    source: string;
    product_id: number;
    product_name: string;
    clues_status: number;
    client_level: number;
    create_time: string;
  };
};

type ApiDuplicateResponse = {
  status: 'duplicate';
  code: 1001;
  message: string;
  data: {
    existing_id: number;
    phone: string;
  };
};

type ApiErrorResponse = {
  status: 'error';
  code: number;
  message: string;
  detail?: {
    message: string;
  };
};

type ApiResponse = ApiSuccessResponse | ApiDuplicateResponse | ApiErrorResponse;

type LeadSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddLead: (lead: Omit<Lead, 'id'>) => void;
  userName: string; // Current logged in user
};

export default function LeadSidebar({ isOpen, onClose, onAddLead, userName }: LeadSidebarProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [product, setProduct] = useState('');
  const [level, setLevel] = useState('N级');
  const [status, setStatus] = useState('未跟进');
  const [source, setSource] = useState('懂车帝');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [products, setProducts] = useState<ProductNode[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // 获取产品信息
      fetchProducts();
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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

  const handleClose = () => {
    onClose();
  };

  const clearForm = () => {
    setName('');
    setPhone('');
    setProduct('');
    setLevel('N级');
    setStatus('未跟进');
    setSource('懂车帝');
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (name && phone && product) {
      // Validate phone number is 11 digits
      if (!/^\d{11}$/.test(phone)) {
        setErrorMessage('请输入11位手机号码');
        return;
      }

      // Find product_id from product name
      const findProductId = (nodes: ProductNode[], targetName: string): number | null => {
        for (const node of nodes) {
          if (node.name === targetName) {
            return node.id;
          }
          if (node.children) {
            const found = findProductId(node.children, targetName);
            if (found) return found;
          }
        }
        return null;
      };

      const productId = findProductId(products, product);
      if (!productId) {
        setErrorMessage('请选择有效的产品');
        return;
      }

      setIsSubmitting(true);

      try {
        // 获取access token和组织ID
        // 从localStorage获取token并解析
        const accessToken = localStorage.getItem('access_token');
        
        // 尝试解析JWT token
         let  organizationId = null;
         let user_id = null
        try {
          const tokenParts = accessToken?.split('.');
          if (tokenParts && tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            // 从payload中获取organization_id
            organizationId = payload.organization_id;
            user_id = payload.user_id;
            
          }
        } catch (error) {
          console.error('Token解析失败:', error);
        }
        const response = await fetch('http://localhost:8000/api/create_leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access-token': accessToken || '', // 确保包含access-token
          },
          body: JSON.stringify({
            organization_id: organizationId,
            client_name: name,
            phone: phone,
            source: source,
            product_id: productId,
            clues_status: 1, // 默认未跟进状态
            client_level: 5,   // 默认 N 级客户
            create_name: user_id, // 从JWT token中获取用户ID作为创建人
          }),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
          // Success - new lead created
          onAddLead({
            name,
            phone,
            product,
            level,
            status,
            source,
            follower: userName
          });

          // Show success message
          alert('创建成功');

          // Clear form
          clearForm();
        } else if (result.status === 'duplicate') {
          // Duplicate phone number
          const { existing_id, phone: existingPhone } = result.data;
          setErrorMessage(`手机号已存在，对应线索ID: ${existing_id}, 手机号: ${existingPhone}`);
        } else {
          // Other error
          const errorMsg = result.detail?.message || result.message || '创建失败，请稍后重试';
          setErrorMessage(errorMsg);
        }
      } catch (error) {
        setErrorMessage('网络错误，请稍后重试');
        console.error('Error submitting lead:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={handleClose}
      ></div>

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] border-l z-50 overflow-y-auto animate-slide-down ${theme === 'dark'
          ? 'bg-gray-900 border-gray-700'
          : 'bg-white border-gray-200'
          }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                新增线索
              </h3>
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                添加新的销售线索信息
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark'
                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  姓名 *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="请输入客户姓名"
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  手机号 *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="[0-9]{11}"
                  className="input-field"
                  placeholder="请输入11位手机号码"
                  required
                />
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                  请输入11位有效手机号码
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  意向产品 *
                </label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="input-field"
                  required
                  disabled={isLoadingProducts}
                >
                  <option value="">
                    {isLoadingProducts ? '加载产品中...' : '请选择产品'}
                  </option>
                  {flattenProducts(Array.isArray(products) ? products : []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {isLoadingProducts && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                    正在获取产品信息...
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  客户等级
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {['H级', 'A级', 'B级', 'C级', 'N级'].map((option) => (
                    <label key={option} className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${level === option
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}>
                      <input
                        type="radio"
                        name="level"
                        value={option}
                        checked={level === option}
                        onChange={() => setLevel(option)}
                        className="sr-only"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  客户状态
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['未跟进', '跟进中', '已到店', '已战败', '已成交'].map((option) => (
                    <label key={option} className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${status === option
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-blue-400 text-gray-300 hover:text-blue-300'
                        : 'border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-600'
                      }`}>
                      <input
                        type="radio"
                        name="status"
                        value={option}
                        checked={status === option}
                        onChange={() => setStatus(option)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  客户来源
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['懂车帝', '易车网', '汽车之家'].map((option) => (
                    <label key={option} className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${source === option
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-blue-400 text-gray-300 hover:text-blue-300'
                        : 'border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-600'
                      }`}>
                      <input
                        type="radio"
                        name="source"
                        value={option}
                        checked={source === option}
                        onChange={() => setSource(option)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`p-4 rounded-lg border ${theme === 'dark' 
                ? 'bg-blue-900/10 border-blue-500/30' 
                : 'bg-blue-50 border-blue-200'
                }`}>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                    }`}>
                    跟进人: <span className="font-medium">{userName}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    提交中...
                  </div>
                ) : (
                  '提交'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}