#!/bin/bash

# DCC数字员工系统 - 服务器更新部署脚本
# 用于更新服务器代码并重新部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_IP="47.103.27.235"
SERVER_PATH="/opt/dcc-employee"
DOMAIN="campus.kongbaijiyi.com"

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# 检查SSH连接
check_ssh_connection() {
    print_message "检查服务器连接..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes root@$SERVER_IP "echo 'SSH连接正常'" 2>/dev/null; then
        print_error "无法连接到服务器 $SERVER_IP"
        print_message "请确保："
        echo "  1. 服务器IP地址正确"
        echo "  2. SSH密钥已配置"
        echo "  3. 服务器防火墙允许SSH连接"
        exit 1
    fi
    print_message "服务器连接正常"
}

# 备份现有代码
backup_existing_code() {
    print_message "备份现有代码..."
    ssh root@$SERVER_IP "cd $SERVER_PATH && tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz . --exclude=backup-*.tar.gz" || {
        print_warning "备份失败，继续部署..."
    }
    print_message "代码备份完成"
}

# 更新服务器代码
update_server_code() {
    print_header "更新服务器代码"
    
    # 创建临时目录
    TEMP_DIR="/tmp/dcc-update-$(date +%s)"
    print_message "创建临时目录: $TEMP_DIR"
    
    # 打包当前代码
    print_message "打包当前代码..."
    tar -czf dcc-update.tar.gz \
        --exclude=node_modules \
        --exclude=venv \
        --exclude=.git \
        --exclude=__pycache__ \
        --exclude=*.pyc \
        --exclude=.env \
        --exclude=backup-*.tar.gz \
        .
    
    # 上传代码到服务器
    print_message "上传代码到服务器..."
    scp dcc-update.tar.gz root@$SERVER_IP:$TEMP_DIR/
    
    # 在服务器上解压代码
    print_message "在服务器上解压代码..."
    ssh root@$SERVER_IP "
        mkdir -p $TEMP_DIR
        cd $SERVER_PATH
        tar -xzf $TEMP_DIR/dcc-update.tar.gz
        chmod +x *.sh
        rm -f $TEMP_DIR/dcc-update.tar.gz
    "
    
    # 清理本地临时文件
    rm -f dcc-update.tar.gz
    print_message "代码更新完成"
}

# 配置环境变量
setup_environment() {
    print_message "配置环境变量..."
    ssh root@$SERVER_IP "
        cd $SERVER_PATH
        if [ ! -f .env ]; then
            cp env.template .env
            print_message '已创建.env文件，请手动编辑配置'
        else
            print_message '环境配置文件已存在'
        fi
    "
}

# 停止现有服务
stop_existing_services() {
    print_message "停止现有服务..."
    ssh root@$SERVER_IP "
        cd $SERVER_PATH
        docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || true
        docker-compose -f docker-compose.yml down 2>/dev/null || true
    "
    print_message "现有服务已停止"
}

# 启动服务
start_services() {
    print_header "启动服务"
    
    print_message "使用多项目配置启动服务..."
    ssh root@$SERVER_IP "
        cd $SERVER_PATH
        docker-compose -f docker-compose-multi-project.yml up -d --build
    "
    
    print_message "服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    print_message "等待服务启动..."
    
    # 等待服务启动
    print_message "等待服务就绪（最多等待5分钟）..."
    timeout 300 bash -c '
        while true; do
            if ssh root@'$SERVER_IP' "curl -f http://localhost:8080/api/health >/dev/null 2>&1"; then
                echo "服务已就绪"
                break
            fi
            echo "等待服务启动..."
            sleep 10
        done
    ' || {
        print_error "服务启动超时"
        return 1
    }
    
    print_message "所有服务已就绪"
}

# 显示部署信息
show_deployment_info() {
    print_header "部署完成"
    
    echo "访问地址："
    echo "  校园系统: http://$DOMAIN:8080"
    echo "  后端API: http://$DOMAIN:8080/api"
    echo "  API文档: http://$DOMAIN:8080/docs"
    echo ""
    echo "服务器信息："
    echo "  IP地址: $SERVER_IP"
    echo "  部署路径: $SERVER_PATH"
    echo "  域名: $DOMAIN"
    echo ""
    echo "管理命令："
    echo "  SSH连接: ssh root@$SERVER_IP"
    echo "  查看服务: ssh root@$SERVER_IP 'cd $SERVER_PATH && docker-compose -f docker-compose-multi-project.yml ps'"
    echo "  查看日志: ssh root@$SERVER_IP 'cd $SERVER_PATH && docker-compose -f docker-compose-multi-project.yml logs -f'"
    echo "  重启服务: ssh root@$SERVER_IP 'cd $SERVER_PATH && docker-compose -f docker-compose-multi-project.yml restart'"
}

# 验证部署
verify_deployment() {
    print_message "验证部署..."
    
    # 检查服务状态
    print_message "检查服务状态..."
    ssh root@$SERVER_IP "
        cd $SERVER_PATH
        docker-compose -f docker-compose-multi-project.yml ps
    "
    
    # 测试API
    print_message "测试API连接..."
    if curl -f "http://$SERVER_IP:8080/api/health" >/dev/null 2>&1; then
        print_message "API测试成功"
    else
        print_warning "API测试失败，请检查服务状态"
    fi
}

# 主函数
main() {
    print_header "DCC数字员工系统 - 服务器更新部署"
    
    # 检查SSH连接
    check_ssh_connection
    
    # 备份现有代码
    backup_existing_code
    
    # 更新服务器代码
    update_server_code
    
    # 配置环境变量
    setup_environment
    
    # 停止现有服务
    stop_existing_services
    
    # 启动服务
    start_services
    
    # 等待服务就绪
    if wait_for_services; then
        # 验证部署
        verify_deployment
        
        # 显示部署信息
        show_deployment_info
        print_message "部署成功完成！"
    else
        print_error "服务启动失败，请检查日志"
        ssh root@$SERVER_IP "cd $SERVER_PATH && docker-compose -f docker-compose-multi-project.yml logs"
        exit 1
    fi
}

# 运行主函数
main "$@"
