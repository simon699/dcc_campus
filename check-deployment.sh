#!/bin/bash

# DCC数字员工系统 - 部署状态检查脚本

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

echo "🔍 DCC数字员工系统 - 部署状态检查"
echo "================================================"

# 检查Docker服务状态
log_info "检查Docker服务状态..."
if docker-compose ps | grep -q "Up"; then
    log_success "Docker服务运行正常"
    docker-compose ps
else
    log_error "Docker服务未运行或有问题"
    docker-compose ps
fi

echo ""

# 检查服务健康状态
log_info "检查服务健康状态..."

# 检查后端API
log_info "检查后端API (端口8000)..."
if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
    log_success "后端API服务正常"
    curl -s http://localhost:8000/api/health | head -1
else
    log_error "后端API服务异常"
fi

# 检查前端服务
log_info "检查前端服务 (端口3000)..."
if curl -f http://localhost:3000 >/dev/null 2>&1; then
    log_success "前端服务正常"
else
    log_error "前端服务异常"
fi

# 检查Nginx服务
log_info "检查Nginx服务 (端口80)..."
if curl -f http://localhost >/dev/null 2>&1; then
    log_success "Nginx服务正常"
else
    log_error "Nginx服务异常"
fi

echo ""

# 检查数据库连接
log_info "检查数据库连接..."
if docker-compose exec -T backend python -c "
from database.db import get_connection
try:
    with get_connection() as conn:
        print('数据库连接成功')
except Exception as e:
    print(f'数据库连接失败: {e}')
    exit(1)
" 2>/dev/null; then
    log_success "数据库连接正常"
else
    log_error "数据库连接异常"
fi

echo ""

# 检查资源使用情况
log_info "检查资源使用情况..."
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""

# 检查日志
log_info "最近的错误日志..."
echo "=== 后端错误日志 ==="
docker-compose logs --tail=10 backend | grep -i error || echo "无错误日志"

echo ""
echo "=== 前端错误日志 ==="
docker-compose logs --tail=10 frontend | grep -i error || echo "无错误日志"

echo ""
echo "=== Nginx错误日志 ==="
docker-compose logs --tail=10 nginx | grep -i error || echo "无错误日志"

echo ""
echo "================================================"
log_info "检查完成！"
echo ""
echo "访问地址："
echo "  🌐 主站: http://campus.kongbaijiyi.com"
echo "  📚 API文档: http://campus.kongbaijiyi.com/docs"
echo "  🔍 健康检查: http://campus.kongbaijiyi.com/api/health"
echo ""
echo "管理命令："
echo "  📊 查看服务状态: docker-compose ps"
echo "  📝 查看日志: docker-compose logs -f"
echo "  🔄 重启服务: docker-compose restart"
echo "  🛑 停止服务: docker-compose down"
