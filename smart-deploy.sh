#!/bin/bash

# DCC数字员工系统 - 智能部署脚本
# 自动处理端口冲突、代码更新和服务重启

set -e

echo "🚀 DCC数字员工系统 - 智能部署"
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

# 检查端口占用
check_port() {
    local port=$1
    local service_name=$2
    
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        log_warning "$service_name 端口 $port 被占用"
        return 1
    else
        log_success "$service_name 端口 $port 可用"
        return 0
    fi
}

# 强制释放端口
force_release_port() {
    local port=$1
    local service_name=$2
    
    log_info "强制释放 $service_name 端口 $port..."
    
    # 查找占用端口的进程
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        log_info "发现占用端口 $port 的进程: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 2
        log_success "端口 $port 已释放"
    else
        log_warning "未发现占用端口 $port 的进程"
    fi
}

# 检查服务状态
check_service_health() {
    local url=$1
    local service_name=$2
    local max_attempts=10
    local attempt=1
    
    log_info "检查 $service_name 健康状态..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            log_success "$service_name 健康检查通过"
            return 0
        else
            log_info "等待 $service_name 启动... ($attempt/$max_attempts)"
            sleep 3
            attempt=$((attempt + 1))
        fi
    done
    
    log_error "$service_name 健康检查失败"
    return 1
}

# 智能重启后端
smart_restart_backend() {
    log_info "智能重启后端服务..."
    
    # 检查端口8000
    if ! check_port 8000 "后端"; then
        force_release_port 8000 "后端"
    fi
    
    # 停止现有后端服务
    local backend_pids=$(ps aux | grep "uvicorn\|fastapi\|main.py" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$backend_pids" ]; then
        log_info "停止现有后端进程: $backend_pids"
        echo "$backend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # 启动后端服务
    cd backend
    source venv/bin/activate
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../backend.log 2>&1 &
    local backend_pid=$!
    cd ..
    
    # 等待服务启动
    sleep 5
    
    # 检查服务状态
    if ps -p $backend_pid > /dev/null; then
        log_success "后端服务启动成功 (PID: $backend_pid)"
    else
        log_error "后端服务启动失败"
        return 1
    fi
    
    # 健康检查
    check_service_health "http://localhost:8000/api/health" "后端"
}

# 智能重启前端
smart_restart_frontend() {
    log_info "智能重启前端服务..."
    
    # 检查端口3001
    if ! check_port 3001 "前端"; then
        force_release_port 3001 "前端"
    fi
    
    # 停止现有前端服务
    local frontend_pids=$(ps aux | grep "next" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$frontend_pids" ]; then
        log_info "停止现有前端进程: $frontend_pids"
        echo "$frontend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # 检查是否需要重新构建
    cd dcc-digital-employee
    
    # 检查package.json是否有更新
    if [ -f ".next/BUILD_ID" ]; then
        local build_id=$(cat .next/BUILD_ID)
        local package_time=$(stat -c %Y package.json)
        local build_time=$(stat -c %Y .next/BUILD_ID)
        
        if [ $package_time -gt $build_time ]; then
            log_info "检测到依赖更新，重新构建..."
            npm run build
        else
            log_info "使用现有构建文件"
        fi
    else
        log_info "未找到构建文件，开始构建..."
        npm run build
    fi
    
    # 启动前端服务
    nohup npm start > ../frontend.log 2>&1 &
    local frontend_pid=$!
    cd ..
    
    # 等待服务启动
    sleep 5
    
    # 检查服务状态
    if ps -p $frontend_pid > /dev/null; then
        log_success "前端服务启动成功 (PID: $frontend_pid)"
    else
        log_error "前端服务启动失败"
        return 1
    fi
    
    # 健康检查
    check_service_health "http://localhost:3001" "前端"
}

# 显示部署结果
show_deployment_result() {
    echo ""
    log_info "部署结果:"
    log_info "后端地址: http://localhost:8000"
    log_info "前端地址: http://localhost:3001"
    log_info "API文档: http://localhost:8000/docs"
    echo ""
    log_info "服务进程:"
    log_info "后端PID: $(ps aux | grep 'uvicorn\|fastapi\|main.py' | grep -v grep | awk '{print $2}' | head -1)"
    log_info "前端PID: $(ps aux | grep 'next' | grep -v grep | awk '{print $2}' | head -1)"
    echo ""
    log_info "日志文件:"
    log_info "后端日志: tail -f backend.log"
    log_info "前端日志: tail -f frontend.log"
    echo ""
    log_info "管理命令:"
    log_info "热重载前端: ./hot-reload-frontend.sh"
    log_info "完整重启: ./smart-deploy.sh"
    log_info "停止所有服务: pkill -f 'uvicorn\|next'"
}

# 主函数
main() {
    echo "开始智能部署..."
    echo ""
    
    # 检查目录结构
    if [ ! -d "backend" ] || [ ! -d "dcc-digital-employee" ]; then
        log_error "项目目录结构不正确"
        exit 1
    fi
    
    # 检查环境变量
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    
    # 智能重启服务
    smart_restart_backend
    smart_restart_frontend
    
    # 显示结果
    show_deployment_result
    
    log_success "智能部署完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
