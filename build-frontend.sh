#!/bin/bash

# DCC数字员工系统 - 手动构建前端脚本
# 手动执行前端构建步骤

set -e

echo "🔨 手动构建前端"
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

# 检查环境
log_info "检查环境..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js未安装"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    log_error "npm未安装"
    exit 1
fi

log_success "Node.js版本: $(node --version)"
log_success "npm版本: $(npm --version)"

# 进入前端目录
log_info "进入前端目录..."
cd dcc-digital-employee

# 检查package.json
if [ ! -f "package.json" ]; then
    log_error "package.json文件不存在"
    exit 1
fi

# 清理旧文件
log_info "清理旧文件..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf out

# 安装依赖
log_info "安装依赖..."
npm install

# 检查环境变量
log_info "检查环境变量..."
if [ -f "../.env" ]; then
    log_info "加载环境变量..."
    source ../.env
    export NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL:-http://campus.kongbaijiyi.com/api}
    log_success "API地址: $NEXT_PUBLIC_API_BASE_URL"
else
    log_warning "未找到.env文件，使用默认配置"
    export NEXT_PUBLIC_API_BASE_URL=http://campus.kongbaijiyi.com/api
fi

# 构建前端
log_info "开始构建前端..."
npm run build

if [ $? -eq 0 ]; then
    log_success "前端构建成功"
else
    log_error "前端构建失败"
    exit 1
fi

# 检查构建结果
log_info "检查构建结果..."
if [ -d ".next" ]; then
    log_success "✓ .next 目录已创建"
    log_info "构建文件大小: $(du -sh .next)"
else
    log_error "✗ .next 目录未创建"
    exit 1
fi

# 测试启动
log_info "测试启动..."
timeout 10 npm start &
TEST_PID=$!
sleep 5

if kill -0 $TEST_PID 2>/dev/null; then
    log_success "✓ 前端服务可以正常启动"
    kill $TEST_PID
else
    log_error "✗ 前端服务启动失败"
    exit 1
fi

cd ..

echo ""
log_success "前端构建完成！"
echo "================================================"
echo "📝 下一步操作："
echo "1. 重启前端服务: sudo supervisorctl restart dcc-frontend"
echo "2. 检查服务状态: sudo supervisorctl status dcc-frontend"
echo "3. 查看服务日志: sudo supervisorctl tail -f dcc-frontend"
echo ""
