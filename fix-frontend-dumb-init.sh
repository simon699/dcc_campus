#!/bin/bash

# 修复前端dumb-init问题

echo "=== 修复前端dumb-init问题 ==="
echo ""

echo "1. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 删除前端容器："
docker rm -f dcc-frontend 2>/dev/null || echo "前端容器已删除"
echo ""

echo "3. 删除前端镜像："
docker rmi dcc-digital-employee_frontend 2>/dev/null || echo "前端镜像已删除"
echo ""

echo "4. 清理Docker系统："
docker system prune -f
echo ""

echo "5. 重新构建前端服务："
docker-compose -f docker-compose-multi-project.yml build frontend
echo ""

echo "6. 启动所有服务："
docker-compose -f docker-compose-multi-project.yml up -d
echo ""

echo "7. 等待服务启动："
sleep 60
echo ""

echo "8. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "9. 查看前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs frontend
echo ""

echo "10. 测试服务访问："
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 前端dumb-init问题修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
