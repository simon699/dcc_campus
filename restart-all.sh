#!/bin/bash

echo "=== DCC数字员工系统 - 完整重启脚本 ==="

# 检查是否在正确的目录
if [ ! -d "/opt/dcc-digital-employee" ]; then
    echo "❌ 错误: 请在服务器上运行此脚本"
    exit 1
fi

cd /opt/dcc-digital-employee

echo "1. 停止所有服务..."
pkill -f "uvicorn"
pkill -f "next"
sleep 5

echo "2. 重启后端服务..."
cd backend
source venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
echo "✅ 后端服务已启动"

echo "3. 重启前端服务..."
cd ../dcc-digital-employee
nohup npm start > frontend.log 2>&1 &
echo "✅ 前端服务已启动"

echo "4. 重启Nginx..."
systemctl restart nginx 
echo "✅ Nginx已重启"

echo "5. 等待服务启动..."
sleep 15

echo "6. 检查服务状态..."
echo ""
echo "=== 进程状态 ==="
ps aux | grep -E "(uvicorn|node|nginx)" | grep -v grep

echo ""
echo "=== 端口状态 ==="
netstat -tlnp | grep -E ':(80|443|3000|8000)'

echo ""
echo "=== 服务健康检查 ==="
# 检查后端健康状态
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ 后端服务正常"
else
    echo "❌ 后端服务异常"
fi

# 检查前端状态
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务正常"
else
    echo "❌ 前端服务异常"
fi

# 检查Nginx状态
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx服务正常"
else
    echo "❌ Nginx服务异常"
fi

echo ""
echo "=== 🎉 重启完成 ==="
echo "🌐 访问地址:"
echo "   - 生产环境: https://campus.kongbaijiyi.com"
echo "   - IP访问: http://47.103.27.235"
echo ""
echo "📊 日志位置:"
echo "   - 后端日志: /opt/dcc-digital-employee/backend/backend.log"
echo "   - 前端日志: /opt/dcc-digital-employee/dcc-digital-employee/frontend.log"
echo "   - Nginx日志: /var/log/nginx/access.log"
