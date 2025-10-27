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
                              │   MySQL RDS     │
                              │   (阿里云数据库) │
                              └─────────────────┘
```

## 🚀 快速部署

### 阿里云部署

1. **准备环境**
   - 阿里云ECS服务器（Ubuntu 20.04+）
   - 阿里云RDS MySQL数据库
   - 配置好.env环境变量文件

2. **执行部署**
   ```bash
   # 上传项目到服务器
   git clone <repository-url> /opt/dcc_campus
   
   # 登录服务器
   ssh user@your-server
   
   # 进入项目目录
   cd /opt/dcc_campus/dcc_campus
   
   # 执行部署脚本
   ./deploy-aliyun.sh
   ```

3. **访问系统**
   - 主站: `http://campus.kongbaijiyi.com`
   - API文档: `http://campus.kongbaijiyi.com/docs`
   - 健康检查: `http://campus.kongbaijiyi.com/api/health`

### 本地开发

```bash
# 后端开发
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 前端开发
cd dcc-digital-employee
npm install
npm run dev
```

## 📁 项目结构

```
V1.0/
├── backend/                    # 后端代码
│   ├── api/                   # API接口
│   ├── database/              # 数据库相关
│   ├── Dockerfile.china       # 中国版Dockerfile
│   └── requirements.txt       # Python依赖
├── dcc-digital-employee/      # 前端代码
│   ├── src/                   # 源代码
│   └── Dockerfile             # 前端Dockerfile
├── docker-compose-china.yml   # 中国版Docker Compose
├── nginx-docker.conf          # Nginx配置
├── deploy-aliyun.sh           # 阿里云部署脚本
├── deploy-simple.sh           # 简化部署脚本
└── .env                       # 环境变量配置
```

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

## 📝 环境配置

### 环境变量 (.env)
```bash
# 数据库配置
DB_HOST=your-rds-host.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=dcc_employee_db

# JWT配置
JWT_SECRET_KEY=your-secret-key
JWT_EXPIRE_HOURS=24

# 阿里云配置
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_secret_key
INSTANCE_ID=your_instance_id
DASHSCOPE_API_KEY=your_dashscope_key
ALIBAILIAN_APP_ID=your_app_id

# 前端配置
NEXT_PUBLIC_API_BASE_URL=http://campus.kongbaijiyi.com/api
```

## 🔧 管理命令

部署完成后，可以使用以下管理脚本：

```bash
# 查看服务状态
./check-status.sh

# 重启服务
./restart-services.sh

# 停止服务
./stop-services.sh

# 查看日志
./view-logs.sh
```

## 📊 监控和健康检查

- **后端健康检查**: `GET /api/health`
- **前端状态**: 访问首页检查
- **服务监控**: `docker-compose -f docker-compose-china.yml ps`

## 🆘 故障排除

### 常见问题
1. **服务无法访问**: 检查防火墙和端口配置
2. **数据库连接失败**: 检查RDS连接信息和网络
3. **前端显示异常**: 检查Docker容器状态
4. **API调用失败**: 检查后端容器日志

### 调试步骤
1. 检查Docker容器状态: `docker-compose -f docker-compose-china.yml ps`
2. 查看错误日志: `docker-compose -f docker-compose-china.yml logs`
3. 验证网络连接: `curl http://localhost/api/health`
4. 检查配置文件: 验证.env文件配置

## 📚 技术栈

- **前端**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **后端**: Python FastAPI + SQLAlchemy + Pydantic
- **数据库**: MySQL 8.0 (阿里云RDS)
- **容器**: Docker + Docker Compose
- **反向代理**: Nginx
- **部署**: 阿里云ECS + Docker

## 🤝 贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

本项目采用MIT许可证。

---

**最后更新**: 2025-01-27  
**版本**: V1.0  
**状态**: ✅ 生产环境运行中