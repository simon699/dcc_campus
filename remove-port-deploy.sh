#!/bin/bash

# 去掉端口号部署脚本

echo "=== 去掉端口号部署脚本 ==="
echo ""

echo "1. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 检查80端口是否被占用："
netstat -tulpn | grep :80 || echo "80端口未被占用"
echo ""

echo "3. 如果80端口被占用，停止相关服务："
echo "检查是否有其他nginx或apache服务："
sudo systemctl status nginx 2>/dev/null || echo "没有nginx服务"
sudo systemctl status apache2 2>/dev/null || echo "没有apache2服务"
echo ""

echo "4. 停止可能冲突的服务："
sudo systemctl stop nginx 2>/dev/null || echo "没有nginx服务需要停止"
sudo systemctl stop apache2 2>/dev/null || echo "没有apache2服务需要停止"
echo ""

echo "5. 重新启动DCC服务："
docker-compose -f docker-compose-multi-project.yml up -d
echo ""

echo "6. 等待服务启动："
sleep 60
echo ""

echo "7. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "8. 检查端口监听："
netstat -tulpn | grep :80 || echo "80端口未监听"
netstat -tulpn | grep :443 || echo "443端口未监听"
echo ""

echo "9. 测试服务访问："
echo "测试API（不带端口）："
curl -v http://campus.kongbaijiyi.com/api/health || echo "API测试失败"
echo ""
echo "测试前端（不带端口）："
curl -v http://campus.kongbaijiyi.com/ || echo "前端测试失败"
echo ""

echo "10. 测试CORS："
echo "测试跨域请求："
curl -H "Origin: http://campus.kongbaijiyi.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://campus.kongbaijiyi.com/api/login || echo "CORS测试失败"
echo ""

echo "=== 去掉端口号部署完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com"
echo "  API文档：http://campus.kongbaijiyi.com/docs"
echo "  API接口：http://campus.kongbaijiyi.com/api"
echo ""

echo "前端调用API的URL："
echo "  http://campus.kongbaijiyi.com/api/login"
echo "  http://campus.kongbaijiyi.com/api/health"
echo "  http://campus.kongbaijiyi.com/api/users"
echo ""

echo "如果仍然有问题，请检查："
echo "1. 域名解析：nslookup campus.kongbaijiyi.com"
echo "2. 防火墙设置：sudo ufw status"
echo "3. 端口占用：netstat -tulpn | grep :80"
echo "4. 服务日志：docker-compose -f docker-compose-multi-project.yml logs nginx"
