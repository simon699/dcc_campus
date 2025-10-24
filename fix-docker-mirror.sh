#!/bin/bash

# 修复Docker镜像加速器配置问题

echo "=== 修复Docker镜像加速器配置 ==="
echo ""

echo "1. 停止Docker服务："
sudo systemctl stop docker
echo ""

echo "2. 检查现有配置："
if [ -f /etc/docker/daemon.json ]; then
    echo "现有配置："
    cat /etc/docker/daemon.json
    echo ""
else
    echo "没有现有配置文件"
    echo ""
fi

echo "3. 备份现有配置："
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup 2>/dev/null || echo "没有现有配置文件需要备份"
echo ""

echo "4. 创建正确的Docker daemon配置："
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com",
    "https://crpi-6kf9zd5057bjgono-vpc.cn-shanghai.personal.cr.aliyuncs.com"
  ],
  "insecure-registries": [],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
echo ""

echo "5. 显示新配置："
cat /etc/docker/daemon.json
echo ""

echo "6. 启动Docker服务："
sudo systemctl start docker
echo ""

echo "7. 等待Docker服务启动："
sleep 15
echo ""

echo "8. 检查Docker服务状态："
sudo systemctl status docker --no-pager
echo ""

echo "9. 验证Docker配置："
docker info | grep -A 10 "Registry Mirrors" || echo "无法获取镜像源信息"
echo ""

echo "10. 测试镜像拉取："
echo "测试拉取Alpine镜像："
time docker pull alpine:latest || echo "镜像拉取失败，继续..."
echo ""

echo "11. 清理测试镜像："
docker rmi alpine:latest 2>/dev/null || echo "没有测试镜像需要清理"
echo ""

echo "12. 重新构建DCC服务："
echo "停止现有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "清理Docker系统："
docker system prune -f
echo ""

echo "重新构建服务："
docker-compose -f docker-compose-multi-project.yml up -d --build
echo ""

echo "=== Docker镜像加速器配置完成 ==="
echo "如果仍然有问题，请检查："
echo "1. 网络连接：ping crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com"
echo "2. 防火墙设置：sudo ufw status"
echo "3. Docker版本：docker --version"
echo "4. 服务器时间：date"
