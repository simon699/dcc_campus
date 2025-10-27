#!/bin/bash

# DCC数字员工系统 - 简化构建脚本
# 避免BuildKit问题，使用传统Docker构建

set -e

echo "🔨 DCC数字员工系统 - 简化构建"
echo "================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 设置环境变量禁用BuildKit
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

log_info "禁用BuildKit，使用传统Docker构建..."

# 停止现有服务
log_info "停止现有服务..."
docker-compose -f docker-compose-china.yml down 2>/dev/null || true

# 清理旧镜像
log_info "清理旧镜像..."
docker system prune -f

# 预拉取基础镜像
log_info "预拉取基础镜像..."
docker pull python:3.10-slim || true
docker pull node:lts-alpine || true
docker pull nginx:alpine || true

# 构建后端镜像
log_info "构建后端镜像..."
cd backend
docker build -f Dockerfile.china -t dcc-backend:latest .
cd ..

# 构建前端镜像
log_info "构建前端镜像..."
cd dcc-digital-employee
docker build -f Dockerfile -t dcc-frontend:latest .
cd ..

# 启动服务
log_info "启动服务..."
docker-compose -f docker-compose-china.yml up -d

# 等待服务启动
log_info "等待服务启动..."
sleep 30

# 检查服务状态
log_info "检查服务状态..."
docker-compose -f docker-compose-china.yml ps

echo ""
log_success "构建完成！"
echo "================================================"
echo "🎉 DCC数字员工系统部署完成！"
echo ""
echo "访问地址："
echo "  🌐 主站: http://campus.kongbaijiyi.com"
echo "  📚 API文档: http://campus.kongbaijiyi.com/docs"
echo "  🔍 健康检查: http://campus.kongbaijiyi.com/api/health"
echo ""
