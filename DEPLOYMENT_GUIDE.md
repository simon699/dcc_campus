# DCC数字员工系统 - 部署和更新指南

## 问题解决方案

### 1. 端口冲突问题
**问题**：前端部署时提示端口占用，但服务可以访问
**原因**：`package.json` 中配置了端口3001，但重启脚本还在检查3000端口
**解决**：已修复 `restart-frontend.sh` 脚本，现在正确检查3001端口

### 2. 自动更新方案
提供了多种自动更新方案，无需手动重新部署：

## 部署脚本说明

### 1. 智能部署脚本 (`smart-deploy.sh`)
**功能**：自动处理端口冲突、智能重启服务
**特点**：
- 自动检测和释放被占用的端口
- 智能判断是否需要重新构建
- 健康检查确保服务正常启动
- 详细的日志输出

```bash
# 使用智能部署
./smart-deploy.sh
```

### 2. 热重载脚本 (`hot-reload-frontend.sh`)
**功能**：快速重启前端服务，不重新构建
**适用场景**：代码修改后快速更新
**特点**：
- 使用已构建的文件，启动速度快
- 自动检查构建文件是否存在
- 适合频繁的代码更新

```bash
# 热重载前端
./hot-reload-frontend.sh
```

### 3. 文件监控自动重启 (`auto-reload.sh`)
**功能**：监控文件变化，自动重启相应服务
**特点**：
- 实时监控前端和后端文件变化
- 自动重启对应的服务
- 支持并行监控
- 排除不必要的文件（日志、缓存等）

```bash
# 启动文件监控
./auto-reload.sh
```

**依赖安装**：
```bash
# Ubuntu/Debian
sudo apt-get install inotify-tools

# CentOS/RHEL
sudo yum install inotify-tools
```

## GitHub Actions CI/CD 配置

### 1. 配置文件位置
`.github/workflows/deploy.yml`

### 2. 功能特性
- 自动构建和测试
- 推送到main分支时自动部署
- SSH连接到服务器执行部署
- 健康检查确保部署成功

### 3. 需要配置的Secrets
在GitHub仓库设置中添加以下Secrets：
- `SERVER_HOST`: 服务器IP地址
- `SERVER_USER`: 服务器用户名
- `SERVER_SSH_KEY`: SSH私钥
- `SERVER_PORT`: SSH端口（默认22）

### 4. 使用方法
1. 推送代码到main分支
2. GitHub Actions自动触发部署
3. 服务器自动拉取代码并重启服务

## 部署流程对比

### 传统部署流程
```bash
# 每次修改代码后需要：
git pull
./restart-backend.sh
./restart-frontend.sh
```

### 新的自动更新流程

#### 方案1：文件监控自动重启
```bash
# 启动一次监控，之后自动处理所有更新
./auto-reload.sh
```

#### 方案2：热重载
```bash
# 代码修改后快速重启
./hot-reload-frontend.sh
```

#### 方案3：GitHub Actions自动部署
```bash
# 推送代码即可自动部署
git add .
git commit -m "更新功能"
git push origin main
```

## 服务管理命令

### 查看服务状态
```bash
# 查看端口占用
netstat -tlnp | grep -E ":(3001|8000) "

# 查看进程
ps aux | grep -E "next|uvicorn"

# 查看日志
tail -f frontend.log
tail -f backend.log
```

### 停止服务
```bash
# 停止前端
pkill -f "next"

# 停止后端
pkill -f "uvicorn"

# 停止所有服务
pkill -f "next|uvicorn"
```

### 重启服务
```bash
# 完整重启
./smart-deploy.sh

# 只重启前端
./hot-reload-frontend.sh

# 只重启后端
./restart-backend.sh
```

## 推荐使用方案

### 开发环境
使用文件监控自动重启：
```bash
./auto-reload.sh
```

### 生产环境
1. **首次部署**：使用智能部署脚本
2. **日常更新**：使用GitHub Actions自动部署
3. **紧急修复**：使用热重载脚本

### 端口配置
- 前端：3001端口
- 后端：8000端口
- Nginx：80端口（代理到前端和后端）

## 故障排除

### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :3001
lsof -i :8000

# 强制释放端口
sudo kill -9 $(lsof -ti:3001)
sudo kill -9 $(lsof -ti:8000)
```

### 2. 服务启动失败
```bash
# 查看详细日志
tail -f frontend.log
tail -f backend.log

# 手动启动测试
cd dcc-digital-employee && npm start
cd backend && source venv/bin/activate && uvicorn main:app --reload
```

### 3. 构建失败
```bash
# 清理缓存重新构建
cd dcc-digital-employee
rm -rf .next node_modules
npm install
npm run build
```

## 注意事项

1. **环境变量**：确保 `.env` 文件配置正确
2. **权限**：确保脚本有执行权限 `chmod +x *.sh`
3. **依赖**：确保服务器安装了必要的依赖
4. **防火墙**：确保端口3001和8000可以访问
5. **Nginx配置**：确保Nginx正确代理到3001端口

通过以上方案，您可以实现：
- ✅ 解决端口冲突问题
- ✅ 代码修改后自动更新服务器
- ✅ GitHub Actions自动部署
- ✅ 多种更新方式选择
- ✅ 详细的日志和状态监控
