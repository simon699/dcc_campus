#!/bin/bash

# 修复Docker构建慢的问题

echo "=== 修复Docker构建慢的问题 ==="
echo ""

echo "1. 配置阿里云个人镜像加速器："
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com",
    "https://crpi-6kf9zd5057bjgono-vpc.cn-shanghai.personal.cr.aliyuncs.com"
  ],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
EOF
echo ""

echo "2. 重启Docker服务："
sudo systemctl restart docker
sleep 10
echo ""

echo "3. 停止当前构建（如果正在运行）："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "4. 清理Docker缓存："
docker system prune -f
echo ""

echo "5. 测试镜像拉取速度："
echo "测试拉取Node.js镜像："
time docker pull node:18-alpine || echo "镜像拉取失败"
echo ""

echo "6. 重新构建服务（使用优化配置）："
echo "设置构建环境变量："
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
echo ""

echo "7. 分步构建服务："
echo "7.1 构建MySQL服务："
timeout 300 docker-compose -f docker-compose-multi-project.yml build mysql
echo ""

echo "7.2 启动MySQL服务："
docker-compose -f docker-compose-multi-project.yml up -d mysql
sleep 30
echo ""

echo "7.3 构建后端服务："
timeout 600 docker-compose -f docker-compose-multi-project.yml build backend
echo ""

echo "7.4 启动后端服务："
docker-compose -f docker-compose-multi-project.yml up -d backend
sleep 30
echo ""

echo "7.5 构建前端服务："
timeout 900 docker-compose -f docker-compose-multi-project.yml build frontend
echo ""

echo "7.6 启动前端服务："
docker-compose -f docker-compose-multi-project.yml up -d frontend
sleep 30
echo ""

echo "7.7 启动nginx服务："
docker-compose -f docker-compose-multi-project.yml up -d nginx
echo ""

echo "8. 等待所有服务启动："
sleep 60
echo ""

echo "9. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "10. 测试服务访问："
echo "测试API："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 构建修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
