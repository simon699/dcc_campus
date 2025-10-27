# DCC数字员工系统 - 服务器部署指南

## 问题解决方案

由于服务器上的Python环境是外部管理的，我们创建了专门的Docker版本脚本来解决这个问题。

## 快速部署步骤

### 第一步：上传代码到服务器

```bash
# 使用scp上传项目
scp -r /Users/wedo/Documents/product/DCC数字员工/V1.0 root@47.103.27.235:/opt/dcc-employee/

# 或者使用rsync（推荐）
rsync -avz --exclude='node_modules' --exclude='venv' --exclude='__pycache__' \
  /Users/wedo/Documents/product/DCC数字员工/V1.0/ root@47.103.27.235:/opt/dcc-employee/
```

### 第二步：登录服务器并配置

```bash
# 登录服务器
ssh root@47.103.27.235

# 进入项目目录
cd /opt/dcc-employee

# 配置环境变量
nano .env
```

确保`.env`文件包含正确的RDS配置：

```bash
# 数据库配置（阿里云RDS）
DB_HOST=yrm-uf659mlhqay324l92.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=dcc_user
DB_PASSWORD=您的实际RDS密码
DB_NAME=dcc_employee_db

# JWT配置
JWT_SECRET_KEY=dcc-jwt-secret-key-2024
JWT_EXPIRE_HOURS=24

# 阿里云配置
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id

# 阿里百炼配置
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id

# 前端配置
NEXT_PUBLIC_API_BASE_URL=http://campus.kongbaijiyi.com/api
NODE_ENV=production

# 应用配置
ENVIRONMENT=production
DEBUG=false
```

### 第三步：初始化数据库

```bash
# 使用Docker版本初始化数据库
./init-database-docker.sh
```

### 第四步：部署应用

```bash
# 使用服务器专用部署脚本
./deploy-server.sh
```

### 第五步：验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查API健康状态
curl http://localhost/api/health

# 查看日志
docker-compose logs -f
```

## 手动部署步骤（如果脚本有问题）

如果自动脚本有问题，可以手动执行以下步骤：

### 1. 初始化数据库

```bash
# 测试数据库连接
docker run --rm --network host python:3.11-slim bash -c "
pip install pymysql python-dotenv
python -c \"
import pymysql
import os
from dotenv import load_dotenv
load_dotenv()

try:
    conn = pymysql.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        charset='utf8mb4'
    )
    print('数据库连接成功')
    conn.close()
except Exception as e:
    print(f'连接失败: {e}')
    exit(1)
\"
"
```

### 2. 创建数据库和表

```bash
# 创建数据库
docker run --rm --network host -v $(pwd):/app -w /app python:3.11-slim bash -c "
pip install pymysql python-dotenv
python init_rds_database.py
"
```

### 3. 部署应用

```bash
# 停止现有服务
docker-compose down

# 构建镜像
docker-compose build --no-cache

# 启动服务
docker-compose up -d

# 检查状态
docker-compose ps
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查RDS安全组配置
   # 确保允许服务器IP 47.103.27.235 访问3306端口
   ```

2. **服务启动失败**
   ```bash
   # 查看详细日志
   docker-compose logs backend
   docker-compose logs frontend
   docker-compose logs nginx
   ```

3. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep :80
   netstat -tlnp | grep :443
   ```

### 调试命令

```bash
# 进入容器调试
docker-compose exec backend bash
docker-compose exec frontend bash

# 测试数据库连接
docker-compose exec backend python -c "
from database.db import get_connection
with get_connection() as conn:
    print('数据库连接成功')
"

# 检查网络连通性
docker-compose exec backend ping yrm-uf659mlhqay324l92.mysql.rds.aliyuncs.com
```

## 管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新部署
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 访问地址

部署完成后，您可以通过以下地址访问：

- **主站**: http://campus.kongbaijiyi.com
- **API文档**: http://campus.kongbaijiyi.com/docs
- **健康检查**: http://campus.kongbaijiyi.com/api/health

## 注意事项

1. **RDS安全组**：确保RDS实例的安全组允许服务器IP访问
2. **域名解析**：确保 `campus.kongbaijiyi.com` 解析到 `47.103.27.235`
3. **防火墙**：确保服务器防火墙开放80和443端口
4. **SSL证书**：如需HTTPS，请将证书文件放入 `ssl/` 目录

---

**如果遇到问题，请提供错误日志信息以便进一步诊断。**
