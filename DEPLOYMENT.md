# DCC数字员工系统 - 部署说明

## 项目概述

DCC数字员工系统是一个基于Docker的微服务架构应用，包含以下组件：

- **前端**: Next.js 14 + React 18 + TypeScript
- **后端**: Python FastAPI + SQLAlchemy
- **数据库**: MySQL 8.0
- **反向代理**: Nginx
- **容器编排**: Docker Compose

## 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │────│  Frontend (3000)│    │   Backend (8000)│
│   (反向代理)     │    │   (Next.js)     │    │   (FastAPI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                               ┌─────────────────┐
                                               │   MySQL (3306)  │
                                               │   (数据库)       │
                                               └─────────────────┘
```

## 部署方式

### 1. 本地开发部署

使用 `local-deploy.sh` 脚本进行本地部署：

```bash
# 给脚本执行权限
chmod +x local-deploy.sh

# 运行本地部署
./local-deploy.sh
```

**本地访问地址：**
- 前端应用: http://localhost
- 后端API: http://localhost/api
- API文档: http://localhost/docs
- ReDoc文档: http://localhost/redoc

**直接端口访问：**
- 前端: http://localhost:3001
- 后端: http://localhost:8001
- MySQL: localhost:3307

### 2. 服务器生产部署

使用 `server-deploy.sh` 脚本进行服务器部署：

```bash
# 给脚本执行权限
chmod +x server-deploy.sh

# 运行服务器部署
./server-deploy.sh
```

**服务器信息：**
- IP地址: 47.103.27.235
- 部署目录: /opt/dcc-digital-employee
- 用户: root

**生产访问地址：**
- 前端应用: http://47.103.27.235
- 后端API: http://47.103.27.235/api
- API文档: http://47.103.27.235/docs
- ReDoc文档: http://47.103.27.235/redoc

## 环境配置

### 环境变量文件

项目包含以下环境变量配置文件：

1. **env.template** - 环境变量模板
2. **env.production** - 生产环境配置

### 重要配置项

```bash
# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_USER=dcc_user
DB_PASSWORD=,Dcc123456
DB_NAME=dcc_employee_db

# JWT认证
JWT_SECRET_KEY=dcc-jwt-secret-key-2024
JWT_EXPIRE_HOURS=24

# 阿里云配置（需要替换为实际值）
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id

# 阿里百炼配置（需要替换为实际值）
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id
```

## Docker配置

### 快速构建配置 (docker-compose-fast.yml)

使用预构建镜像和优化设置，适合生产环境：

- MySQL: 使用官方镜像
- 后端: 使用Dockerfile.fast构建
- 前端: 使用Node.js Alpine镜像
- Nginx: 使用Alpine镜像

### 标准配置 (docker-compose.yml)

使用完整构建流程，适合开发环境：

- 所有服务都使用自定义Dockerfile构建
- 包含完整的开发依赖

## 服务管理

### 常用Docker命令

```bash
# 查看服务状态
docker-compose -f docker-compose-fast.yml ps

# 查看服务日志
docker-compose -f docker-compose-fast.yml logs -f

# 停止所有服务
docker-compose -f docker-compose-fast.yml down

# 重启服务
docker-compose -f docker-compose-fast.yml restart

# 进入容器
docker exec -it dcc-backend /bin/bash
docker exec -it dcc-frontend /bin/sh
docker exec -it dcc-mysql mysql -u dcc_user -p
```

### 服务健康检查

系统包含完整的健康检查机制：

- **MySQL**: 每10秒检查数据库连接
- **后端**: 每30秒检查API健康状态
- **前端**: 每30秒检查Web服务状态
- **Nginx**: 每30秒检查代理服务状态

## 数据库管理

### 数据库连接信息

- **主机**: localhost (本地) / mysql (容器内)
- **端口**: 3307 (本地) / 3306 (容器内)
- **用户名**: dcc_user
- **密码**: ,Dcc123456
- **数据库**: dcc_employee_db

### 数据库初始化

数据库初始化脚本位于 `backend/database/` 目录：

- `01_create_tables.sql` - 创建基础表结构
- `02_call_tasks.sql` - 创建任务相关表
- `03_auto_call_tables.sql` - 创建自动呼叫表
- `04_dcc_leads.sql` - 创建线索表

## 监控和日志

### 日志位置

- **Nginx日志**: Docker卷 `nginx_logs`
- **应用日志**: 容器标准输出
- **数据库日志**: MySQL容器日志

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose-fast.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose-fast.yml logs -f backend
docker-compose -f docker-compose-fast.yml logs -f frontend
docker-compose -f docker-compose-fast.yml logs -f mysql
docker-compose -f docker-compose-fast.yml logs -f nginx
```

## 故障排除

### 常见问题

1. **端口冲突**
   - 检查端口是否被占用: `netstat -tulpn | grep :80`
   - 修改docker-compose.yml中的端口映射

2. **数据库连接失败**
   - 检查MySQL容器是否启动: `docker ps | grep mysql`
   - 检查数据库密码配置

3. **前端构建失败**
   - 检查Node.js版本兼容性
   - 清理node_modules: `rm -rf node_modules && npm install`

4. **服务无法访问**
   - 检查防火墙设置
   - 检查Docker网络配置
   - 查看服务日志排查问题

### 重置部署

```bash
# 完全重置（删除所有容器、网络、卷）
docker-compose -f docker-compose-fast.yml down -v --remove-orphans
docker system prune -a

# 重新部署
./local-deploy.sh  # 或 ./server-deploy.sh
```

## 安全注意事项

1. **修改默认密码**
   - 数据库密码: 修改 `DB_PASSWORD`
   - JWT密钥: 修改 `JWT_SECRET_KEY`

2. **网络安全**
   - 生产环境建议使用HTTPS
   - 配置防火墙规则
   - 限制数据库访问

3. **环境变量安全**
   - 不要在代码中硬编码敏感信息
   - 使用环境变量文件管理配置
   - 定期轮换密钥

## 性能优化

1. **数据库优化**
   - 配置MySQL缓存
   - 优化查询索引
   - 定期清理日志

2. **应用优化**
   - 启用Gzip压缩
   - 配置静态文件缓存
   - 优化Docker镜像大小

3. **监控配置**
   - 启用性能监控
   - 配置日志轮转
   - 设置告警机制

## 更新和维护

### 更新应用

```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
./local-deploy.sh  # 或 ./server-deploy.sh
```

### 备份数据

```bash
# 备份数据库
docker exec dcc-mysql mysqldump -u dcc_user -p dcc_employee_db > backup.sql

# 恢复数据库
docker exec -i dcc-mysql mysql -u dcc_user -p dcc_employee_db < backup.sql
```

## 联系支持

如有问题，请检查：

1. 服务日志: `docker-compose logs -f`
2. 系统资源: `docker stats`
3. 网络连接: `docker network ls`
4. 卷状态: `docker volume ls`

---

**部署时间**: 2024-12-19  
**版本**: V1.0  
**维护者**: DCC开发团队
