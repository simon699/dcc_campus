## 🚀 部署方式选择

### 方式1：Docker部署（推荐）
使用Docker容器化部署，环境隔离，易于管理。

### 方式2：直接运行部署（简单可靠）
直接在ECS上安装Python和Node.js环境，不使用Docker。

---

## 📋 方式2：直接运行部署（推荐）

### 前提条件
- 阿里云ECS服务器（Ubuntu 20.04+）
- 阿里云RDS MySQL数据库
- 域名 `campus.kongbaijiyi.com` 已解析到服务器IP

### 部署步骤

1. **克隆代码到服务器**
   ```bash
   # 登录阿里云ECS服务器
   ssh root@your-server-ip
   
   # 克隆代码到指定目录
   git clone <your-repository-url> /opt/dcc_campus
   
   # 进入项目目录
   cd /opt/dcc_campus/dcc_campus
   ```

2. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp env.template .env
   
   # 编辑环境变量文件
   nano .env
   ```
   
   **必须修改的配置：**
   ```bash
   # 数据库配置 (阿里云RDS)
   DB_HOST=your-rds-host.mysql.rds.aliyuncs.com
   DB_PORT=3306
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=dcc_employee_db
   
   # JWT配置
   JWT_SECRET_KEY=your-jwt-secret-key-2024
   
   # 阿里云配置
   ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
   ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
   INSTANCE_ID=your_instance_id
   DASHSCOPE_API_KEY=your_dashscope_api_key
   ALIBAILIAN_APP_ID=your_bailian_app_id
   ```

3. **执行直接运行部署**
   ```bash
   # 给脚本执行权限
   chmod +x deploy-ecs-direct.sh
   
   # 执行部署（自动安装所有依赖）
   ./deploy-ecs-direct.sh
   ```

4. **验证部署**
   ```bash
   # 检查服务状态
   ./check-status.sh
   
   # 查看日志
   ./view-logs.sh
   ```

### 访问地址
- **主站**: http://campus.kongbaijiyi.com
- **API文档**: http://campus.kongbaijiyi.com/docs
- **健康检查**: http://campus.kongbaijiyi.com/api/health

### 管理命令
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

---

## 📋 方式1：Docker部署

1. **克隆代码到服务器**
   ```bash
   # 登录阿里云ECS服务器
   ssh root@your-server-ip
   
   # 克隆代码到指定目录
   git clone <your-repository-url> /opt/dcc_campus
   
   # 进入项目目录
   cd /opt/dcc_campus/dcc_campus
   ```

2. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp env.template .env
   
   # 编辑环境变量文件
   nano .env
   ```
   
   **必须修改的配置：**
   ```bash
   # 数据库配置 (阿里云RDS)
   DB_HOST=your-rds-host.mysql.rds.aliyuncs.com
   DB_PORT=3306
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=dcc_employee_db
   
   # JWT配置
   JWT_SECRET_KEY=your-jwt-secret-key-2024
   
   # 阿里云配置
   ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
   ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
   INSTANCE_ID=your_instance_id
   DASHSCOPE_API_KEY=your_dashscope_api_key
   ALIBAILIAN_APP_ID=your_bailian_app_id
   ```

3. **配置Docker专属加速器**（推荐）
   ```bash
   # 给脚本执行权限
   chmod +x setup-docker-mirror.sh
   
   # 配置阿里云专属镜像加速器
   ./setup-docker-mirror.sh
   ```

4. **预拉取Docker镜像**（推荐）
   ```bash
   # 给脚本执行权限
   chmod +x pull-images.sh
   
   # 预拉取镜像（解决网络超时问题）
   ./pull-images.sh
   ```

5. **执行部署脚本**
   ```bash
   # 给脚本执行权限
   chmod +x deploy-aliyun.sh
   
   # 执行部署
   ./deploy-aliyun.sh
   ```

6. **验证部署**
   ```bash
   # 检查服务状态
   ./check-status.sh
   
   # 查看日志
   ./view-logs.sh
   ```

### 访问地址
- **主站**: http://campus.kongbaijiyi.com
- **API文档**: http://campus.kongbaijiyi.com/docs
- **健康检查**: http://campus.kongbaijiyi.com/api/health

### 管理命令
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

### 故障排除

1. **服务无法访问**
   ```bash
   # 检查防火墙
   sudo ufw status
   
   # 开放80端口
   sudo ufw allow 80/tcp
   ```

2. **数据库连接失败**
   ```bash
   # 检查RDS连接
   docker run --rm --network host mysql:8.0 mysql \
     -h your-rds-host.mysql.rds.aliyuncs.com \
     -P 3306 -u your_username -p
   ```

3. **查看详细日志**
   ```bash
   # 查看所有服务日志
   docker-compose -f docker-compose-china.yml logs -f
   
   # 查看特定服务日志
   docker-compose -f docker-compose-china.yml logs -f backend
   docker-compose -f docker-compose-china.yml logs -f frontend
   docker-compose -f docker-compose-china.yml logs -f nginx
   ```

### 注意事项
- 确保域名 `campus.kongbaijiyi.com` 已正确解析到服务器IP
- 确保阿里云安全组已开放80端口
- 确保RDS数据库已创建并配置正确
- 建议定期备份数据库

---
**部署完成后，系统将自动启动所有服务，无需手动干预。**
