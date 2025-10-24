#!/bin/bash

# Docker清理脚本 - 删除所有镜像和容器

set -e

echo "=========================================="
echo "开始清理Docker环境"
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

# 停止所有容器
print_info "停止所有运行中的容器..."
docker stop $(docker ps -aq) 2>/dev/null || true

# 删除所有容器
print_info "删除所有容器..."
docker rm $(docker ps -aq) 2>/dev/null || true

# 删除所有镜像
print_info "删除所有镜像..."
docker rmi $(docker images -aq) 2>/dev/null || true

# 删除所有卷
print_info "删除所有卷..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

# 删除所有网络
print_info "删除所有网络..."
docker network rm $(docker network ls -q) 2>/dev/null || true

# 清理系统
print_info "清理Docker系统..."
docker system prune -af --volumes

print_info "Docker环境清理完成！"

# 显示清理结果
print_info "清理后的Docker状态："
echo "容器数量: $(docker ps -aq | wc -l)"
echo "镜像数量: $(docker images -aq | wc -l)"
echo "卷数量: $(docker volume ls -q | wc -l)"
echo "网络数量: $(docker network ls -q | wc -l)"

echo "=========================================="
echo "Docker清理完成"
echo "=========================================="
