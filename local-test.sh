#!/bin/bash

echo "=== DCC数字员工系统本地部署测试 ==="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker环境检查通过"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在，请先运行 ./configure_env.sh 进行配置"
    exit 1
fi

echo "✅ 环境变量文件检查通过"

# 停止并删除现有容器
echo "🔄 清理现有容器..."
docker-compose down -v

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ 镜像构建失败"
    exit 1
fi

echo "✅ 镜像构建完成"

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
fi

echo "✅ 服务启动完成"

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查健康状态
echo "🏥 检查健康状态..."
if docker-compose exec backend curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
fi

if docker-compose exec mysql mysqladmin ping -h localhost > /dev/null 2>&1; then
    echo "✅ 数据库健康检查通过"
else
    echo "❌ 数据库健康检查失败"
fi

echo ""
echo "=== 部署测试完成 ==="
echo "📱 前端访问地址: http://localhost:3000"
echo "🔧 后端API地址: http://localhost:8000"
echo "🗄️  数据库端口: localhost:3306"
echo ""
echo "📋 查看日志命令:"
echo "  docker-compose logs -f"
echo ""
echo "🛑 停止服务命令:"
echo "  docker-compose down"
