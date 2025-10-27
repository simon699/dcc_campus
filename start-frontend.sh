#!/bin/bash

# DCC数字员工系统 - 前端快速启动脚本
# 用于手动启动前端服务

echo "🚀 DCC数字员工系统 - 前端快速启动"
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

# 检查前端目录
if [ ! -d "dcc-digital-employee" ]; then
    log_error "未找到前端目录 dcc-digital-employee"
    exit 1
fi

# 检查package.json
if [ ! -f "dcc-digital-employee/package.json" ]; then
    log_error "未找到package.json文件"
    exit 1
fi

# 停止现有服务
log_info "停止现有前端服务..."
pkill -f 'next' 2>/dev/null || true
sleep 2

# 进入前端目录
cd dcc-digital-employee

# 检查是否已构建
if [ ! -d ".next" ]; then
    log_info "未找到构建文件，开始构建..."
    npm run build
fi

# 启动服务
log_info "启动前端服务..."
nohup npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待服务启动
sleep 5

# 检查服务状态
if ps -p $FRONTEND_PID > /dev/null; then
    log_success "前端服务启动成功 (PID: $FRONTEND_PID)"
    log_info "前端服务运行在: http://localhost:3000"
    log_info "日志文件: ../frontend.log"
else
    log_error "前端服务启动失败"
    log_info "请检查日志: tail -f ../frontend.log"
    exit 1
fi

cd ..

log_success "前端服务启动完成！"
