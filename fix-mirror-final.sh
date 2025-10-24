#!/bin/bash

# 使用正确的阿里云镜像加速器地址修复Docker配置

echo "=== 修复Docker镜像加速器配置（最终版本）==="
echo ""

echo "1. 停止Docker服务："
sudo systemctl stop docker
echo ""

echo "2. 备份现有配置："
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup 2>/dev/null || echo "没有现有配置文件"
echo ""

echo "3. 创建正确的Docker daemon配置："
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://g0qd096q.mirror.aliyuncs.com"
  ],
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

echo "4. 显示新配置："
cat /etc/docker/daemon.json
echo ""

echo "5. 启动Docker服务："
sudo systemctl start docker
echo ""

echo "6. 等待Docker服务启动："
sleep 15
echo ""

echo "7. 检查Docker服务状态："
sudo systemctl status docker --no-pager
echo ""

echo "8. 验证Docker配置："
docker info | grep -A 5 "Registry Mirrors" || echo "无法获取镜像源信息"
echo ""

echo "9. 测试镜像拉取："
echo "测试拉取Alpine镜像："
time docker pull alpine:latest || echo "镜像拉取失败"
echo ""

echo "10. 清理测试镜像："
docker rmi alpine:latest 2>/dev/null || echo "没有测试镜像需要清理"
echo ""

echo "11. 停止现有DCC服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "12. 清理Docker系统："
docker system prune -f
echo ""

echo "13. 重新构建DCC服务："
echo "设置构建环境变量："
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
echo ""

echo "14. 分步构建服务："
echo "14.1 构建MySQL服务："
timeout 300 docker-compose -f docker-compose-multi-project.yml build mysql || echo "MySQL构建超时"
echo ""

echo "14.2 启动MySQL服务："
docker-compose -f docker-compose-multi-project.yml up -d mysql
sleep 30
echo ""

echo "14.3 构建后端服务："
timeout 600 docker-compose -f docker-compose-multi-project.yml build backend || echo "后端构建超时"
echo ""

echo "14.4 启动后端服务："
docker-compose -f docker-compose-multi-project.yml up -d backend
sleep 30
echo ""

echo "14.5 构建前端服务："
timeout 900 docker-compose -f docker-compose-multi-project.yml build frontend || echo "前端构建超时"
echo ""

echo "14.6 启动前端服务："
docker-compose -f docker-compose-multi-project.yml up -d frontend
sleep 30
echo ""

echo "14.7 启动nginx服务："
docker-compose -f docker-compose-multi-project.yml up -d nginx
echo ""

echo "15. 等待所有服务启动："
sleep 60
echo ""

echo "16. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "17. 测试服务访问："
echo "测试API健康检查："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端访问："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "18. 检查端口占用："
netstat -tulpn | grep :8080 || echo "8080端口未监听"
netstat -tulpn | grep :3001 || echo "3001端口未监听"
netstat -tulpn | grep :8001 || echo "8001端口未监听"
netstat -tulpn | grep :3307 || echo "3307端口未监听"
echo ""

echo "=== 修复完成 ==="
echo "使用的镜像加速器：https://g0qd096q.mirror.aliyuncs.com"
echo ""
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
echo ""

echo "如果仍然有问题，请检查："
echo "1. 网络连接：ping g0qd096q.mirror.aliyuncs.com"
echo "2. 防火墙设置：sudo ufw status"
echo "3. Docker版本：docker --version"
echo "4. 服务器时间：date"
