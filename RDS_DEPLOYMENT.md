# DCC数字员工系统 - 阿里云RDS部署指南

## 概述

本指南将帮助您将DCC数字员工系统从本地MySQL数据库迁移到阿里云RDS，以提升系统性能和稳定性。

**服务器信息：**
- 服务器地址：47.103.27.235
- 关联域名：campus.kongbaijiyi.com

## 前置条件

### 1. 阿里云RDS实例
- 已创建MySQL 8.0实例
- 已配置安全组，允许服务器IP访问
- 已获取连接信息（主机地址、端口、用户名、密码）

### 2. 服务器环境
- Docker和Docker Compose已安装
- 域名已解析到服务器IP
- SSL证书已准备（可选，推荐）

## 部署步骤

### 第一步：配置环境变量

1. **复制环境变量模板**
```bash
cp env.production .env
```

2. **编辑环境变量文件**
```bash
nano .env
```

3. **配置数据库连接信息**
```bash
# 阿里云RDS数据库配置
DB_HOST=your-rds-endpoint.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=your_rds_username
DB_PASSWORD=your_rds_password
DB_NAME=dcc_employee_db

# 其他必要配置
JWT_SECRET_KEY=your-secure-jwt-secret-key
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id
```

### 第二步：初始化RDS数据库

1. **安装Python依赖**
```bash
cd backend
pip install -r requirements.txt
```

2. **运行数据库初始化脚本**
```bash
python init_rds_database.py
```

3. **验证数据库连接**
```bash
# 测试数据库连接
python -c "
from backend.config import config
import pymysql
conn = pymysql.connect(
    host=config.DB_HOST,
    port=config.DB_PORT,
    user=config.DB_USER,
    password=config.DB_PASSWORD,
    database=config.DB_NAME
)
print('数据库连接成功！')
conn.close()
"
```

### 第三步：准备SSL证书（推荐）

1. **创建SSL证书目录**
```bash
mkdir -p ssl
```

2. **上传SSL证书文件**
```bash
# 将您的SSL证书文件上传到ssl目录
# cert.pem - 证书文件
# key.pem - 私钥文件
```

3. **设置证书权限**
```bash
chmod 600 ssl/cert.pem ssl/key.pem
```

### 第四步：部署应用

#### 选项A：HTTP部署（简单）
```bash
# 使用HTTP配置部署
docker-compose up -d
```

#### 选项B：HTTPS部署（推荐）
```bash
# 使用HTTPS配置部署
docker-compose -f docker-compose-https.yml up -d
```

### 第五步：验证部署

1. **检查服务状态**
```bash
docker-compose ps
```

2. **查看服务日志**
```bash
# 查看后端日志
docker-compose logs backend

# 查看前端日志
docker-compose logs frontend

# 查看Nginx日志
docker-compose logs nginx
```

3. **测试API接口**
```bash
# 测试健康检查接口
curl http://47.103.27.235/api/health

# 测试API文档
curl http://47.103.27.235/docs
```

4. **访问前端应用**
- HTTP: http://campus.kongbaijiyi.com
- HTTPS: https://campus.kongbaijiyi.com

## 配置说明

### 环境变量说明

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DB_HOST` | RDS数据库主机地址 | `rm-xxx.mysql.rds.aliyuncs.com` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USER` | 数据库用户名 | `dcc_user` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_NAME` | 数据库名称 | `dcc_employee_db` |
| `JWT_SECRET_KEY` | JWT密钥 | `your-secret-key` |
| `NEXT_PUBLIC_API_BASE_URL` | 前端API地址 | `https://campus.kongbaijiyi.com/api` |

### 网络配置

- **后端服务**: 端口8000
- **前端服务**: 端口3000
- **Nginx**: 端口80(HTTP) / 443(HTTPS)

### 安全配置

- 数据库连接使用连接池
- JWT令牌认证
- CORS跨域配置
- SSL/TLS加密（HTTPS部署时）

## 监控和维护

### 查看服务状态
```bash
# 查看所有服务状态
docker-compose ps

# 查看资源使用情况
docker stats
```

### 日志管理
```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
```

### 服务重启
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

### 更新部署
```bash
# 停止服务
docker-compose down

# 重新构建镜像
docker-compose build --no-cache

# 启动服务
docker-compose up -d
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查RDS安全组配置
   - 验证数据库连接信息
   - 确认网络连通性

2. **服务启动失败**
   - 检查环境变量配置
   - 查看服务日志
   - 验证端口占用情况

3. **HTTPS证书问题**
   - 检查证书文件路径
   - 验证证书有效性
   - 确认证书权限设置

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
docker-compose exec backend ping your-rds-endpoint.mysql.rds.aliyuncs.com
```

## 性能优化建议

1. **数据库优化**
   - 配置RDS实例规格
   - 启用读写分离（如需要）
   - 定期备份数据

2. **应用优化**
   - 调整连接池配置
   - 启用Gzip压缩
   - 配置静态资源缓存

3. **服务器优化**
   - 监控资源使用情况
   - 调整Docker资源限制
   - 配置日志轮转

## 备份和恢复

### 数据库备份
```bash
# 使用mysqldump备份
mysqldump -h your-rds-endpoint.mysql.rds.aliyuncs.com \
  -u your_username -p your_database > backup.sql
```

### 应用备份
```bash
# 备份配置文件
tar -czf config-backup.tar.gz .env docker-compose*.yml nginx*.conf

# 备份SSL证书
tar -czf ssl-backup.tar.gz ssl/
```

## 联系支持

如果在部署过程中遇到问题，请提供以下信息：
- 错误日志
- 环境配置
- 问题复现步骤

---

**部署完成后，您的DCC数字员工系统将通过以下地址访问：**
- 主站：https://campus.kongbaijiyi.com
- API文档：https://campus.kongbaijiyi.com/docs
- 健康检查：https://campus.kongbaijiyi.com/api/health
