#!/bin/bash

# 彻底修复所有超时问题

echo "=== 彻底修复所有超时问题 ==="
echo ""

echo "1. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 停止Docker服务："
sudo systemctl stop docker
echo ""

echo "3. 检查现有Docker配置："
if [ -f /etc/docker/daemon.json ]; then
    echo "现有配置："
    cat /etc/docker/daemon.json
    echo ""
else
    echo "没有现有配置文件"
    echo ""
fi

echo "4. 创建正确的Docker daemon配置："
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://g0qd096q.mirror.aliyuncs.com",
    "https://docker-0.unsee.tech",
    "https://docker.xuanyuan.me",
    "https://mirror.ccs.tencentyun.com"
  ],
  "max-concurrent-downloads": 1,
  "max-concurrent-uploads": 1,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
echo ""

echo "5. 显示新配置："
cat /etc/docker/daemon.json
echo ""

echo "6. 启动Docker服务："
sudo systemctl start docker
echo ""

echo "7. 等待Docker服务启动："
sleep 20
echo ""

echo "8. 检查Docker服务状态："
sudo systemctl status docker --no-pager
echo ""

echo "9. 验证Docker配置："
docker info | grep -A 5 "Registry Mirrors" || echo "无法获取镜像源信息"
echo ""

echo "10. 测试基础镜像拉取："
echo "测试拉取Alpine镜像："
timeout 60 docker pull alpine:latest || echo "Alpine镜像拉取失败"
echo ""

echo "11. 测试Python镜像拉取："
echo "测试拉取Python镜像："
timeout 60 docker pull python:3.10-slim || echo "Python镜像拉取失败"
echo ""

echo "12. 测试Node.js镜像拉取："
echo "测试拉取Node.js镜像："
timeout 60 docker pull node:18-alpine || echo "Node.js镜像拉取失败"
echo ""

echo "13. 如果镜像拉取仍然失败，使用本地构建："
echo "创建简化的docker-compose配置..."
cat > docker-compose-local.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    container_name: dcc-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: dcc_employee_db
      MYSQL_USER: dcc_user
      MYSQL_PASSWORD: ",Dcc123456"
      TZ: Asia/Shanghai
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - dcc-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: dcc-backend
    restart: always
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: dcc_user
      DB_PASSWORD: ",Dcc123456"
      DB_NAME: dcc_employee_db
      JWT_SECRET_KEY: dcc-jwt-secret-key-2024
      JWT_EXPIRE_HOURS: 24
      ENVIRONMENT: production
      DEBUG: "False"
    ports:
      - "8001:8000"
    depends_on:
      - mysql
    networks:
      - dcc-network

  frontend:
    build:
      context: ./dcc-digital-employee
      dockerfile: Dockerfile
    container_name: dcc-frontend
    restart: always
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_BASE_URL: http://localhost/api
    ports:
      - "3001:3000"
    depends_on:
      - backend
    networks:
      - dcc-network

  nginx:
    image: nginx:alpine
    container_name: dcc-nginx
    restart: always
    ports:
      - "8080:80"
    volumes:
      - ./nginx-multi-project.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - dcc-network

networks:
  dcc-network:
    driver: bridge

volumes:
  mysql_data:
    driver: local
EOF
echo ""

echo "14. 使用简化配置启动服务："
docker-compose -f docker-compose-local.yml up -d --build
echo ""

echo "15. 等待服务启动："
sleep 90
echo ""

echo "16. 检查服务状态："
docker-compose -f docker-compose-local.yml ps
echo ""

echo "17. 查看服务日志："
echo "后端服务日志："
docker-compose -f docker-compose-local.yml logs --tail=10 backend
echo ""
echo "前端服务日志："
docker-compose -f docker-compose-local.yml logs --tail=10 frontend
echo ""

echo "18. 测试服务访问："
echo "测试API："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 超时问题修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
echo ""

echo "如果仍然有问题，请检查："
echo "1. 网络连接：ping g0qd096q.mirror.aliyuncs.com"
echo "2. 防火墙设置：sudo ufw status"
echo "3. 服务器资源：free -h && df -h"
echo "4. 考虑重启服务器：sudo reboot"
