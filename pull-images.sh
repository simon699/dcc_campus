#!/bin/bash

# DCC数字员工系统 - Docker镜像预拉取脚本
# 解决Docker镜像拉取超时问题

set -e

echo "🔄 Docker镜像预拉取脚本"
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

# 拉取镜像函数
pull_image() {
    local image=$1
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        log_info "拉取镜像: $image (尝试 $((retry_count + 1))/$max_retries)"
        
        if timeout 300 docker pull "$image"; then
            log_success "✓ $image 拉取成功"
            return 0
        else
            log_warning "✗ $image 拉取失败，重试中..."
            retry_count=$((retry_count + 1))
            sleep 5
        fi
    done
    
    log_error "✗ $image 拉取失败，已达到最大重试次数"
    return 1
}

# 镜像列表（使用阿里云专属加速器）
images=(
    "python:3.10-slim"
    "node:18-alpine"
    "nginx:alpine"
    "mysql:8.0"
)

log_info "开始预拉取Docker镜像..."

# 拉取所有镜像
failed_images=()
for image in "${images[@]}"; do
    if ! pull_image "$image"; then
        failed_images+=("$image")
    fi
done

echo ""
if [ ${#failed_images[@]} -eq 0 ]; then
    log_success "所有镜像拉取成功！"
    echo "================================================"
    echo "✅ 可以继续执行部署脚本"
else
    log_warning "以下镜像拉取失败："
    for image in "${failed_images[@]}"; do
        echo "  - $image"
    done
    echo ""
    log_info "建议检查网络连接或手动拉取失败的镜像"
fi

echo ""
log_info "镜像拉取完成，可以继续执行部署脚本"
