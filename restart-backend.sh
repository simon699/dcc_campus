#!/bin/bash

# DCC数字员工系统 - 后端重启脚本
# 用于修改后端代码后重启后端服务

set -e

echo "🔄 DCC数字员工系统 - 后端重启"
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

# 检查后端目录
check_backend_dir() {
    log_info "检查后端目录..."
    if [ ! -d "backend" ]; then
        log_error "未找到后端目录 backend"
        exit 1
    fi
    
    if [ ! -f "backend/main.py" ]; then
        log_error "未找到后端主文件 backend/main.py"
        exit 1
    fi
    
    log_success "后端目录检查通过"
}

# 检查Python环境
check_python_env() {
    log_info "检查Python环境..."
    
    # 检查Python是否安装
    if ! command -v python3 &> /dev/null; then
        log_error "Python3未安装，请先安装Python3"
        exit 1
    fi
    
    # 检查虚拟环境
    if [ ! -d "backend/venv" ]; then
        log_warning "未找到虚拟环境，将创建新的虚拟环境"
        create_venv
    else
        log_success "虚拟环境已存在"
    fi
    
    # 激活虚拟环境
    source backend/venv/bin/activate
    
    # 检查uvicorn是否安装
    if ! python -c "import uvicorn" 2>/dev/null; then
        log_warning "uvicorn未安装，将安装依赖"
        install_dependencies
    else
        log_success "Python环境检查通过"
    fi
}

# 创建虚拟环境
create_venv() {
    log_info "创建Python虚拟环境..."
    cd backend
    python3 -m venv venv
    cd ..
    log_success "虚拟环境创建完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装后端依赖..."
    cd backend
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 配置pip镜像源
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
    
    # 安装依赖
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        log_warning "未找到requirements.txt，安装基础依赖"
        pip install fastapi uvicorn python-multipart python-jose[cryptography] passlib[bcrypt] python-dotenv mysql-connector-python
    fi
    
    cd ..
    log_success "后端依赖安装完成"
}

# 停止后端服务
stop_backend() {
    log_info "停止后端服务..."
    
    # 查找并停止FastAPI/uvicorn进程
    local backend_pids=$(ps aux | grep "uvicorn\|fastapi\|main.py" | grep -v grep | awk '{print $2}' || true)
    
    if [ -n "$backend_pids" ]; then
        log_info "发现后端进程: $backend_pids"
        echo "$backend_pids" | xargs kill -9 2>/dev/null || true
        sleep 2
        log_success "后端服务已停止"
    else
        log_warning "未发现运行中的后端服务"
    fi
}

# 检查环境变量
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    source .env
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        log_error ".env文件中缺少数据库连接信息"
        exit 1
    fi
    log_success "环境变量配置检查通过"
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务..."
    cd backend
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 启动FastAPI服务（不使用 --reload，生产环境更稳定）
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 8
    
    # 检查端口是否在监听（更可靠的检查方式）
    local max_attempts=10
    local attempt=0
    local port_ready=false
    
    while [ $attempt -lt $max_attempts ]; do
        if netstat -tlnp 2>/dev/null | grep -q ":8000 " || \
           ss -tlnp 2>/dev/null | grep -q ":8000 " || \
           lsof -i :8000 2>/dev/null | grep -q LISTEN; then
            port_ready=true
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
        log_info "等待端口8000就绪... ($attempt/$max_attempts)"
    done
    
    if [ "$port_ready" = true ]; then
        # 获取实际的 uvicorn 进程 PID
        local backend_pid=$(ps aux | grep "uvicorn.*main:app" | grep -v grep | awk '{print $2}' | head -1)
        if [ -n "$backend_pid" ]; then
            log_success "后端服务启动成功 (PID: $backend_pid)"
            log_info "后端服务运行在: http://localhost:8000"
            log_info "API文档: http://localhost:8000/docs"
            log_info "日志文件: backend.log"
        else
            log_warning "端口已监听，但未找到进程ID"
        fi
    else
        log_error "后端服务启动失败：端口8000未在监听"
        log_info "查看日志文件最后20行:"
        tail -20 ../backend.log 2>/dev/null || echo "无法读取日志文件"
        exit 1
    fi
    
    cd ..
}

# 检查服务状态
check_service_status() {
    log_info "检查后端服务状态..."
    
    # 检查端口是否被占用（使用多种方法）
    local port_listening=false
    if netstat -tlnp 2>/dev/null | grep -q ":8000 " || \
       ss -tlnp 2>/dev/null | grep -q ":8000 " || \
       lsof -i :8000 2>/dev/null | grep -q LISTEN; then
        port_listening=true
    fi
    
    if [ "$port_listening" = true ]; then
        log_success "后端服务运行正常 (端口8000正在监听)"
    else
        log_error "后端服务端口8000未在监听"
        log_info "查看日志文件最后30行:"
        tail -30 backend.log 2>/dev/null || echo "无法读取日志文件"
        exit 1
    fi
    
    # 检查进程
    local backend_pids=$(ps aux | grep "uvicorn.*main:app" | grep -v grep | awk '{print $2}' || true)
    if [ -n "$backend_pids" ]; then
        log_success "后端进程运行中: $backend_pids"
    else
        log_error "未发现后端进程"
        log_info "查看日志文件最后30行:"
        tail -30 backend.log 2>/dev/null || echo "无法读取日志文件"
        exit 1
    fi
    
    # 测试API健康检查（多次尝试）
    log_info "测试API健康检查..."
    local health_check_passed=false
    for i in {1..5}; do
        sleep 2
        if curl -s -f "http://localhost:8000/api/health" >/dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        log_info "健康检查尝试 $i/5..."
    done
    
    if [ "$health_check_passed" = true ]; then
        log_success "API健康检查通过"
    else
        log_warning "API健康检查失败"
        log_info "尝试直接访问: curl http://localhost:8000/api/health"
        log_info "查看日志文件最后30行:"
        tail -30 backend.log 2>/dev/null || echo "无法读取日志文件"
    fi
}

# 显示服务信息
show_service_info() {
    echo ""
    log_info "服务信息:"
    log_info "后端地址: http://localhost:8000"
    log_info "API文档: http://localhost:8000/docs"
    log_info "日志文件: backend.log"
    log_info "进程ID: $(ps aux | grep 'uvicorn\|fastapi\|main.py' | grep -v grep | awk '{print $2}' | head -1)"
    echo ""
    log_info "常用命令:"
    log_info "查看日志: tail -f backend.log"
    log_info "停止服务: pkill -f 'uvicorn\|fastapi\|main.py'"
    log_info "重启服务: ./restart-backend.sh"
    log_info "测试API: curl http://localhost:8000/api/health"
}

# 主函数
main() {
    echo "开始重启后端服务..."
    echo ""
    
    check_backend_dir
    check_python_env
    check_env
    stop_backend
    start_backend
    check_service_status
    show_service_info
    
    log_success "后端服务重启完成！"
}

# 错误处理
trap 'log_error "后端重启过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
