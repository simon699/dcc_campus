#!/bin/bash

echo "=== 服务器调试脚本 ==="

SERVER_IP="47.103.27.235"

echo "1. 检查服务器连接..."
ssh root@${SERVER_IP} << 'EOF'
    echo "=== 系统信息 ==="
    uname -a
    echo ""
    
    echo "=== Docker状态 ==="
    systemctl status docker
    echo ""
    
    echo "=== Docker版本 ==="
    docker --version
    docker-compose --version
    echo ""
    
    echo "=== 检查项目目录 ==="
    ls -la /opt/dcc-digital-employee/ 2>/dev/null || echo "项目目录不存在"
    echo ""
    
    echo "=== 检查Docker镜像 ==="
    docker images | grep crpi
    echo ""
    
    echo "=== 检查容器状态 ==="
    docker ps -a
    echo ""
    
    echo "=== 检查端口占用 ==="
    netstat -tlnp | grep -E ':(80|443|3000|8000)'
    echo ""
    
    echo "=== 检查防火墙 ==="
    ufw status
    echo ""
EOF

echo "2. 如果服务未部署，请运行："
echo "./deploy-acr-server.sh deploy"
