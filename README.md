# DCC数字员工系统

## 项目简介

DCC数字员工系统是一个基于Docker的微服务架构应用，包含前端、后端和数据库服务。

## 项目结构

```
V1.0/
├── backend/                 # 后端服务
│   ├── api/                # API接口
│   ├── database/           # 数据库脚本
│   ├── openAPI/           # 外部API集成
│   ├── utils/             # 工具函数
│   └── main.py            # 主程序
├── dcc-digital-employee/   # 前端服务
│   ├── src/               # 源代码
│   ├── components/        # React组件
│   └── package.json       # 依赖配置
├── docker-compose.yml     # Docker编排配置
├── Dockerfile             # 主Dockerfile
├── configure_env.sh       # 环境配置脚本
├── local-test.sh          # 本地测试脚本
└── README.md              # 项目说明
```

## 快速开始

### 1. 环境配置

```bash
# 运行环境配置脚本
./configure_env.sh
```

### 2. 本地测试

```bash
# 运行本地测试
./local-test.sh
```

### 3. 手动部署

```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 开发环境设置

### 前端开发
```bash
cd dcc-digital-employee
npm install
npm run dev
```

### 后端开发
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py
```

## 服务说明

### 后端服务 (Port: 8000)
- 基于FastAPI的RESTful API
- 支持JWT认证
- 集成阿里云和阿里百炼服务
- 健康检查端点: `/health`

### 前端服务 (Port: 3000)
- 基于Next.js的React应用
- 现代化UI界面
- 响应式设计

### 数据库服务 (Port: 3306)
- MySQL 8.0数据库
- 自动初始化脚本
- 数据持久化存储

## 环境变量配置

主要环境变量包括：

```bash
# 数据库配置
DB_PASSWORD=your_database_password
DB_NAME=dcc_employee_db

# JWT配置
JWT_SECRET_KEY=your_jwt_secret_key

# 阿里云配置
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id

# 阿里百炼配置
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id
```

## 项目清理说明

为了减小项目大小，以下文件已被清理并添加到 `.gitignore`：

- `node_modules/` - 前端依赖包（可通过 `npm install` 重新安装）
- `venv/` - Python虚拟环境（可通过 `python -m venv venv` 重新创建）
- `__pycache__/` - Python缓存文件
- `*.pyc` - Python编译文件
- `*.tmp` - 临时文件

## 部署说明

### 本地开发环境
1. 运行 `./configure_env.sh` 配置环境变量
2. 运行 `./local-test.sh` 启动本地测试

### 生产环境部署
1. 配置生产环境变量
2. 使用 `docker-compose up -d` 启动服务
3. 配置反向代理和SSL证书

## 监控和维护

### 健康检查
```bash
# 检查后端健康状态
curl http://localhost:8000/health

# 检查数据库连接
docker-compose exec mysql mysqladmin ping -h localhost
```

### 日志查看
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
```

## 故障排除

### 常见问题

1. **服务启动失败**
   - 检查环境变量配置
   - 查看服务日志: `docker-compose logs`

2. **数据库连接失败**
   - 检查数据库服务状态
   - 验证数据库配置参数

3. **前端无法访问后端**
   - 检查网络配置
   - 验证API地址配置

## 技术支持

如有问题，请查看：
- 服务日志: `docker-compose logs`
- 健康检查: `curl http://localhost:8000/health`
- 环境配置: `./configure_env.sh`

---

**注意**: 首次部署时，请确保所有必需的环境变量都已正确配置。
