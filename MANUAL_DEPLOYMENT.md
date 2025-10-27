# DCC数字员工系统 - 手动部署指南

## 问题分析

您遇到的主要问题是网络超时，导致pip无法下载Python包。我们提供完全避免Python网络问题的手动部署方案。

## 手动部署步骤

### 第一步：检查环境变量

```bash
# 检查.env文件
cat .env | grep DB_

# 确保包含：
# DB_HOST=rm-uf659mlhqay324l92.mysql.rds.aliyuncs.com
# DB_PORT=3306
# DB_USER=dcc_user
# DB_PASSWORD=您的实际密码
# DB_NAME=dcc_employee_db
```

### 第二步：手动初始化数据库

```bash
# 1. 创建数据库
docker run --rm --network host mysql:8.0 mysql \
  -h rm-uf659mlhqay324l92.mysql.rds.aliyuncs.com \
  -P 3306 \
  -u dcc_user \
  -p您的密码 \
  -e "CREATE DATABASE IF NOT EXISTS dcc_employee_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 创建表结构
docker run --rm --network host -v $(pwd):/data mysql:8.0 mysql \
  -h rm-uf659mlhqay324l92.mysql.rds.aliyuncs.com \
  -P 3306 \
  -u dcc_user \
  -p您的密码 \
  dcc_employee_db < /data/backend/database/01_create_tables.sql

docker run --rm --network host -v $(pwd):/data mysql:8.0 mysql \
  -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com \
  -P 3306 \
  -u dcc_user \
  -p您的密码 \
  dcc_employee_db < /data/backend/database/02_call_tasks.sql

docker run --rm --network host -v $(pwd):/data mysql:8.0 mysql \
  -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com \
  -P 3306 \
  -u dcc_user \
  -p您的密码 \
  dcc_employee_db < /data/backend/database/03_auto_call_tables.sql

docker run --rm --network host -v $(pwd):/data mysql:8.0 mysql \
  -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com \
  -P 3306 \
  -u dcc_user \
  -p您的密码 \
  dcc_employee_db < /data/backend/database/04_dcc_leads.sql
```

### 第三步：部署应用

```bash
# 1. 停止现有服务
docker-compose down

# 2. 构建镜像
docker-compose build --no-cache

# 3. 启动服务
docker-compose up -d

# 4. 检查状态
docker-compose ps
```

### 第四步：验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查API健康状态
curl http://localhost/api/health

# 查看日志
docker-compose logs -f
```

## 一键部署脚本

如果您想使用脚本，推荐使用新的简化脚本：

```bash
# 使用新的简化部署脚本
./deploy-simple.sh
```

这个脚本完全避免了Python网络问题，直接使用MySQL客户端。

## 故障排除

### 1. 数据库连接问题

**测试RDS连接：**
```bash
# 使用telnet测试端口
telnet rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com 3306

# 使用nc测试
nc -zv rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com 3306
```

**检查RDS安全组：**
- 确保允许服务器IP `47.103.27.235` 访问3306端口
- 检查RDS实例状态是否正常

### 2. 服务启动问题

**查看详细日志：**
```bash
# 查看后端日志
docker-compose logs backend

# 查看前端日志
docker-compose logs frontend

# 查看Nginx日志
docker-compose logs nginx
```

**重启服务：**
```bash
# 重启特定服务
docker-compose restart backend
docker-compose restart frontend
docker-compose restart nginx

# 重启所有服务
docker-compose restart
```

### 3. 网络问题

**检查网络连接：**
```bash
# 检查DNS解析
nslookup rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com

# 检查路由
traceroute rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com
```

## 快速部署命令

```bash
# 1. 登录服务器
ssh root@47.103.27.235

# 2. 进入项目目录
cd /opt/dcc-employee

# 3. 使用简化部署脚本
./deploy-simple.sh

# 4. 如果脚本失败，使用手动命令
```

## 预期结果

部署成功后，您应该能够通过以下地址访问：

- **主站**: http://campus.kongbaijiyi.com
- **API文档**: http://campus.kongbaijiyi.com/docs
- **健康检查**: http://campus.kongbaijiyi.com/api/health

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

---

**推荐使用 `./deploy-simple.sh` 脚本，它完全避免了Python网络问题。**
