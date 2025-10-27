#!/bin/bash

# DCC数字员工系统 - Docker专属加速器配置脚本
# 配置阿里云专属镜像加速器

set -e

echo "🚀 配置阿里云专属Docker镜像加速器"
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

# 专属加速器地址
MIRROR_URL="https://g0qd096q.mirror.aliyuncs.com"

log_info "配置阿里云专属Docker镜像加速器: $MIRROR_URL"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    log_error "Docker未安装，请先安装Docker"
    exit 1
fi

# 创建Docker配置目录
sudo mkdir -p /etc/docker

# 备份现有配置
if [ -f /etc/docker/daemon.json ]; then
    log_info "备份现有Docker配置..."
    sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup.$(date +%Y%m%d_%H%M%S)
fi

# 配置Docker镜像源
log_info "配置Docker镜像源..."
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
    "registry-mirrors": [
        "$MIRROR_URL",
        "https://registry.cn-hangzhou.aliyuncs.com",
        "https://mirror.ccs.tencentyun.com",
        "https://docker.mirrors.ustc.edu.cn",
        "https://reg-mirror.qiniu.com"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    },
    "max-concurrent-downloads": 10,
    "max-concurrent-uploads": 5,
    "insecure-registries": [],
    "live-restore": true
}
EOF

# 重启Docker服务
log_info "重启Docker服务..."
sudo systemctl daemon-reload
sudo systemctl restart docker

# 等待Docker服务启动
sleep 5

# 验证配置
log_info "验证Docker配置..."
if docker info | grep -q "$MIRROR_URL"; then
    log_success "✓ Docker镜像加速器配置成功"
else
    log_warning "⚠ Docker镜像加速器可能未生效，请检查配置"
fi

# 测试镜像拉取
log_info "测试镜像拉取..."
if timeout 60 docker pull hello-world >/dev/null 2>&1; then
    log_success "✓ 镜像拉取测试成功"
    docker rmi hello-world >/dev/null 2>&1 || true
else
    log_warning "⚠ 镜像拉取测试失败，请检查网络连接"
fi

echo ""
log_success "Docker专属加速器配置完成！"
echo "================================================"
echo "🎉 现在可以使用专属加速器快速拉取Docker镜像"
echo ""
echo "测试命令："
echo "  docker pull python:3.10-slim"
echo "  docker pull node:18-alpine"
echo "  docker pull nginx:alpine"
echo ""
