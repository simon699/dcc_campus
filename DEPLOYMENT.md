# DCC数字员工系统部署指南

## 项目概述

本项目是一个全栈应用，包含：
- 前端：Next.js React应用
- 后端：FastAPI Python服务
- 数据库：MySQL 8.0
- 反向代理：Nginx

## 服务器和域名信息
- 服务器IP：47.103.27.235
- 域名：campus.kongbaijiyi.com
- 访问地址：https://campus.kongbaijiyi.com

## 部署方式

### 1. 使用Docker Compose

#### 本地开发环境
```bash
# 使用包含MySQL的完整配置
docker-compose up -d
```

#### 生产环境
```bash
# 使用外部MySQL服务器的配置
docker-compose -f docker-compose.prod.yml up -d
```

#### 准备工作

1. 安装Docker和Docker Compose
2. 复制环境变量文件：
   ```bash
   cp env.example .env
   ```

3. 编辑`.env`文件，配置必要的环境变量：
   - 数据库配置（本地开发使用Docker MySQL，生产环境使用外部MySQL）
   - 阿里云API密钥
   - JWT密钥等

#### 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 访问应用

- 前端应用：http://localhost:3000
- 后端API：http://localhost:8000
- 通过Nginx：http://localhost:80
- 生产环境：https://campus.kongbaijiyi.com

### 2. 部署到阿里云ACR

#### GitHub Actions自动部署

1. 在GitHub仓库设置中添加以下Secrets：
   - `ALIBABA_CLOUD_ACCESS_KEY_ID`：阿里云访问密钥ID
   - `ALIBABA_CLOUD_ACCESS_KEY_SECRET`：阿里云访问密钥Secret

2. 推送代码到main分支，GitHub Actions会自动：
   - 构建Docker镜像
   - 推送到阿里云ACR
   - 运行测试

#### 手动部署

1. 登录阿里云ACR：
   ```bash
   docker login registry.cn-hangzhou.aliyuncs.com
   ```

2. 构建镜像：
   ```bash
   # 构建前端镜像
   docker build -t registry.cn-hangzhou.aliyuncs.com/your-namespace/frontend:latest ./dcc-digital-employee
   
   # 构建后端镜像
   docker build -t registry.cn-hangzhou.aliyuncs.com/your-namespace/backend:latest ./backend
   ```

3. 推送镜像：
   ```bash
   docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/frontend:latest
   docker push registry.cn-hangzhou.aliyuncs.com/your-namespace/backend:latest
   ```

### 3. 生产环境部署

#### 使用阿里云容器服务ACK

1. 创建Kubernetes集群
2. 部署MySQL数据库（或使用阿里云RDS）
3. 部署应用服务

#### 使用阿里云ECS

1. 在ECS上安装Docker和Docker Compose
2. 上传项目文件
3. 配置环境变量
4. 使用docker-compose启动服务

## 环境变量配置

### 本地开发环境（使用Docker MySQL）

```bash
# 数据库配置（Docker容器）
DB_HOST=mysql
DB_PORT=3306
DB_USER=dcc_user
DB_PASSWORD=dcc123456
DB_NAME=dcc_employee_db
```

### 生产环境（使用外部MySQL服务器）

```bash
# 数据库配置（外部MySQL服务器）
DB_HOST=your-mysql-server.com
DB_PORT=3306
DB_USER=dcc_user
DB_PASSWORD=your-strong-password
DB_NAME=dcc_employee_db
```

# JWT配置
JWT_SECRET_KEY=your-secret-key

# 阿里云配置
ALIBABA_CLOUD_ACCESS_KEY_ID=your-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your-access-key-secret
INSTANCE_ID=your-instance-id

# 阿里百炼配置
DASHSCOPE_API_KEY=your-dashscope-api-key
ALIBAILIAN_APP_ID=your-alibailian-app-id
```

### 可选的环境变量

```bash
# 外部API配置
SCENE_ID_API_URL=https://your-external-api.com/get-scene-id
EXTERNAL_API_TOKEN=your-external-api-token

# 前端配置
NEXT_PUBLIC_API_BASE_URL=https://campus.kongbaijiyi.com/api
```

## 健康检查

- 后端健康检查：`GET /health`
- 前端健康检查：`GET /`

## 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql
docker-compose logs nginx
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否启动
   - 验证数据库连接参数
   - 确认网络连接

2. **前端无法访问后端API**
   - 检查Nginx配置
   - 验证API路由配置
   - 确认CORS设置

3. **镜像构建失败**
   - 检查Dockerfile语法
   - 验证依赖文件完整性
   - 确认网络连接

### 调试命令

```bash
# 进入容器调试
docker-compose exec backend bash
docker-compose exec frontend sh

# 查看容器资源使用
docker stats

# 重启服务
docker-compose restart backend
```

## 域名和SSL配置

### 1. DNS配置
参考 `DNS-SETUP.md` 文件配置域名解析。

### 2. SSL证书配置
```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

### 3. MySQL数据库配置

#### 使用外部MySQL服务器
```bash
# 初始化MySQL数据库
chmod +x init-mysql.sh
./init-mysql.sh your-mysql-server.com 3306 your-root-password
```

#### 使用阿里云RDS
1. 在阿里云控制台创建RDS MySQL实例
2. 获取连接地址和端口
3. 配置环境变量中的数据库连接信息

### 4. 服务器部署
```bash
chmod +x deploy-server.sh
./deploy-server.sh deploy
```

## 安全建议

1. 生产环境必须修改默认密码
2. 使用强密码和密钥
3. 配置HTTPS（已包含在部署脚本中）
4. 定期更新依赖包
5. 监控系统日志

## 性能优化

1. 启用Nginx缓存
2. 配置数据库连接池
3. 使用CDN加速静态资源
4. 启用Gzip压缩
5. 配置适当的资源限制
