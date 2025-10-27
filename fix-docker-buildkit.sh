#!/bin/bash

# DCC数字员工系统 - Docker BuildKit修复脚本
# 解决Docker BuildKit组件缺失问题

set -e

echo "🔧 Docker BuildKit修复脚本"
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

log_info "检查Docker BuildKit状态..."

# 检查Docker版本
docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
log_info "Docker版本: $docker_version"

# 检查buildx是否可用
if docker buildx version >/dev/null 2>&1; then
    log_success "✓ Docker buildx 已安装"
    docker buildx version
else
    log_warning "⚠ Docker buildx 未安装或不可用"
fi

# 检查BuildKit状态
if docker info | grep -q "BuildKit.*true"; then
    log_info "BuildKit 已启用"
else
    log_info "BuildKit 未启用"
fi

echo ""
log_info "修复方案："

# 方案1：安装buildx
log_info "方案1: 安装Docker buildx"
if ! docker buildx version >/dev/null 2>&1; then
    log_info "安装Docker buildx..."
    
    # 创建buildx插件目录
    mkdir -p ~/.docker/cli-plugins
    
    # 下载buildx插件
    BUILDX_VERSION=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep 'tag_name' | cut -d\" -f4)
    log_info "下载buildx版本: $BUILDX_VERSION"
    
    # 根据系统架构下载对应的buildx
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        armv7l) ARCH="arm-v7" ;;
        *) log_error "不支持的架构: $ARCH"; exit 1 ;;
    esac
    
    # 下载buildx
    curl -L "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-${ARCH}" -o ~/.docker/cli-plugins/docker-buildx
    chmod +x ~/.docker/cli-plugins/docker-buildx
    
    if docker buildx version >/dev/null 2>&1; then
        log_success "✓ Docker buildx 安装成功"
    else
        log_error "✗ Docker buildx 安装失败"
    fi
else
    log_success "✓ Docker buildx 已存在"
fi

echo ""
log_info "方案2: 禁用BuildKit使用传统构建"
log_info "设置环境变量禁用BuildKit..."

# 创建环境变量配置文件
cat > ~/.docker_build_config << 'EOF'
# Docker构建配置
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
EOF

log_success "✓ 环境变量配置文件已创建: ~/.docker_build_config"

echo ""
log_info "测试Docker构建..."

# 测试简单构建
if docker build --help >/dev/null 2>&1; then
    log_success "✓ Docker构建功能正常"
else
    log_error "✗ Docker构建功能异常"
fi

echo ""
log_success "修复完成！"
echo "================================================"
echo "📝 使用说明："
echo "1. 重新运行部署脚本: ./deploy-aliyun.sh"
echo "2. 或者手动设置环境变量:"
echo "   export DOCKER_BUILDKIT=0"
echo "   export COMPOSE_DOCKER_CLI_BUILD=0"
echo "   docker-compose -f docker-compose-china.yml build"
echo ""
