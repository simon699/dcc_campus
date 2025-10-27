#!/bin/bash

# DCC数字员工系统 - 前端构建修复脚本
# 修复前端服务启动失败的问题

set -e

echo "🔧 前端构建修复脚本"
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

# 检查当前目录
if [[ ! -d "dcc-digital-employee" ]]; then
    log_error "请在项目根目录下运行此脚本"
    exit 1
fi

log_info "停止前端服务..."
sudo supervisorctl stop dcc-frontend || true

log_info "进入前端目录..."
cd dcc-digital-employee

log_info "检查Node.js和npm版本..."
node --version
npm --version

log_info "清理旧的构建文件..."
rm -rf .next
rm -rf node_modules/.cache

log_info "重新安装依赖..."
npm install

log_info "构建前端生产版本..."
npm run build

if [ $? -eq 0 ]; then
    log_success "前端构建成功"
else
    log_error "前端构建失败"
    exit 1
fi

log_info "检查构建结果..."
if [ -d ".next" ]; then
    log_success "✓ .next 目录已创建"
    ls -la .next/
else
    log_error "✗ .next 目录未创建"
    exit 1
fi

cd ..

log_info "重启前端服务..."
sudo supervisorctl start dcc-frontend

sleep 5

log_info "检查服务状态..."
sudo supervisorctl status dcc-frontend

echo ""
log_success "前端修复完成！"
echo "================================================"
echo "📝 如果服务仍然有问题，请检查："
echo "1. 查看详细日志: sudo supervisorctl tail -f dcc-frontend"
echo "2. 检查端口占用: netstat -tlnp | grep 3000"
echo "3. 手动测试: cd dcc-digital-employee && npm start"
echo ""
