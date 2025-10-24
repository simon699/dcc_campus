#!/bin/bash

# Docker超时问题修复脚本

set -e

echo "=========================================="
echo "修复Docker超时问题"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker服务状态
print_info "检查Docker服务状态..."
if systemctl is-active --quiet docker; then
    print_info "Docker服务正在运行"
else
    print_warning "Docker服务未运行，正在启动..."
    sudo systemctl start docker
    sleep 5
fi

# 检查Docker守护进程
print_info "检查Docker守护进程..."
if docker info > /dev/null 2>&1; then
    print_info "Docker守护进程正常"
else
    print_error "Docker守护进程异常，正在重启..."
    sudo systemctl restart docker
    sleep 10
fi

# 检查系统资源
print_info "检查系统资源..."
echo "内存使用情况："
free -h
echo "磁盘使用情况："
df -h /
echo "CPU负载："
uptime

# 停止所有Docker进程
print_info "停止所有Docker进程..."
docker stop $(docker ps -aq) 2>/dev/null || true

# 清理Docker系统
print_info "清理Docker系统..."
docker system prune -f
docker volume prune -f
docker network prune -f

# 重启Docker服务
print_info "重启Docker服务..."
sudo systemctl restart docker
sleep 10

# 检查Docker服务状态
print_info "检查Docker服务状态..."
if systemctl is-active --quiet docker; then
    print_info "Docker服务重启成功"
else
    print_error "Docker服务重启失败"
    exit 1
fi

# 测试Docker连接
print_info "测试Docker连接..."
if docker info > /dev/null 2>&1; then
    print_info "Docker连接测试成功"
else
    print_error "Docker连接测试失败"
    exit 1
fi

# 检查Docker配置
print_info "检查Docker配置..."
if [ -f /etc/docker/daemon.json ]; then
    print_info "Docker配置文件存在："
    cat /etc/docker/daemon.json
else
    print_info "创建Docker配置文件..."
    sudo mkdir -p /etc/docker
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://g0qd096q.mirror.aliyuncs.com"
  ],
  "max-concurrent-downloads": 2,
  "max-concurrent-uploads": 2,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF
    print_info "Docker配置完成，重启服务..."
    sudo systemctl restart docker
    sleep 10
fi

# 最终测试
print_info "最终测试..."
if docker run --rm hello-world > /dev/null 2>&1; then
    print_info "Docker测试成功"
else
    print_error "Docker测试失败"
    exit 1
fi

print_info "Docker超时问题修复完成！"

echo "=========================================="
echo "修复完成"
echo "=========================================="
