#!/bin/bash

# 修复unhealthy服务脚本

echo "=== 修复DCC服务健康检查问题 ==="
echo ""

echo "1. 查看当前服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "2. 查看前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=20 frontend
echo ""

echo "3. 查看nginx服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=20 nginx
echo ""

echo "4. 测试前端服务内部连接："
docker exec dcc-frontend curl -f http://localhost:3000 || echo "前端服务内部连接失败"
echo ""

echo "5. 测试nginx服务内部连接："
docker exec dcc-nginx curl -f http://localhost:80 || echo "nginx服务内部连接失败"
echo ""

echo "6. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down
echo ""

echo "7. 清理Docker系统："
docker system prune -f
echo ""

echo "8. 重新启动服务："
docker-compose -f docker-compose-multi-project.yml up -d --build
echo ""

echo "9. 等待服务启动（60秒）："
sleep 60
echo ""

echo "10. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "11. 测试外部访问："
echo "测试API："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""

echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 修复完成 ==="
echo "如果服务仍然unhealthy，请检查："
echo "1. 服务器资源是否充足"
echo "2. 端口是否被占用"
echo "3. 网络连接是否正常"
