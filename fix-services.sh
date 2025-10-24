#!/bin/bash

echo "=== DCC服务修复脚本 ==="
echo ""

echo "1. 查看当前服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "2. 查看服务日志："
echo "前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 frontend
echo ""
echo "nginx服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 nginx
echo ""

echo "3. 测试服务内部连接："
echo "测试前端服务："
docker exec dcc-frontend wget --no-verbose --tries=1 --spider http://localhost:3000 || echo "前端服务测试失败"
echo ""
echo "测试nginx服务："
docker exec dcc-nginx wget --no-verbose --tries=1 --spider http://localhost:80 || echo "nginx服务测试失败"
echo ""

echo "4. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down
echo ""

echo "5. 清理Docker系统："
docker system prune -f
echo ""

echo "6. 重新启动服务："
docker-compose -f docker-compose-multi-project.yml up -d --build
echo ""

echo "7. 等待服务启动（60秒）："
sleep 60
echo ""

echo "8. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "9. 测试外部访问："
echo "测试API健康检查："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端访问："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "10. 检查端口占用："
netstat -tulpn | grep :8080 || echo "8080端口未监听"
netstat -tulpn | grep :3001 || echo "3001端口未监听"
echo ""

echo "=== 修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
