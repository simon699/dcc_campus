#!/bin/bash

# 使用ACR镜像的服务器部署脚本
# 服务器IP: 47.103.27.235
# 域名: campus.kongbaijiyi.com

set -e

echo "开始部署DCC数字员工系统到服务器（使用ACR镜像）..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 服务器信息
SERVER_IP="47.103.27.235"
DOMAIN="campus.kongbaijiyi.com"
PROJECT_NAME="dcc-digital-employee"

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}使用方法: $0 [deploy|update|restart|logs|status]${NC}"
    echo "  deploy  - 首次部署"
    echo "  update  - 更新部署"
    echo "  restart - 重启服务"
    echo "  logs    - 查看日志"
    echo "  status  - 查看状态"
    exit 1
fi

ACTION=$1

# 部署函数
deploy() {
    echo -e "${GREEN}开始首次部署...${NC}"
    
    # 连接到服务器并执行部署
    ssh root@${SERVER_IP} << 'EOF'
        set -e
        
        echo "更新系统包..."
        apt update && apt upgrade -y
        
        echo "安装Docker和Docker Compose..."
        apt install -y docker.io docker-compose curl wget
        
        # 启动Docker服务
        systemctl start docker
        systemctl enable docker
        
        # 创建项目目录
        mkdir -p /opt/dcc-digital-employee
        cd /opt/dcc-digital-employee
        
        echo "Docker和Docker Compose安装完成"
EOF
    
    # 上传项目文件
    echo -e "${GREEN}上传项目文件到服务器...${NC}"
    rsync -avz --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
        ./ root@${SERVER_IP}:/opt/dcc-digital-employee/
    
    # 在服务器上启动服务
    ssh root@${SERVER_IP} << 'EOF'
        cd /opt/dcc-digital-employee
        
        echo "配置环境变量..."
        if [ ! -f .env ]; then
            cp env.example .env
            echo "请编辑 .env 文件配置环境变量"
        fi
        
        echo "登录ACR个人版..."
        echo ",Sfw3470699" | docker login crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com -u sfwtaobao@126.com --password-stdin
        
        echo "拉取最新镜像..."
        docker-compose -f docker-compose.acr-personal.yml pull
        
        echo "启动Docker服务..."
        docker-compose -f docker-compose.acr-personal.yml up -d
        
        echo "等待服务启动..."
        sleep 30
        
        echo "检查服务状态..."
        docker-compose -f docker-compose.acr-personal.yml ps
        
        echo "配置防火墙..."
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 22/tcp
        ufw --force enable
        
        echo "部署完成！"
        echo "域名: https://campus.kongbaijiyi.com"
        echo "IP: http://47.103.27.235"
EOF
}

# 更新函数
update() {
    echo -e "${GREEN}开始更新部署...${NC}"
    
    # 上传项目文件
    echo -e "${GREEN}上传项目文件到服务器...${NC}"
    rsync -avz --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
        ./ root@${SERVER_IP}:/opt/dcc-digital-employee/
    
    # 在服务器上更新服务
    ssh root@${SERVER_IP} << 'EOF'
        cd /opt/dcc-digital-employee
        
        echo "登录ACR个人版..."
        echo ",Sfw3470699" | docker login crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com -u sfwtaobao@126.com --password-stdin
        
        echo "停止现有服务..."
        docker-compose -f docker-compose.acr-personal.yml down
        
        echo "拉取最新镜像..."
        docker-compose -f docker-compose.acr-personal.yml pull
        
        echo "重新启动服务..."
        docker-compose -f docker-compose.acr-personal.yml up -d
        
        echo "等待服务启动..."
        sleep 30
        
        echo "检查服务状态..."
        docker-compose -f docker-compose.acr-personal.yml ps
        
        echo "更新完成！"
EOF
}

# 重启函数
restart() {
    echo -e "${GREEN}重启服务...${NC}"
    ssh root@${SERVER_IP} << 'EOF'
        cd /opt/dcc-digital-employee
        docker-compose -f docker-compose.acr-personal.yml restart
        echo "服务重启完成"
EOF
}

# 查看日志函数
logs() {
    echo -e "${GREEN}查看服务日志...${NC}"
    ssh root@${SERVER_IP} << 'EOF'
        cd /opt/dcc-digital-employee
        docker-compose -f docker-compose.acr-personal.yml logs -f
EOF
}

# 查看状态函数
status() {
    echo -e "${GREEN}查看服务状态...${NC}"
    ssh root@${SERVER_IP} << 'EOF'
        cd /opt/dcc-digital-employee
        echo "=== Docker服务状态 ==="
        docker-compose -f docker-compose.acr-personal.yml ps
        
        echo -e "\n=== 系统资源使用 ==="
        docker stats --no-stream
        
        echo -e "\n=== 磁盘使用情况 ==="
        df -h
        
        echo -e "\n=== 内存使用情况 ==="
        free -h
EOF
}

# 主函数
case $ACTION in
    "deploy")
        deploy
        ;;
    "update")
        update
        ;;
    "restart")
        restart
        ;;
    "logs")
        logs
        ;;
    "status")
        status
        ;;
    *)
        echo -e "${RED}未知操作: $ACTION${NC}"
        echo "可用操作: deploy, update, restart, logs, status"
        exit 1
        ;;
esac

echo -e "${GREEN}操作完成！${NC}"
