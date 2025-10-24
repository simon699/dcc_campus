#!/bin/bash

# 快速部署DCC服务 - 使用预构建镜像避免构建问题

echo "=== DCC服务快速部署 ==="
echo ""

echo "1. 停止现有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 清理Docker系统："
docker system prune -f
echo ""

echo "3. 配置Docker镜像加速器："
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com",
    "https://crpi-6kf9zd5057bjgono-vpc.cn-shanghai.personal.cr.aliyuncs.com"
  ],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
EOF
echo ""

echo "4. 重启Docker服务："
sudo systemctl restart docker
sleep 15
echo ""

echo "5. 测试镜像拉取："
echo "测试拉取MySQL镜像："
time docker pull mysql:8.0 || echo "MySQL镜像拉取失败"
echo ""

echo "6. 如果镜像拉取失败，使用本地构建："
echo "修改docker-compose配置，使用本地构建..."
echo ""

echo "7. 创建简化的docker-compose配置："
cat > docker-compose-simple.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    container_name: dcc-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: dcc_employee_db
      MYSQL_USER: dcc_user
      MYSQL_PASSWORD: dcc123456
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
      DB_PASSWORD: dcc123456
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

echo "8. 使用简化配置启动服务："
docker-compose -f docker-compose-simple.yml up -d --build
echo ""

echo "9. 等待服务启动："
sleep 60
echo ""

echo "10. 检查服务状态："
docker-compose -f docker-compose-simple.yml ps
echo ""

echo "11. 测试服务访问："
echo "测试API："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 快速部署完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
