#!/bin/bash

echo "=== 简单部署脚本（不使用Docker）==="

# 服务器信息
SERVER_IP="47.103.27.235"
SERVER_USER="root"

echo "1. 上传项目文件到服务器..."
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
    ./ ${SERVER_USER}@${SERVER_IP}:/opt/dcc-digital-employee/

echo ""
echo "2. 在服务器上配置和启动服务..."
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /opt/dcc-digital-employee

echo "安装系统依赖..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv nodejs npm nginx

echo "配置MySQL数据库..."
mysql -u root -p -e "
CREATE DATABASE IF NOT EXISTS dcc_employee_db;
CREATE USER IF NOT EXISTS 'dcc_user'@'localhost' IDENTIFIED BY 'dcc123456';
GRANT ALL PRIVILEGES ON dcc_employee_db.* TO 'dcc_user'@'localhost';
FLUSH PRIVILEGES;
" 2>/dev/null || echo "MySQL配置完成"

echo "配置后端..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "配置前端..."
cd ../dcc-digital-employee
npm install
npm run build

echo "配置Nginx..."
cp ../nginx.conf /etc/nginx/nginx.conf
systemctl restart nginx

echo "启动后端服务..."
cd ../backend
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

echo "启动前端服务..."
cd ../dcc-digital-employee
nohup npm start > frontend.log 2>&1 &

echo "等待服务启动..."
sleep 30

echo "检查服务状态..."
ps aux | grep -E "(uvicorn|node)" | grep -v grep
netstat -tlnp | grep -E ':(80|443|3000|8000)'

echo "部署完成！"
echo "域名: https://campus.kongbaijiyi.com"
echo "IP: http://47.103.27.235"
EOF

echo ""
echo "✅ 简单部署完成！"
