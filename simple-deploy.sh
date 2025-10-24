#!/bin/bash

# 简化部署脚本 - 避免Docker Compose超时问题

set -e

echo "=========================================="
echo "简化部署DCC数字员工系统"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker环境
if ! command -v docker &> /dev/null; then
    print_error "Docker未安装"
    exit 1
fi

print_info "Docker环境检查完成"

# 停止现有容器
print_info "停止现有容器..."
docker stop dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true
docker rm dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true

# 创建网络
print_info "创建Docker网络..."
docker network create dcc-network 2>/dev/null || true

# 启动MySQL
print_info "启动MySQL服务..."
docker run -d \
  --name dcc-mysql \
  --network dcc-network \
  -e MYSQL_ROOT_PASSWORD=root123456 \
  -e MYSQL_DATABASE=dcc_employee_db \
  -e MYSQL_USER=dcc_user \
  -e MYSQL_PASSWORD=",Dcc123456" \
  -e TZ=Asia/Shanghai \
  -p 3307:3306 \
  -v mysql_data:/var/lib/mysql \
  -v $(pwd)/backend/database:/docker-entrypoint-initdb.d:ro \
  --restart always \
  mysql:8.0

# 等待MySQL启动
print_info "等待MySQL启动..."
sleep 20

# 检查MySQL状态
print_info "检查MySQL状态..."
if docker ps | grep -q dcc-mysql; then
    print_info "MySQL启动成功"
else
    print_error "MySQL启动失败"
    docker logs dcc-mysql
    exit 1
fi

# 测试MySQL连接
print_info "测试MySQL连接..."
max_attempts=20
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec dcc-mysql mysqladmin ping -h localhost -u root -proot123456 &>/dev/null; then
        print_info "MySQL连接测试成功"
        break
    else
        print_warning "MySQL连接测试失败，重试 $attempt/$max_attempts"
        sleep 3
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "MySQL连接测试失败"
    docker logs dcc-mysql
    exit 1
fi

# 构建后端镜像
print_info "构建后端镜像..."
cd backend
docker build -f Dockerfile.fast -t dcc-backend:latest .
cd ..

# 启动后端
print_info "启动后端服务..."
docker run -d \
  --name dcc-backend \
  --network dcc-network \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e DB_USER=dcc_user \
  -e DB_PASSWORD=",Dcc123456" \
  -e DB_NAME=dcc_employee_db \
  -e JWT_SECRET_KEY=dcc-jwt-secret-key-2024 \
  -e JWT_EXPIRE_HOURS=24 \
  -e ENVIRONMENT=production \
  -e DEBUG=False \
  -p 8001:8000 \
  --restart always \
  dcc-backend:latest

# 等待后端启动
print_info "等待后端启动..."
sleep 15

# 检查后端状态
print_info "检查后端状态..."
if docker ps | grep -q dcc-backend; then
    print_info "后端启动成功"
else
    print_error "后端启动失败"
    docker logs dcc-backend
    exit 1
fi

# 启动前端
print_info "启动前端服务..."
docker run -d \
  --name dcc-frontend \
  --network dcc-network \
  -e NODE_ENV=production \
  -e DOCKER_ENV=true \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost/api \
  -p 3001:3000 \
  -v $(pwd)/dcc-digital-employee:/app \
  -v /app/node_modules \
  -v /app/.next \
  --restart always \
  node:18-alpine \
  sh -c "cd /app && npm install --registry=https://registry.npmmirror.com && npm run build && npm start"

# 等待前端启动
print_info "等待前端启动..."
sleep 30

# 启动Nginx
print_info "启动Nginx服务..."
docker run -d \
  --name dcc-nginx \
  --network dcc-network \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx-docker.conf:/etc/nginx/nginx.conf:ro \
  --restart always \
  nginx:alpine

# 显示服务状态
print_info "所有服务启动完成！"
print_info "服务状态："
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

print_info "服务访问信息："
echo "  前端: http://localhost:3001"
echo "  后端: http://localhost:8001"
echo "  Nginx: http://localhost"
echo "  MySQL: localhost:3307"

echo "=========================================="
echo "简化部署完成"
echo "=========================================="
