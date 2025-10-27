#!/bin/bash

# DCC数字员工系统 - Node.js镜像版本测试脚本
# 测试不同版本的Node.js镜像是否可用

set -e

echo "🧪 Node.js镜像版本测试"
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

# 测试镜像拉取函数
test_image() {
    local image=$1
    log_info "测试镜像: $image"
    
    if timeout 60 docker pull "$image" >/dev/null 2>&1; then
        log_success "✓ $image 可用"
        docker rmi "$image" >/dev/null 2>&1 || true
        return 0
    else
        log_error "✗ $image 不可用"
        return 1
    fi
}

# Node.js版本列表
node_versions=(
    "node:18-alpine"
    "node:20-alpine"
    "node:20-slim"
    "node:18-slim"
    "node:lts-alpine"
    "node:lts-slim"
)

log_info "开始测试Node.js镜像版本..."

available_versions=()
for version in "${node_versions[@]}"; do
    if test_image "$version"; then
        available_versions+=("$version")
    fi
done

echo ""
if [ ${#available_versions[@]} -gt 0 ]; then
    log_success "可用的Node.js版本："
    for version in "${available_versions[@]}"; do
        echo "  ✓ $version"
    done
    
    # 推荐使用第一个可用版本
    recommended_version="${available_versions[0]}"
    echo ""
    log_info "推荐使用: $recommended_version"
    
    # 更新Dockerfile建议
    echo ""
    log_info "建议更新Dockerfile中的FROM指令为："
    echo "FROM $recommended_version AS base"
    
else
    log_error "没有找到可用的Node.js版本"
    echo ""
    log_info "建议检查："
    echo "1. 网络连接是否正常"
    echo "2. Docker镜像加速器是否配置正确"
    echo "3. 尝试手动拉取: docker pull node:20-alpine"
fi

echo ""
log_info "测试完成"
