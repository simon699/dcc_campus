#!/bin/bash

# 快速部署脚本 - 使用预构建镜像和优化设置

set -e

echo "=========================================="
echo "开始快速部署DCC数字员工系统"
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

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose未安装"
    exit 1
fi

print_info "Docker环境检查完成"

# 配置Docker镜像源
print_info "配置Docker镜像源..."
if [ ! -f /etc/docker/daemon.json ]; then
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
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
EOF
    print_info "Docker镜像源配置完成，重启Docker服务..."
    sudo systemctl restart docker
    sleep 5
fi

# 停止现有服务
print_info "停止现有服务..."
docker-compose -f docker-compose.yml down 2>/dev/null || true
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || true
docker-compose -f docker-compose-fast.yml down 2>/dev/null || true

# 清理Docker环境
print_info "清理Docker环境..."
docker system prune -f

# 拉取预构建镜像
print_info "拉取预构建镜像..."
docker pull mysql:8.0
docker pull node:18-alpine
docker pull nginx:alpine

# 启动MySQL服务
print_info "启动MySQL服务..."
docker-compose -f docker-compose-fast.yml up -d mysql

# 等待MySQL启动
print_info "等待MySQL服务启动..."
sleep 15

# 检查MySQL状态
print_info "检查MySQL服务状态..."
if docker ps | grep -q dcc-mysql; then
    print_info "MySQL服务启动成功"
else
    print_error "MySQL服务启动失败"
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

# 启动后端服务
print_info "启动后端服务..."
docker-compose -f docker-compose-fast.yml up -d backend

# 等待后端启动
print_info "等待后端服务启动..."
sleep 20

# 检查后端状态
print_info "检查后端服务状态..."
if docker ps | grep -q dcc-backend; then
    print_info "后端服务启动成功"
else
    print_error "后端服务启动失败"
    docker logs dcc-backend
    exit 1
fi

# 启动前端服务
print_info "启动前端服务..."
docker-compose -f docker-compose-fast.yml up -d frontend

# 等待前端启动
print_info "等待前端服务启动..."
sleep 30

# 启动Nginx服务
print_info "启动Nginx服务..."
docker-compose -f docker-compose-fast.yml up -d nginx

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
echo "快速部署完成"
echo "=========================================="
