#!/bin/bash

# DCC数字员工系统 - 环境变量配置脚本
# 使用方法: ./configure_env.sh

set -e

echo "🔧 DCC数字员工系统环境变量配置工具"
echo "=================================="

# 检查是否在项目根目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 创建 .env 文件（如果不存在）
if [ ! -f ".env" ]; then
    echo "📝 创建 .env 文件..."
    cp backend/env.example .env
    echo "✅ .env 文件已创建"
fi

# 函数：显示当前配置
show_current_config() {
    echo ""
    echo "📋 当前配置:"
    echo "============"
    if [ -f ".env" ]; then
        echo "环境变量文件 (.env):"
        grep -E "^(ENVIRONMENT|DEBUG|DB_|JWT_|ALIBABA_|DASHSCOPE_|ALIBAILIAN_|SCENE_ID_|API_|EXTERNAL_|NEXT_PUBLIC_)" .env 2>/dev/null || echo "  未找到相关配置"
    else
        echo "❌ .env 文件不存在"
    fi
}

# 函数：快速配置（一键配置所有必需项）
quick_configure() {
    echo ""
    echo "⚡ 快速配置模式"
    echo "=============="
    
    # 数据库配置
    read -s -p "数据库密码: " db_password
    echo ""
    
    # JWT配置
    read -s -p "JWT密钥: " jwt_secret
    echo ""
    
    # 阿里云配置
    read -p "阿里云AccessKey ID: " access_key_id
    read -s -p "阿里云AccessKey Secret: " access_key_secret
    echo ""
    read -p "实例ID: " instance_id
    
    # 阿里百炼配置
    read -s -p "DashScope API密钥: " dashscope_key
    echo ""
    read -p "阿里百炼应用ID: " app_id
    
    # 更新 .env 文件
    sed -i.bak "s/^DB_PASSWORD=.*/DB_PASSWORD=$db_password/" .env
    sed -i.bak "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$jwt_secret/" .env
    sed -i.bak "s/^ALIBABA_CLOUD_ACCESS_KEY_ID=.*/ALIBABA_CLOUD_ACCESS_KEY_ID=$access_key_id/" .env
    sed -i.bak "s/^ALIBABA_CLOUD_ACCESS_KEY_SECRET=.*/ALIBABA_CLOUD_ACCESS_KEY_SECRET=$access_key_secret/" .env
    sed -i.bak "s/^INSTANCE_ID=.*/INSTANCE_ID=$instance_id/" .env
    sed -i.bak "s/^DASHSCOPE_API_KEY=.*/DASHSCOPE_API_KEY=$dashscope_key/" .env
    sed -i.bak "s/^ALIBAILIAN_APP_ID=.*/ALIBAILIAN_APP_ID=$app_id/" .env
    
    echo "✅ 快速配置完成"
}

# 函数：配置Docker加速器
configure_docker_accelerator() {
    echo ""
    echo "🚀 配置Docker加速器"
    echo "=================="
    
    read -p "是否配置Docker加速器? [y/N]: " choice
    
    if [[ $choice =~ ^[Yy]$ ]]; then
        echo "正在配置Docker加速器..."
        
        # 创建Docker配置目录
        sudo mkdir -p /etc/docker
        
        # 配置阿里云镜像加速器
        sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://g0qd096q.mirror.aliyuncs.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF
        
        # 重新加载Docker daemon配置
        sudo systemctl daemon-reload
        sudo systemctl restart docker
        
        echo "✅ Docker加速器配置完成"
    else
        echo "⚠️  跳过Docker加速器配置"
    fi
}

# 函数：启动服务
start_services() {
    echo ""
    echo "🚀 启动服务"
    echo "=========="
    
    read -p "是否启动服务? [y/N]: " choice
    
    if [[ $choice =~ ^[Yy]$ ]]; then
        echo "正在启动服务..."
        docker-compose down
        docker-compose up -d
        
        echo "等待服务启动..."
        sleep 15
        
        # 健康检查
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ 后端服务启动成功"
        else
            echo "❌ 后端服务启动失败"
        fi
        
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo "✅ 前端服务启动成功"
        else
            echo "❌ 前端服务启动失败"
        fi
        
        echo ""
        echo "📱 前端访问地址: http://localhost:3000"
        echo "🔧 后端API地址: http://localhost:8000"
    else
        echo "⚠️  请手动启动服务: docker-compose up -d"
    fi
}

# 主菜单
while true; do
    echo ""
    echo "请选择操作:"
    echo "1) 显示当前配置"
    echo "2) 快速配置（推荐）"
    echo "3) 配置Docker加速器"
    echo "4) 启动服务"
    echo "0) 退出"
    
    read -p "请选择 [0-4]: " choice
    
    case $choice in
        1)
            show_current_config
            ;;
        2)
            quick_configure
            ;;
        3)
            configure_docker_accelerator
            ;;
        4)
            start_services
            ;;
        0)
            echo "👋 再见!"
            exit 0
            ;;
        *)
            echo "❌ 无效选择，请重试"
            ;;
    esac
done
