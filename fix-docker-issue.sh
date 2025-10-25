#!/bin/bash

# DCC数字员工系统 - Docker问题修复脚本
# 解决Docker服务超时和权限问题

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_IP="47.103.27.235"
SERVER_USER="root"
DEPLOY_DIR="/opt/dcc-digital-employee"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
 }

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 修复Docker问题
fix_docker_issues() {
    print_info "修复服务器Docker问题..."
    print_warning "修复过程中可能需要输入服务器密码"
    
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
        set -e
        
        echo "=========================================="
        echo "DCC数字员工系统 - Docker问题修复"
        echo "服务器: 47.103.27.235"
        echo "=========================================="
        
        # 停止所有Docker容器
        echo "停止所有Docker容器..."
        docker stop $(docker ps -aq) 2>/dev/null || true
        
        # 重启Docker服务
        echo "重启Docker服务..."
        systemctl stop docker
        sleep 5
        systemctl start docker
        systemctl enable docker
        
        # 等待Docker服务启动
        echo "等待Docker服务启动..."
        sleep 10
        
        # 检查Docker服务状态
        echo "检查Docker服务状态..."
        systemctl status docker --no-pager
        
        # 检查Docker版本
        echo "检查Docker版本..."
        docker --version
        docker-compose --version
        
        # 清理Docker资源
        echo "清理Docker资源..."
        docker system prune -f
        
        # 检查Docker网络
        echo "检查Docker网络..."
        docker network ls
        
        # 检查Docker卷
        echo "检查Docker卷..."
        docker volume ls
        
        echo ""
        echo "Docker修复完成！"
        echo "现在可以重新运行部署脚本"
EOF
    
    print_success "Docker问题修复完成"
}

# 重新部署
redeploy_services() {
    print_info "重新部署DCC服务..."
    print_warning "部署过程中可能需要输入服务器密码"
    
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
        set -e
        
        echo "=========================================="
        echo "DCC数字员工系统 - 重新部署"
        echo "服务器: 47.103.27.235"
        echo "=========================================="
        
        cd /opt/dcc-digital-employee
        
        # 停止现有服务
        echo "停止现有服务..."
        docker-compose -f docker-compose-fast.yml down --remove-orphans 2>/dev/null || true
        
        # 清理相关容器和网络
        echo "清理相关容器和网络..."
        docker rm -f dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true
        docker network rm dcc-network 2>/dev/null || true
        
        # 重新启动服务
        echo "重新启动服务..."
        docker-compose -f docker-compose-fast.yml up --build -d
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 30
        
        # 检查服务状态
        echo "检查服务状态..."
        docker-compose -f docker-compose-fast.yml ps
        
        echo ""
        echo "重新部署完成！"
        echo "访问地址: http://campus.kongbaijiyi.com"
        echo "API文档: http://campus.kongbaijiyi.com/docs"
EOF
    
    print_success "重新部署完成"
}

# 验证部署
verify_deployment() {
    print_info "验证部署结果..."
    
    # 等待服务启动
    sleep 10
    
    # 检查服务是否可访问
    if curl -f http://campus.kongbaijiyi.com/api/health >/dev/null 2>&1; then
        print_success "后端API服务正常"
    else
        print_warning "后端API服务可能未就绪，请稍后检查"
    fi
    
    if curl -f http://campus.kongbaijiyi.com >/dev/null 2>&1; then
        print_success "前端服务正常"
    else
        print_warning "前端服务可能未就绪，请稍后检查"
    fi
    
    print_info "部署验证完成"
    echo ""
    echo "访问地址："
    echo "前端应用: http://campus.kongbaijiyi.com"
    echo "后端API: http://campus.kongbaijiyi.com/api"
    echo "API文档: http://campus.kongbaijiyi.com/docs"
}

# 主函数
main() {
    echo "=========================================="
    echo "DCC数字员工系统 - Docker问题修复"
    echo "目标服务器: ${SERVER_IP}"
    echo "=========================================="
    
    # 修复Docker问题
    fix_docker_issues
    
    # 重新部署
    redeploy_services
    
    # 验证部署
    verify_deployment
    
    print_success "问题修复完成！"
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
