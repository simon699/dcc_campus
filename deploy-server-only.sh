#!/bin/bash

# DCC数字员工系统 - 服务器端部署脚本
# 适用于代码已通过Git同步到服务器的情况

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

# 检查服务器连接
check_server_connection() {
    print_info "检查服务器连接..."
    
    if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo '连接成功'" 2>/dev/null; then
        print_warning "SSH连接需要密码认证"
        print_info "请在接下来的连接中输入服务器密码"
        
        # 测试连接（会提示输入密码）
        if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "echo '连接成功'" 2>/dev/null; then
            print_success "服务器连接正常"
        else
            print_error "无法连接到服务器 ${SERVER_IP}"
            print_info "请确保："
            echo "1. 服务器IP地址正确"
            echo "2. 服务器密码正确"
            echo "3. 服务器防火墙允许SSH连接"
            echo "4. 服务器用户权限正确"
            exit 1
        fi
    else
        print_success "服务器连接正常"
    fi
}

# 在服务器上执行部署
deploy_on_server() {
    print_info "在服务器上执行部署..."
    print_warning "部署过程中可能需要输入服务器密码"
    
    # 在服务器上执行部署命令
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
        set -e
        
        echo "=========================================="
        echo "DCC数字员工系统 - 服务器部署"
        echo "服务器: 47.103.27.235"
        echo "部署目录: /opt/dcc-digital-employee"
        echo "=========================================="
        
        cd /opt/dcc-digital-employee
        
        # 检查Docker环境
        if ! command -v docker &> /dev/null; then
            echo "安装Docker..."
            curl -fsSL https://get.docker.com | sh
            systemctl start docker
            systemctl enable docker
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            echo "安装Docker Compose..."
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # 安全停止DCC项目相关容器（不影响其他项目）
        echo "停止DCC项目相关容器..."
        docker-compose -f docker-compose-fast.yml down --remove-orphans 2>/dev/null || true
        docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
        
        # 只删除DCC项目相关的容器和网络
        echo "删除DCC项目相关容器和网络..."
        docker rm -f dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true
        docker network rm dcc-network 2>/dev/null || true
        
        # 显示当前Docker资源状态
        echo "当前Docker资源状态："
        echo "容器数量: $(docker ps -a | wc -l)"
        echo "镜像数量: $(docker images | wc -l)"
        echo "网络数量: $(docker network ls | wc -l)"
        echo "卷数量: $(docker volume ls | wc -l)"
        
        # 询问是否清理未使用的镜像
        echo ""
        echo "是否清理未使用的Docker镜像？"
        echo "注意：这可能会删除其他项目未使用的镜像"
        echo "如果服务器上只有DCC项目，可以选择清理"
        echo "如果有其他项目，建议跳过清理"
        echo ""
        read -p "是否清理未使用的镜像？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "清理未使用的Docker镜像..."
            docker image prune -f
            echo "镜像清理完成"
        else
            echo "跳过镜像清理，保持其他项目镜像"
        fi
        
        # 启动DCC服务
        echo "启动DCC服务..."
        docker-compose -f docker-compose-fast.yml up --build -d
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 30
        
        # 检查服务状态
        echo "检查DCC服务状态..."
        docker-compose -f docker-compose-fast.yml ps
        
        echo ""
        echo "部署完成！"
        echo "访问地址: http://campus.kongbaijiyi.com"
        echo "API文档: http://campus.kongbaijiyi.com/docs"
        echo ""
        echo "DCC项目容器状态："
        docker-compose -f docker-compose-fast.yml ps
        echo ""
        echo "常用命令："
        echo "查看日志: docker-compose -f docker-compose-fast.yml logs -f"
        echo "停止服务: docker-compose -f docker-compose-fast.yml down"
        echo "重启服务: docker-compose -f docker-compose-fast.yml restart"
EOF
    
    print_success "服务器部署完成"
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

# 显示部署信息
show_deployment_info() {
    echo ""
    echo "=========================================="
    echo "部署信息"
    echo "=========================================="
    echo "服务器IP: ${SERVER_IP}"
    echo "部署目录: ${DEPLOY_DIR}"
    echo ""
    echo "访问地址："
    echo "前端应用: http://campus.kongbaijiyi.com"
    echo "后端API: http://campus.kongbaijiyi.com/api"
    echo "API文档: http://campus.kongbaijiyi.com/docs"
    echo ""
    echo "服务器管理命令："
    echo "ssh ${SERVER_USER}@${SERVER_IP}"
    echo "cd ${DEPLOY_DIR}"
    echo "docker-compose -f docker-compose-fast.yml logs -f"
    echo ""
    echo "安全说明："
    echo "- 只影响DCC项目相关的Docker资源"
    echo "- 不会删除其他项目的容器、镜像、网络"
    echo "- 可选择是否清理未使用的镜像"
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "DCC数字员工系统 - 服务器部署"
    echo "目标服务器: ${SERVER_IP}"
    echo "前提条件: 代码已通过Git同步到服务器"
    echo "=========================================="
    
    # 检查服务器连接
    check_server_connection
    
    # 在服务器上部署
    deploy_on_server
    
    # 验证部署
    verify_deployment
    
    # 显示部署信息
    show_deployment_info
    
    print_success "部署完成！"
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
