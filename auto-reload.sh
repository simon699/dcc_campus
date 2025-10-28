#!/bin/bash

# DCC数字员工系统 - 文件监控自动重启脚本
# 监控代码文件变化，自动重启相应服务

set -e

echo "👀 DCC数字员工系统 - 文件监控自动重启"
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

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v inotifywait &> /dev/null; then
        log_error "inotifywait 未安装，请安装 inotify-tools"
        log_info "Ubuntu/Debian: sudo apt-get install inotify-tools"
        log_info "CentOS/RHEL: sudo yum install inotify-tools"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 重启前端服务
restart_frontend() {
    log_info "检测到前端文件变化，重启前端服务..."
    
    # 停止前端服务
    local frontend_pids=$(ps aux | grep "next" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$frontend_pids" ]; then
        echo "$frontend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # 启动前端服务
    cd dcc-digital-employee
    nohup npm start > ../frontend.log 2>&1 &
    cd ..
    
    sleep 3
    log_success "前端服务已重启"
}

# 重启后端服务
restart_backend() {
    log_info "检测到后端文件变化，重启后端服务..."
    
    # 停止后端服务
    local backend_pids=$(ps aux | grep "uvicorn\|fastapi\|main.py" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$backend_pids" ]; then
        echo "$backend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # 启动后端服务
    cd backend
    source venv/bin/activate
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../backend.log 2>&1 &
    cd ..
    
    sleep 3
    log_success "后端服务已重启"
}

# 监控前端文件
monitor_frontend() {
    log_info "开始监控前端文件..."
    
    inotifywait -m -r -e modify,create,delete,move \
        --exclude '\.(log|tmp|cache|git)' \
        dcc-digital-employee/src/ \
        dcc-digital-employee/public/ \
        dcc-digital-employee/package.json \
        dcc-digital-employee/next.config.js \
        dcc-digital-employee/tailwind.config.js \
        dcc-digital-employee/tsconfig.json 2>/dev/null | while read path action file; do
        log_info "前端文件变化: $path$file ($action)"
        restart_frontend
    done
}

# 监控后端文件
monitor_backend() {
    log_info "开始监控后端文件..."
    
    inotifywait -m -r -e modify,create,delete,move \
        --exclude '\.(log|tmp|cache|git|pyc|__pycache__)' \
        backend/api/ \
        backend/database/ \
        backend/utils/ \
        backend/main.py \
        backend/config.py \
        backend/requirements.txt 2>/dev/null | while read path action file; do
        log_info "后端文件变化: $path$file ($action)"
        restart_backend
    done
}

# 显示监控状态
show_monitor_status() {
    echo ""
    log_info "监控状态:"
    log_info "前端监控: dcc-digital-employee/src/, dcc-digital-employee/public/"
    log_info "后端监控: backend/api/, backend/database/, backend/utils/"
    log_info "服务地址:"
    log_info "  前端: http://localhost:3001"
    log_info "  后端: http://localhost:8000"
    echo ""
    log_info "按 Ctrl+C 停止监控"
}

# 主函数
main() {
    echo "启动文件监控自动重启..."
    echo ""
    
    # 检查依赖
    check_dependencies
    
    # 检查目录
    if [ ! -d "dcc-digital-employee" ] || [ ! -d "backend" ]; then
        log_error "项目目录结构不正确"
        exit 1
    fi
    
    # 显示状态
    show_monitor_status
    
    # 启动监控（并行）
    monitor_frontend &
    monitor_backend &
    
    # 等待用户中断
    wait
}

# 清理函数
cleanup() {
    log_info "停止监控..."
    pkill -f "inotifywait" 2>/dev/null || true
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 执行主函数
main "$@"
