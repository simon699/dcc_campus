#!/bin/bash

# 检查配置脚本

echo "=== 检查DCC配置 ==="
echo ""

echo "1. 检查nginx配置："
echo "CORS配置："
grep -A 5 "Access-Control-Allow-Origin" nginx-multi-project.conf
echo ""

echo "2. 检查docker-compose配置："
echo "nginx端口配置："
grep -A 3 "ports:" docker-compose-multi-project.yml
echo ""

echo "3. 检查前端环境配置："
echo "API_BASE_URL配置："
grep -A 10 "API_BASE_URL" dcc-digital-employee/src/config/environment.ts
echo ""

echo "4. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "5. 检查端口监听："
netstat -tulpn | grep :80 || echo "80端口未监听"
netstat -tulpn | grep :443 || echo "443端口未监听"
echo ""

echo "6. 测试域名解析："
nslookup campus.kongbaijiyi.com || echo "域名解析失败"
echo ""

echo "7. 测试服务访问："
echo "测试API："
curl -s -o /dev/null -w "%{http_code}" http://campus.kongbaijiyi.com/api/health || echo "API测试失败"
echo ""
echo "测试前端："
curl -s -o /dev/null -w "%{http_code}" http://campus.kongbaijiyi.com/ || echo "前端测试失败"
echo ""

echo "8. 测试CORS："
echo "测试跨域请求："
curl -H "Origin: http://campus.kongbaijiyi.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     -s -o /dev/null -w "%{http_code}" \
     http://campus.kongbaijiyi.com/api/login || echo "CORS测试失败"
echo ""

echo "=== 配置检查完成 ==="
echo "如果所有测试都通过，前端应该能够正常调用API而不出现跨域问题"
