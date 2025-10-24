# DCC数字员工系统

## 📋 项目简介

DCC数字员工系统是一个智能化的客户关系管理平台，集成了任务管理、外呼系统、话术生成和跟进管理等功能。

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │───▶│  Next.js (3000) │    │  FastAPI (8000) │
│   (反向代理)     │    │   (前端)        │    │   (后端)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              └─────────┬──────────────┘
                                        ▼
                              ┌─────────────────┐
                              │   MySQL         │
                              │   (数据库)      │
                              └─────────────────┘
```

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- Nginx

### 本地开发
```bash
# 克隆项目
git clone <repository-url>
cd V1.0

# 后端开发
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 前端开发
cd dcc-digital-employee
npm install
npm run dev
```

### 生产部署
```bash
# 使用部署脚本
./deploy-simple.sh

# 或手动部署
# 1. 配置服务器环境
# 2. 部署后端服务
# 3. 部署前端服务
# 4. 配置Nginx
```

## 📁 项目结构

```
V1.0/
├── backend/                    # 后端代码
│   ├── api/                   # API接口
│   │   ├── auth.py           # 认证相关
│   │   ├── auto_call_api.py  # 外呼API
│   │   ├── dcc_leads.py      # 线索管理
│   │   └── ...
│   ├── database/              # 数据库相关
│   │   ├── db.py             # 数据库连接
│   │   └── *.sql             # SQL脚本
│   ├── main.py               # 主程序
│   └── requirements.txt      # Python依赖
├── dcc-digital-employee/      # 前端代码
│   ├── src/
│   │   ├── app/              # 页面组件
│   │   ├── components/       # 通用组件
│   │   ├── services/         # API服务
│   │   └── config/           # 配置文件
│   ├── package.json          # Node.js依赖
│   └── next.config.js        # Next.js配置
├── nginx.conf                # Nginx配置
├── deploy-simple.sh          # 部署脚本
├── restart-all.sh            # 重启脚本
└── DEPLOYMENT-CLEAN.md       # 详细部署文档
```

## 🌐 访问地址

- **生产环境**: https://campus.kongbaijiyi.com
- **开发环境**: http://localhost:3000
- **API文档**: https://campus.kongbaijiyi.com/docs

## 🔧 核心功能

### 🤖 智能Agent
- **任务Agent**: 智能任务分配和管理
- **话术生成Agent**: 个性化话术生成
- **外呼Agent**: 智能外呼系统
- **跟进Agent**: 客户跟进管理

### 📊 数据管理
- **线索管理**: 客户线索录入和管理
- **任务管理**: 外呼任务创建和监控
- **跟进记录**: 客户跟进历史记录
- **统计分析**: 数据统计和报表

### 🔐 安全认证
- **用户认证**: JWT Token认证
- **权限管理**: 基于角色的权限控制
- **数据加密**: 敏感数据加密存储

## 📝 配置说明

### 环境变量
- 前端配置: `dcc-digital-employee/src/config/environment.ts`
- 后端配置: `backend/config.py`

### 数据库配置
- 数据库名: `dcc_employee_db`
- 用户名: `dcc_user`
- 密码: `,Dcc123456`

## 🔧 维护命令

### 重启服务
```bash
# 完整重启
./restart-all.sh

# 单独重启
# 后端
cd backend && pkill -f "uvicorn" && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# 前端
cd dcc-digital-employee && pkill -f "next" && nohup npm start > frontend.log 2>&1 &

# Nginx
systemctl restart nginx
```

### 查看日志
```bash
# 后端日志
tail -f backend/backend.log

# 前端日志
tail -f dcc-digital-employee/frontend.log

# Nginx日志
tail -f /var/log/nginx/access.log
```

## 📊 监控和健康检查

- **后端健康检查**: `GET /api/health`
- **前端状态**: 访问首页检查
- **服务监控**: 进程和端口状态检查

## 🆘 故障排除

### 常见问题
1. **服务无法访问**: 检查防火墙和端口配置
2. **数据库连接失败**: 检查MySQL服务状态
3. **前端显示异常**: 检查Node.js进程和日志
4. **API调用失败**: 检查后端进程和日志

### 调试步骤
1. 检查服务进程状态
2. 查看错误日志
3. 验证网络连接
4. 检查配置文件

## 📚 文档

- [部署文档](DEPLOYMENT-CLEAN.md) - 详细的部署和维护指南
- [API文档](https://campus.kongbaijiyi.com/docs) - 在线API文档

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

本项目采用MIT许可证。

---

**最后更新**: 2025-08-08  
**版本**: V1.0  
**状态**: ✅ 生产环境运行中
