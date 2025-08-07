#!/bin/bash

# DCC数字员工系统部署脚本
# 使用方法: ./deploy.sh [environment]
# 环境选项: development, production, testing

set -e

# 默认环境
ENVIRONMENT=${1:-development}

echo "开始部署 DCC数字员工系统..."
echo "环境: $ENVIRONMENT"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "警告: 未找到 .env 文件，将使用默认配置"
    echo "请复制 env.example 为 .env 并配置相应的环境变量"
fi

# 根据环境设置配置
case $ENVIRONMENT in
    "development")
        echo "使用开发环境配置..."
        export ENVIRONMENT=development
        export DEBUG=True
        ;;
    "production")
        echo "使用生产环境配置..."
        export ENVIRONMENT=production
        export DEBUG=False
        ;;
    "testing")
        echo "使用测试环境配置..."
        export ENVIRONMENT=testing
        export DEBUG=True
        ;;
    *)
        echo "错误: 未知环境 '$ENVIRONMENT'"
        echo "支持的环境: development, production, testing"
        exit 1
        ;;
esac

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose 未安装"
    exit 1
fi

# 构建和启动服务
echo "构建和启动服务..."
docker-compose down
docker-compose build
docker-compose up -d

# 等待服务启动
echo "等待服务启动..."
sleep 30

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 健康检查
echo "执行健康检查..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 后端服务健康检查通过"
else
    echo "❌ 后端服务健康检查失败"
    exit 1
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ 前端服务健康检查通过"
else
    echo "❌ 前端服务健康检查失败"
    exit 1
fi

echo "🎉 部署完成!"
echo "前端地址: http://localhost:3000"
echo "后端API: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
