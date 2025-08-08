# DCC数字员工系统 - 部署文档

## 📋 当前部署状态

### ✅ 部署方式
- **类型**: 直接部署到服务器 (不使用Docker)
- **服务器**: 47.103.27.235
- **域名**: campus.kongbaijiyi.com

### 🏗️ 服务架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │───▶│  Next.js (3000) │    │  FastAPI (8000) │
│   (反向代理)     │    │   (前端)        │    │   (后端)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              └─────────┬──────────────┘
                                        ▼
                              ┌─────────────────┐
                              │   MySQL         │
                              │   (数据库)      │
                              └─────────────────┘
```

### 📁 核心文件结构
```
V1.0/
├── backend/                    # 后端代码
│   ├── api/                   # API接口
│   ├── database/              # 数据库相关
│   ├── main.py               # 主程序
│   └── requirements.txt      # Python依赖
├── dcc-digital-employee/      # 前端代码
│   ├── src/                  # 源代码
│   ├── package.json          # Node.js依赖
│   └── next.config.js        # Next.js配置
├── nginx.conf                # Nginx配置 (已更新为直接部署方式)
├── deploy-simple.sh          # 部署脚本
├── restart-all.sh            # 重启脚本
└── README.md                 # 项目说明
```

## 🚀 部署步骤

### 1. 服务器准备
```bash
# 安装系统依赖
apt-get update -y
apt-get install -y python3 python3-pip python3-venv nodejs npm nginx mysql-server
```

### 2. 数据库配置
```bash
# 创建数据库和用户
mysql -u root -p -e "
CREATE DATABASE IF NOT EXISTS dcc_employee_db;
CREATE USER IF NOT EXISTS 'dcc_user'@'localhost' IDENTIFIED BY 'dcc123456';
GRANT ALL PRIVILEGES ON dcc_employee_db.* TO 'dcc_user'@'localhost';
FLUSH PRIVILEGES;
"
```

### 3. 后端部署
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### 4. 前端部署
```bash
cd dcc-digital-employee
npm install
npm run build
nohup npm start > frontend.log 2>&1 &
```

### 5. Nginx配置
```bash
# 复制nginx配置 (已更新为直接部署方式)
cp nginx.conf /etc/nginx/nginx.conf
systemctl restart nginx
```

## 🔧 维护命令

### 重启服务
```bash
# 完整重启
./restart-all.sh

# 单独重启
# 后端
cd backend && pkill -f "uvicorn" && nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# 前端
cd dcc-digital-employee && pkill -f "next" && nohup npm start > frontend.log 2>&1 &

# Nginx
systemctl restart nginx
```

### 查看日志
```bash
# 后端日志
tail -f /opt/dcc-digital-employee/backend/backend.log

# 前端日志
tail -f /opt/dcc-digital-employee/dcc-digital-employee/frontend.log

# Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 检查服务状态
```bash
# 检查进程
ps aux | grep -E "(uvicorn|node|nginx)" | grep -v grep

# 检查端口
netstat -tlnp | grep -E ':(80|443|3000|8000)'
```

## 🌐 访问地址

- **生产环境**: https://campus.kongbaijiyi.com
- **IP访问**: http://47.103.27.235
- **API文档**: https://campus.kongbaijiyi.com/docs

## 📝 重要配置

### 环境变量
- 前端配置: `dcc-digital-employee/src/config/environment.ts`
- 后端配置: `backend/config.py`

### 数据库
- 数据库名: `dcc_employee_db`
- 用户名: `dcc_user`
- 密码: `dcc123456`

### 端口配置
- Nginx: 80 (HTTP), 443 (HTTPS)
- 前端: 3000
- 后端: 8000

### Nginx配置说明
```nginx
# API路由 - 转发到后端 (端口8000)
location /api/ {
    proxy_pass http://localhost:8000/;
    # ... 其他配置
}

# 前端应用 - 转发到前端 (端口3000)
location / {
    proxy_pass http://localhost:3000;
    # ... 其他配置
}
```

## 🔒 安全配置

### SSL证书
- 使用Let's Encrypt自动证书
- 证书路径: `/etc/letsencrypt/`

### 防火墙
```bash
# 开放必要端口
ufw allow 80
ufw allow 443
ufw allow 22
ufw enable
```

## 📊 监控

### 服务监控
- 后端健康检查: `GET /api/health`
- 前端状态: 访问首页检查

### 日志监控
- 错误日志: `/var/log/nginx/error.log`
- 访问日志: `/var/log/nginx/access.log`

## 🆘 故障排除

### 常见问题
1. **服务无法访问**: 检查防火墙和端口
2. **数据库连接失败**: 检查MySQL服务状态
3. **前端显示异常**: 检查Node.js进程和日志
4. **API调用失败**: 检查后端进程和日志
5. **Nginx代理失败**: 检查nginx配置和端口

### 重启所有服务
```bash
# 完整重启脚本
cd /opt/dcc-digital-employee
./restart-all.sh
```

### Nginx配置测试
```bash
# 测试nginx配置
nginx -t

# 如果配置错误，恢复备份
cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf
systemctl restart nginx
```

## 🔄 配置更新记录

### 2025-08-08 重要更新
- ✅ **跟进Agent状态逻辑修复**: 修复了跟进Agent在跟进完成时仍显示为"工作中"的问题
- ✅ **Nginx配置更新**: 将Docker方式的upstream配置改为直接指向localhost端口
- ✅ **项目清理**: 删除了所有Docker相关的配置文件，保留最干净的部署方式
- ✅ **文档更新**: 更新了部署文档和README

### 配置变更详情
1. **跟进Agent状态逻辑**:
   - 修复前: `(followupInProgressStats.count > 0 || followupCompletedStats.count > 0) ? 'working' : 'idle'`
   - 修复后: `followupInProgressStats.count > 0 ? 'working' : 'idle'`

2. **Nginx配置**:
   - 修复前: `proxy_pass http://backend/` 和 `proxy_pass http://frontend`
   - 修复后: `proxy_pass http://localhost:8000/` 和 `proxy_pass http://localhost:3000`

---

**最后更新**: 2025-08-08  
**部署方式**: 直接部署 (非Docker)  
**状态**: ✅ 生产环境运行中  
**Nginx配置**: ✅ 已更新为直接部署方式
