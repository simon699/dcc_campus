# DCC数字员工系统 - 域名部署配置

## 域名信息

- **主域名**: campus.kongbaijiyi.com
- **重定向域名**: kongbaijiyi.com → campus.kongbaijiyi.com
- **服务器IP**: 47.103.27.235

## 配置更新总结

### 1. Nginx配置更新 ✅

**文件**: `nginx-docker.conf`

更新了CORS设置以支持域名访问：
```nginx
# CORS头设置 - 支持域名访问
add_header Access-Control-Allow-Origin "http://campus.kongbaijiyi.com" always;
```

**域名重定向配置**:
```nginx
# 将kongbaijiyi.com重定向到campus.kongbaijiyi.com
server {
    listen 80;
    server_name kongbaijiyi.com;
    return 301 http://campus.kongbaijiyi.com$request_uri;
}
```

### 2. 环境变量配置更新 ✅

**文件**: `env.production`

```bash
# 前端配置 - 使用域名
NEXT_PUBLIC_API_BASE_URL=http://campus.kongbaijiyi.com/api

# 部署配置 - 使用域名
SERVER_DOMAIN=campus.kongbaijiyi.com
```

### 3. Docker Compose配置更新 ✅

**文件**: `docker-compose-fast.yml`

```yaml
environment:
  NODE_ENV: production
  DOCKER_ENV: "true"
  NEXT_PUBLIC_API_BASE_URL: http://campus.kongbaijiyi.com/api
```

### 4. 部署脚本更新 ✅

**文件**: `server-deploy.sh`

- 更新了环境变量模板中的域名配置
- 更新了访问地址显示
- 更新了验证部署的URL

## 访问地址

### 生产环境访问地址

- **前端应用**: http://campus.kongbaijiyi.com
- **后端API**: http://campus.kongbaijiyi.com/api
- **API文档**: http://campus.kongbaijiyi.com/docs
- **ReDoc文档**: http://campus.kongbaijiyi.com/redoc

### 域名重定向

- **kongbaijiyi.com** → **campus.kongbaijiyi.com** (自动重定向)

## 阿里云配置

已配置的阿里云密钥信息：

```bash
# 阿里云访问密钥（请替换为实际值）
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id

# 阿里百炼配置（请替换为实际值）
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id
```

## 部署步骤

### 1. 本地测试部署

```bash
# 使用本地部署脚本
./local-deploy.sh
```

**本地访问地址**:
- 前端: http://localhost
- 后端: http://localhost/api
- 文档: http://localhost/docs

### 2. 服务器生产部署

```bash
# 使用服务器部署脚本
./server-deploy.sh
```

**生产访问地址**:
- 前端: http://campus.kongbaijiyi.com
- 后端: http://campus.kongbaijiyi.com/api
- 文档: http://campus.kongbaijiyi.com/docs

## 域名解析要求

确保域名解析配置正确：

```
campus.kongbaijiyi.com → 47.103.27.235
kongbaijiyi.com → 47.103.27.235
```

## 安全配置

### CORS配置

已配置CORS以支持域名访问：
- 允许来源: `http://campus.kongbaijiyi.com`
- 支持的方法: GET, POST, PUT, DELETE, OPTIONS
- 支持的头部: Origin, X-Requested-With, Content-Type, Accept, Authorization, access-token

### 安全头配置

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 验证部署

### 1. 检查域名解析

```bash
# 检查域名解析
nslookup campus.kongbaijiyi.com
ping campus.kongbaijiyi.com
```

### 2. 检查服务状态

```bash
# 检查HTTP响应
curl -I http://campus.kongbaijiyi.com
curl -I http://campus.kongbaijiyi.com/api/health
```

### 3. 检查API文档

访问 http://campus.kongbaijiyi.com/docs 确认API文档可访问

## 故障排除

### 常见问题

1. **域名无法访问**
   - 检查域名解析是否正确
   - 检查服务器防火墙设置
   - 检查Docker容器状态

2. **CORS错误**
   - 检查nginx配置中的CORS设置
   - 确认域名配置正确

3. **API无法访问**
   - 检查后端服务状态
   - 检查nginx代理配置
   - 查看服务日志

### 调试命令

```bash
# 查看容器状态
docker-compose -f docker-compose-fast.yml ps

# 查看服务日志
docker-compose -f docker-compose-fast.yml logs -f

# 检查nginx配置
docker exec dcc-nginx nginx -t

# 检查域名解析
dig campus.kongbaijiyi.com
```

## 监控和维护

### 日志监控

```bash
# 查看所有服务日志
docker-compose -f docker-compose-fast.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose-fast.yml logs -f nginx
docker-compose -f docker-compose-fast.yml logs -f backend
docker-compose -f docker-compose-fast.yml logs -f frontend
```

### 性能监控

```bash
# 查看容器资源使用
docker stats

# 查看系统资源
htop
```

---

**配置完成时间**: 2024-12-19  
**域名**: campus.kongbaijiyi.com  
**服务器**: 47.103.27.235  
**状态**: 已配置，待部署
