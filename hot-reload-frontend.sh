#!/bin/bash

# DCC数字员工系统 - 前端热重载脚本
# 用于代码修改后快速重启前端服务，无需重新构建

set -e

echo "🔥 DCC数字员工系统 - 前端热重载"
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
check_frontend_dir() {
    log_info "检查前端目录..."
    if [ ! -d "dcc-digital-employee" ]; then
        log_error "未找到前端目录 dcc-digital-employee"
        exit 1
    fi
    log_success "前端目录检查通过"
}

# 停止前端服务
stop_frontend() {
    log_info "停止前端服务..."
    
    # 查找并停止Next.js进程
    local frontend_pids=$(ps aux | grep "next" | grep -v grep | awk '{print $2}' || true)
    
    if [ -n "$frontend_pids" ]; then
        log_info "发现前端进程: $frontend_pids"
        echo "$frontend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
        log_success "前端服务已停止"
    else
        log_warning "未发现运行中的前端服务"
    fi
}

# 快速重启前端服务（不重新构建）
quick_restart_frontend() {
    log_info "快速重启前端服务..."
    
    # 确保在正确的目录
    if [ ! -f "dcc-digital-employee/package.json" ]; then
        log_error "未找到前端package.json文件"
        exit 1
    fi
    
    # 启动生产服务器（使用已构建的文件）
    cd dcc-digital-employee
    
    # 检查是否已构建
    if [ ! -d ".next" ]; then
        log_warning "未找到构建文件，将进行构建..."
        npm run build
    fi
    
    nohup npm start > ../frontend.log 2>&1 &
    local frontend_pid=$!
    cd ..
    
    # 等待服务启动
    sleep 3
    
    # 检查服务是否启动成功
    if ps -p $frontend_pid > /dev/null; then
        log_success "前端服务启动成功 (PID: $frontend_pid)"
        log_info "前端服务运行在: http://localhost:3001"
        log_info "日志文件: frontend.log"
    else
        log_error "前端服务启动失败"
        log_info "请检查日志文件: frontend.log"
        exit 1
    fi
}

# 检查服务状态
check_service_status() {
    log_info "检查前端服务状态..."
    
    # 等待服务完全启动
    sleep 2
    
    # 检查端口是否被占用
    if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
        log_success "前端服务运行正常 (端口3001)"
    else
        log_warning "前端服务可能未完全启动，请稍等片刻"
    fi
    
    # 检查进程
    local frontend_pids=$(ps aux | grep "next" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$frontend_pids" ]; then
        log_success "前端进程运行中: $frontend_pids"
    else
        log_error "未发现前端进程"
        exit 1
    fi
}

# 显示服务信息
show_service_info() {
    echo ""
    log_info "服务信息:"
    log_info "前端地址: http://localhost:3001"
    log_info "日志文件: frontend.log"
    log_info "进程ID: $(ps aux | grep 'next' | grep -v grep | awk '{print $2}' | head -1)"
    echo ""
    log_info "常用命令:"
    log_info "查看日志: tail -f frontend.log"
    log_info "停止服务: pkill -f 'next'"
    log_info "热重载: ./hot-reload-frontend.sh"
    log_info "完整重启: ./restart-frontend.sh"
}

# 主函数
main() {
    echo "开始前端热重载..."
    echo ""
    
    check_frontend_dir
    stop_frontend
    quick_restart_frontend
    check_service_status
    show_service_info
    
    log_success "前端热重载完成！"
}

# 错误处理
trap 'log_error "前端热重载过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
