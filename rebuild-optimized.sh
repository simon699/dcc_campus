#!/bin/bash

# DCC数字员工系统 - 优化重新构建脚本
# 解决Docker构建慢的问题

echo "=== DCC服务优化重新构建脚本 ==="
echo ""

echo "1. 查看当前服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "2. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down
echo ""

echo "3. 删除所有相关容器："
docker rm -f dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || echo "容器已删除或不存在"
echo ""

echo "4. 删除所有相关镜像："
docker rmi dcc-digital-employee_backend dcc-digital-employee_frontend 2>/dev/null || echo "镜像已删除或不存在"
echo ""

echo "5. 清理Docker系统："
docker system prune -a -f --volumes
echo ""

echo "6. 检查服务器资源："
echo "内存使用情况："
free -h
echo ""
echo "磁盘使用情况："
df -h
echo ""
echo "CPU使用情况："
top -bn1 | grep "Cpu(s)" || echo "无法获取CPU信息"
echo ""

echo "7. 配置Docker镜像源（如果在中国）："
echo "创建Docker daemon配置文件..."
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5
}
EOF
echo "重启Docker服务..."
sudo systemctl restart docker
echo "等待Docker服务启动..."
sleep 10
echo ""

echo "8. 设置构建超时和重试："
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
echo ""

echo "9. 分步构建服务（避免超时）："
echo "9.1 构建MySQL服务："
timeout 300 docker-compose -f docker-compose-multi-project.yml build mysql || echo "MySQL构建超时，继续..."
echo ""

echo "9.2 启动MySQL服务："
docker-compose -f docker-compose-multi-project.yml up -d mysql
echo "等待MySQL启动..."
sleep 30
echo ""

echo "9.3 构建后端服务："
timeout 600 docker-compose -f docker-compose-multi-project.yml build backend || echo "后端构建超时，继续..."
echo ""

echo "9.4 启动后端服务："
docker-compose -f docker-compose-multi-project.yml up -d backend
echo "等待后端启动..."
sleep 30
echo ""

echo "9.5 构建前端服务："
timeout 900 docker-compose -f docker-compose-multi-project.yml build frontend || echo "前端构建超时，继续..."
echo ""

echo "9.6 启动前端服务："
docker-compose -f docker-compose-multi-project.yml up -d frontend
echo "等待前端启动..."
sleep 30
echo ""

echo "9.7 启动nginx服务："
docker-compose -f docker-compose-multi-project.yml up -d nginx
echo ""

echo "10. 等待所有服务启动（60秒）："
sleep 60
echo ""

echo "11. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "12. 查看服务日志："
echo "后端服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 backend
echo ""
echo "前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 frontend
echo ""
echo "nginx服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 nginx
echo ""

echo "13. 测试服务连接："
echo "测试API健康检查："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端访问："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "14. 检查端口占用："
netstat -tulpn | grep :8080 || echo "8080端口未监听"
netstat -tulpn | grep :3001 || echo "3001端口未监听"
netstat -tulpn | grep :8001 || echo "8001端口未监听"
netstat -tulpn | grep :3307 || echo "3307端口未监听"
echo ""

echo "=== 优化重新构建完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
echo ""

echo "如果构建仍然很慢，请检查："
echo "1. 服务器网络连接：ping mirrors.aliyun.com"
echo "2. 服务器资源：free -h && df -h"
echo "3. Docker版本：docker --version"
echo "4. 考虑使用更快的服务器或CDN"
