#!/bin/bash

# 快速修复后端构建问题

echo "=== 快速修复后端构建问题 ==="
echo ""

echo "1. 停止现有服务："
docker-compose -f docker-compose-multi-project.yml down
echo ""

echo "2. 清理Docker系统："
docker system prune -f
echo ""

echo "3. 测试Python镜像拉取："
echo "测试拉取Python 3.10镜像："
time docker pull python:3.10-slim || echo "Python镜像拉取失败"
echo ""

echo "4. 重新构建后端服务："
docker-compose -f docker-compose-multi-project.yml build backend
echo ""

echo "5. 启动所有服务："
docker-compose -f docker-compose-multi-project.yml up -d
echo ""

echo "6. 等待服务启动："
sleep 60
echo ""

echo "7. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "8. 查看后端服务日志："
docker-compose -f docker-compose-multi-project.yml logs backend
echo ""

echo "9. 测试服务访问："
echo "测试后端API："
curl -v http://localhost:8001/api/health || echo "后端API测试失败"
echo ""
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 后端构建修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
