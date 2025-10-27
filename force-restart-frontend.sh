#!/bin/bash

# DCC数字员工系统 - 强制重启前端脚本
# 彻底清理端口并重启前端服务

echo "🔄 DCC数字员工系统 - 强制重启前端"
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

# 强制停止所有相关进程
force_stop_frontend() {
    log_info "强制停止所有前端相关进程..."
    
    # 停止Next.js进程
    pkill -9 -f 'next' 2>/dev/null || true
    pkill -9 -f 'node.*next' 2>/dev/null || true
    
    # 停止占用3000端口的进程
    local port_pids=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        log_info "发现占用3000端口的进程: $port_pids"
        echo "$port_pids" | xargs kill -9 2>/dev/null || true
    fi
    
    # 等待进程完全停止
    sleep 3
    
    # 再次检查
    local remaining_pids=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$remaining_pids" ]; then
        log_warning "仍有进程占用3000端口: $remaining_pids"
        echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    log_success "前端进程清理完成"
}

# 检查端口状态
check_port_status() {
    log_info "检查3000端口状态..."
    
    local port_pids=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
        log_error "3000端口仍被占用: $port_pids"
        return 1
    else
        log_success "3000端口可用"
        return 0
    fi
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."
    
    # 确保在正确的目录
    if [ ! -f "dcc-digital-employee/package.json" ]; then
        log_error "未找到前端package.json文件"
        exit 1
    fi
    
    cd dcc-digital-employee
    
    # 检查是否已构建
    if [ ! -d ".next" ]; then
        log_info "未找到构建文件，开始构建..."
        npm run build
    fi
    
    # 启动服务
    log_info "启动Next.js生产服务器..."
    nohup npm start > ../frontend.log 2>&1 &
    local frontend_pid=$!
    
    cd ..
    
    # 等待服务启动
    sleep 5
    
    # 检查服务是否启动成功
    if ps -p $frontend_pid > /dev/null; then
        log_success "前端服务启动成功 (PID: $frontend_pid)"
        log_info "前端服务运行在: http://localhost:3000"
        log_info "日志文件: frontend.log"
        return 0
    else
        log_error "前端服务启动失败"
        log_info "请检查日志文件: frontend.log"
        return 1
    fi
}

# 验证服务状态
verify_service() {
    log_info "验证前端服务状态..."
    
    # 等待服务完全启动
    sleep 3
    
    # 检查进程
    local frontend_pids=$(ps aux | grep "next" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$frontend_pids" ]; then
        log_success "前端进程运行中: $frontend_pids"
    else
        log_error "未发现前端进程"
        return 1
    fi
    
    # 检查端口
    if lsof -i:3000 >/dev/null 2>&1; then
        log_success "3000端口被正确占用"
    else
        log_warning "3000端口未被占用，服务可能未完全启动"
    fi
    
    # 测试HTTP连接
    sleep 2
    if curl -s "http://localhost:3000" >/dev/null 2>&1; then
        log_success "前端服务HTTP连接正常"
    else
        log_warning "前端服务HTTP连接失败，可能还在启动中"
    fi
}

# 主函数
main() {
    echo "开始强制重启前端服务..."
    echo ""
    
    force_stop_frontend
    
    if ! check_port_status; then
        log_error "无法清理3000端口，请手动检查"
        exit 1
    fi
    
    if start_frontend; then
        verify_service
        log_success "前端服务强制重启完成！"
        echo ""
        log_info "服务信息:"
        log_info "前端地址: http://localhost:3000"
        log_info "日志文件: frontend.log"
        log_info "进程ID: $(ps aux | grep 'next' | grep -v grep | awk '{print $2}' | head -1)"
    else
        log_error "前端服务启动失败"
        log_info "请检查日志: tail -f frontend.log"
        exit 1
    fi
}

# 错误处理
trap 'log_error "强制重启过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
