#!/bin/bash

# DCC数字员工系统 - 完全重新构建镜像脚本
# 删除所有相关镜像和容器，重新构建

echo "=== DCC服务完全重新构建脚本 ==="
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

echo "5. 删除所有相关网络："
docker network rm dcc-network 2>/dev/null || echo "网络已删除或不存在"
echo ""

echo "6. 删除所有相关卷："
docker volume rm dcc-mysql-data dcc-nginx-logs 2>/dev/null || echo "卷已删除或不存在"
echo ""

echo "7. 清理Docker系统（删除所有未使用的镜像、容器、网络、卷）："
docker system prune -a -f --volumes
echo ""

echo "8. 查看清理后的状态："
echo "Docker镜像："
docker images
echo ""
echo "Docker容器："
docker ps -a
echo ""
echo "Docker网络："
docker network ls
echo ""
echo "Docker卷："
docker volume ls
echo ""

echo "9. 重新构建并启动服务："
docker-compose -f docker-compose-multi-project.yml up -d --build --force-recreate
echo ""

echo "10. 等待服务启动（90秒）："
sleep 90
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

echo "15. 检查容器内部服务："
echo "检查前端容器内部："
docker exec dcc-frontend wget --no-verbose --tries=1 --spider http://localhost:3000 || echo "前端容器内部测试失败"
echo ""
echo "检查nginx容器内部："
docker exec dcc-nginx wget --no-verbose --tries=1 --spider http://localhost:80 || echo "nginx容器内部测试失败"
echo ""

echo "=== 重新构建完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
echo ""

echo "管理命令："
echo "  查看服务状态: docker-compose -f docker-compose-multi-project.yml ps"
echo "  查看服务日志: docker-compose -f docker-compose-multi-project.yml logs -f"
echo "  重启服务: docker-compose -f docker-compose-multi-project.yml restart"
echo "  停止服务: docker-compose -f docker-compose-multi-project.yml down"
echo ""

echo "如果服务仍然有问题，请检查："
echo "1. 服务器资源是否充足 (free -h && df -h)"
echo "2. 防火墙设置 (ufw status)"
echo "3. 域名解析 (nslookup campus.kongbaijiyi.com)"
echo "4. 网络连接 (ping campus.kongbaijiyi.com)"
