# 阿里云ACR部署指南

## 概述

本项目已配置GitHub Actions自动构建和推送到阿里云容器镜像服务ACR。每次推送到main分支时，会自动构建Docker镜像并推送到ACR。

## 部署流程

### 1. GitHub Secrets配置

在GitHub仓库设置中添加以下Secrets：

1. 进入GitHub仓库 → Settings → Secrets and variables → Actions
2. 点击"New repository secret"
3. 添加以下Secrets：

| Secret名称 | 描述 | 获取方式 |
|-----------|------|----------|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 阿里云访问密钥ID | 阿里云控制台 → RAM → 用户 → 创建AccessKey |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云访问密钥Secret | 同上 |

### 2. 阿里云ACR配置

#### 创建容器镜像仓库

1. 登录阿里云控制台
2. 进入容器镜像服务ACR
3. 创建命名空间（如：dcc-campus）
4. 创建镜像仓库：
   - 仓库名称：frontend
   - 仓库类型：公开
   - 摘要：DCC数字员工前端应用

   - 仓库名称：backend
   - 仓库类型：公开
   - 摘要：DCC数字员工后端API服务

#### 获取ACR登录信息

```bash
# 获取ACR登录命令
docker login registry.cn-hangzhou.aliyuncs.com
```

### 3. 自动部署

推送代码到main分支后，GitHub Actions会自动：

1. **构建镜像**
   - 前端镜像：`registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/frontend:commit-sha`
   - 后端镜像：`registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:commit-sha`

2. **推送镜像**
   - 自动推送到阿里云ACR
   - 使用commit SHA作为标签

3. **运行测试**
   - 前端代码检查
   - 后端依赖安装测试

## 手动部署

### 1. 本地构建和推送

```bash
# 登录阿里云ACR
docker login registry.cn-hangzhou.aliyuncs.com

# 构建前端镜像
docker build -t registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/frontend:latest ./dcc-digital-employee

# 构建后端镜像
docker build -t registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:latest ./backend

# 推送镜像
docker push registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/frontend:latest
docker push registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:latest
```

### 2. 从ACR拉取镜像

```bash
# 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/frontend:latest
docker pull registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:latest
```

## 部署到服务器

### 1. 使用ACR镜像的docker-compose配置

创建 `docker-compose.acr.yml`：

```yaml
version: '3.8'

services:
  # 后端API服务
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:latest
    container_name: dcc-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - DB_HOST=${DB_HOST}
      - DB_PORT=${DB_PORT}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - ALIBABA_CLOUD_ACCESS_KEY_ID=${ALIBABA_CLOUD_ACCESS_KEY_ID}
      - ALIBABA_CLOUD_ACCESS_KEY_SECRET=${ALIBABA_CLOUD_ACCESS_KEY_SECRET}
      - INSTANCE_ID=${INSTANCE_ID}
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
      - ALIBAILIAN_APP_ID=${ALIBAILIAN_APP_ID}
      - SCENE_ID_API_URL=${SCENE_ID_API_URL}
      - EXTERNAL_API_TOKEN=${EXTERNAL_API_TOKEN}
    networks:
      - dcc-network

  # 前端应用服务
  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/frontend:latest
    container_name: dcc-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_BASE_URL=https://campus.kongbaijiyi.com/api
    depends_on:
      - backend
    networks:
      - dcc-network

  # Nginx反向代理服务
  nginx:
    image: nginx:alpine
    container_name: dcc-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - dcc-network

networks:
  dcc-network:
    driver: bridge
```

### 2. 服务器部署

```bash
# 登录阿里云ACR
docker login registry.cn-hangzhou.aliyuncs.com

# 使用ACR镜像启动服务
docker-compose -f docker-compose.acr.yml up -d
```

## 监控和日志

### 1. GitHub Actions监控

- 访问GitHub仓库 → Actions
- 查看构建和部署状态
- 检查构建日志

### 2. 阿里云ACR监控

- 登录阿里云控制台
- 进入容器镜像服务ACR
- 查看镜像推送历史
- 监控镜像大小和层数

### 3. 服务器监控

```bash
# 查看容器状态
docker-compose -f docker-compose.acr.yml ps

# 查看日志
docker-compose -f docker-compose.acr.yml logs -f

# 查看镜像信息
docker images | grep registry.cn-hangzhou.aliyuncs.com
```

## 故障排除

### 1. GitHub Actions失败

**常见问题：**
- Secrets未配置
- 网络连接问题
- Dockerfile语法错误

**解决方案：**
- 检查GitHub Secrets配置
- 查看Actions日志
- 验证Dockerfile语法

### 2. ACR推送失败

**常见问题：**
- 认证失败
- 网络连接问题
- 镜像大小超限

**解决方案：**
- 检查AccessKey配置
- 验证网络连接
- 优化镜像大小

### 3. 服务器部署失败

**常见问题：**
- 镜像拉取失败
- 环境变量未配置
- 端口冲突

**解决方案：**
- 检查ACR登录状态
- 验证环境变量
- 检查端口占用

## 最佳实践

### 1. 镜像优化

- 使用多阶段构建
- 减少镜像层数
- 清理不必要的文件

### 2. 安全配置

- 使用私有镜像仓库
- 定期更新基础镜像
- 扫描镜像漏洞

### 3. 监控告警

- 设置构建失败告警
- 监控镜像推送状态
- 配置服务器监控

## 版本管理

### 1. 标签策略

- `latest`：最新稳定版本
- `commit-sha`：特定提交版本
- `v1.0.0`：语义化版本

### 2. 回滚策略

```bash
# 回滚到特定版本
docker-compose -f docker-compose.acr.yml down
docker pull registry.cn-hangzhou.aliyuncs.com/simon699/dcc_campus/backend:v1.0.0
docker-compose -f docker-compose.acr.yml up -d
```
