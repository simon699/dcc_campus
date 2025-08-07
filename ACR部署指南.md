# 阿里云ACR部署指南

## 问题解决

### 原始错误
```
error: failed to solve: failed to read dockerfile: open /tmp/buildkit-mount2968108320/Dockerfile: no such file or directory
```

### 解决方案

#### 1. 项目结构调整
- ✅ 在项目根目录创建了主 `Dockerfile`
- ✅ 创建了 `.dockerignore` 文件优化构建
- ✅ 创建了 `acr-deploy.yml` 配置文件

#### 2. 部署配置

##### 方法一：使用ACR控制台部署

1. **登录阿里云ACR控制台**
   - 进入容器镜像服务
   - 选择您的命名空间和镜像仓库

2. **配置构建规则**
   ```
   代码仓库: https://github.com/simon699/dcc_campus.git
   分支: main
   构建目录: /
   Dockerfile路径: Dockerfile
   ```

3. **设置环境变量**
   ```bash
   # 必需环境变量
   DB_PASSWORD=your_database_password
   JWT_SECRET_KEY=your_jwt_secret_key
   ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
   ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
   INSTANCE_ID=your_instance_id
   DASHSCOPE_API_KEY=your_dashscope_api_key
   ALIBAILIAN_APP_ID=your_alibailian_app_id
   EXTERNAL_API_TOKEN=your_external_api_token
   
   # 可选环境变量
   ENVIRONMENT=production
   DEBUG=False
   DB_HOST=your_database_host
   DB_PORT=3306
   DB_USER=dcc_user
   DB_NAME=dcc_employee_db
   JWT_EXPIRE_HOURS=24
   SCENE_ID_API_URL=https://your-api.com/get-scene-id
   API_TIMEOUT=30
   ```

##### 方法二：使用命令行部署

1. **构建镜像**
   ```bash
   # 登录ACR
   docker login crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com
   
   # 构建镜像
   docker build -t crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com/weido_dcc/dcc_campus:V1.0 .
   
   # 推送镜像
   docker push crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com/weido_dcc/dcc_campus:V1.0
   ```

2. **使用Docker Compose部署**
   ```bash
   # 创建环境变量文件
   cp backend/env.example .env
   
   # 编辑环境变量
   nano .env
   
   # 使用ACR配置部署
   docker-compose -f acr-deploy.yml up -d
   ```

#### 3. 验证部署

1. **检查服务状态**
   ```bash
   # 查看容器状态
   docker ps
   
   # 查看服务日志
   docker logs dcc_backend
   ```

2. **健康检查**
   ```bash
   # 检查后端健康状态
   curl http://your-server-ip:8000/health
   
   # 检查配置状态
   curl http://your-server-ip:8000/api/config/check
   ```

3. **API测试**
   ```bash
   # 测试登录接口
   curl -X POST http://your-server-ip:8000/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}'
   ```

## 常见问题解决

### 1. 构建失败
- **问题**: 找不到Dockerfile
- **解决**: 确保项目根目录有Dockerfile文件

### 2. 环境变量未生效
- **问题**: 应用无法读取环境变量
- **解决**: 在ACR构建规则中正确配置环境变量

### 3. 数据库连接失败
- **问题**: 无法连接到数据库
- **解决**: 检查数据库配置和网络连接

### 4. 端口访问问题
- **问题**: 无法访问应用端口
- **解决**: 检查ECS安全组配置

## 部署检查清单

- [ ] 项目根目录包含Dockerfile
- [ ] 环境变量已正确配置
- [ ] 数据库服务已启动
- [ ] 网络端口已开放
- [ ] 健康检查通过
- [ ] API接口可正常访问

## 监控和维护

### 1. 日志查看
```bash
# 查看应用日志
docker logs -f dcc_backend

# 查看构建日志
# 在ACR控制台查看构建历史
```

### 2. 性能监控
```bash
# 查看容器资源使用
docker stats dcc_backend

# 查看系统资源
htop
```

### 3. 备份和恢复
```bash
# 备份数据库
docker exec dcc_mysql mysqldump -u dcc_user -p dcc_employee_db > backup.sql

# 恢复数据库
docker exec -i dcc_mysql mysql -u dcc_user -p dcc_employee_db < backup.sql
```

## 安全建议

1. **密钥管理**
   - 使用阿里云KMS管理敏感信息
   - 定期轮换访问密钥

2. **网络安全**
   - 配置安全组规则
   - 使用VPC网络隔离

3. **监控告警**
   - 配置云监控告警
   - 设置日志告警规则

---

**注意**: 首次部署时，请确保所有必需的环境变量都已正确配置，并在测试环境中验证后再部署到生产环境。
