#!/bin/bash

# 简单部署方案 - 使用预构建镜像避免构建问题

echo "=== 简单部署方案 ==="
echo ""

echo "1. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 清理Docker系统："
docker system prune -f
echo ""

echo "3. 创建最简单的docker-compose配置："
cat > docker-compose-simple.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    container_name: dcc-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: dcc_employee_db
      MYSQL_USER: dcc_user
      MYSQL_PASSWORD: dcc123456
      TZ: Asia/Shanghai
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - dcc-network

  backend:
    image: python:3.10-slim
    container_name: dcc-backend
    restart: always
    working_dir: /app
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: dcc_user
      DB_PASSWORD: dcc123456
      DB_NAME: dcc_employee_db
      JWT_SECRET_KEY: dcc-jwt-secret-key-2024
      JWT_EXPIRE_HOURS: 24
      ENVIRONMENT: production
      DEBUG: "False"
    ports:
      - "8001:8000"
    volumes:
      - ./backend:/app
    depends_on:
      - mysql
    networks:
      - dcc-network
    command: >
      sh -c "
        apt-get update &&
        apt-get install -y gcc default-libmysqlclient-dev pkg-config curl &&
        pip install -r requirements.txt &&
        uvicorn main:app --host 0.0.0.0 --port 8000
      "

  frontend:
    image: node:18-alpine
    container_name: dcc-frontend
    restart: always
    working_dir: /app
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_BASE_URL: http://localhost/api
    ports:
      - "3001:3000"
    volumes:
      - ./dcc-digital-employee:/app
    depends_on:
      - backend
    networks:
      - dcc-network
    command: >
      sh -c "
        npm install &&
        npm run build &&
        npm start
      "

  nginx:
    image: nginx:alpine
    container_name: dcc-nginx
    restart: always
    ports:
      - "8080:80"
    volumes:
      - ./nginx-multi-project.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - dcc-network

networks:
  dcc-network:
    driver: bridge

volumes:
  mysql_data:
    driver: local
EOF
echo ""

echo "4. 启动服务："
docker-compose -f docker-compose-simple.yml up -d
echo ""

echo "5. 等待服务启动："
sleep 120
echo ""

echo "6. 检查服务状态："
docker-compose -f docker-compose-simple.yml ps
echo ""

echo "7. 查看服务日志："
echo "后端服务日志："
docker-compose -f docker-compose-simple.yml logs --tail=10 backend
echo ""
echo "前端服务日志："
docker-compose -f docker-compose-simple.yml logs --tail=10 frontend
echo ""

echo "8. 测试服务访问："
echo "测试API："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 简单部署完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
