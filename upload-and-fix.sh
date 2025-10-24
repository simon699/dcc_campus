#!/bin/bash

# DCC数字员工系统 - 上传并修复脚本
# 用于上传代码到服务器并执行修复

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_IP="47.103.27.235"
SERVER_PATH="/opt/dcc_campus"  # 更新为实际路径
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
        echo ""
        print_message "将使用手动部署方式..."
        return 1
    fi
    print_message "服务器连接正常"
    return 0
}

# 上传代码到服务器
upload_code() {
    print_message "上传代码到服务器..."
    
    # 创建临时目录
    TEMP_DIR="/tmp/dcc-update-$(date +%s)"
    
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
        --exclude=dcc-update.tar.gz \
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
    print_message "代码上传完成"
}

# 在服务器上执行修复
fix_services() {
    print_message "在服务器上执行修复..."
    
    ssh root@$SERVER_IP "
        cd $SERVER_PATH
        
        echo '=== 1. 查看当前服务状态 ==='
        docker-compose -f docker-compose-multi-project.yml ps
        echo ''
        
        echo '=== 2. 查看服务日志 ==='
        echo '前端服务日志：'
        docker-compose -f docker-compose-multi-project.yml logs --tail=10 frontend
        echo ''
        echo 'nginx服务日志：'
        docker-compose -f docker-compose-multi-project.yml logs --tail=10 nginx
        echo ''
        
        echo '=== 3. 测试服务内部连接 ==='
        echo '测试前端服务：'
        docker exec dcc-frontend wget --no-verbose --tries=1 --spider http://localhost:3000 || echo '前端服务测试失败'
        echo ''
        echo '测试nginx服务：'
        docker exec dcc-nginx wget --no-verbose --tries=1 --spider http://localhost:80 || echo 'nginx服务测试失败'
        echo ''
        
        echo '=== 4. 停止所有服务 ==='
        docker-compose -f docker-compose-multi-project.yml down
        echo ''
        
        echo '=== 5. 清理Docker系统 ==='
        docker system prune -f
        echo ''
        
        echo '=== 6. 重新启动服务 ==='
        docker-compose -f docker-compose-multi-project.yml up -d --build
        echo ''
        
        echo '=== 7. 等待服务启动（60秒）==='
        sleep 60
        echo ''
        
        echo '=== 8. 检查服务状态 ==='
        docker-compose -f docker-compose-multi-project.yml ps
        echo ''
        
        echo '=== 9. 测试外部访问 ==='
        echo '测试API健康检查：'
        curl -v http://localhost:8080/api/health || echo 'API测试失败'
        echo ''
        echo '测试前端访问：'
        curl -v http://localhost:8080/ || echo '前端测试失败'
        echo ''
        
        echo '=== 10. 检查端口占用 ==='
        netstat -tulpn | grep :8080 || echo '8080端口未监听'
        netstat -tulpn | grep :3001 || echo '3001端口未监听'
        echo ''
        
        echo '=== 修复完成 ==='
    "
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

# 手动部署指南
show_manual_deployment() {
    print_header "手动部署指南"
    
    echo "由于SSH连接问题，请按以下步骤在服务器上手动执行："
    echo ""
    echo "1. SSH登录服务器："
    echo "   ssh root@$SERVER_IP"
    echo ""
    echo "2. 进入项目目录："
    echo "   cd $SERVER_PATH"
    echo ""
    echo "3. 备份现有代码："
    echo "   tar -czf backup-\$(date +%Y%m%d-%H%M%S).tar.gz . --exclude=backup-*.tar.gz"
    echo ""
    echo "4. 更新代码（选择其中一种方式）："
    echo "   方式A - 使用git："
    echo "   git pull origin main"
    echo ""
    echo "   方式B - 上传新代码："
    echo "   在本地执行：tar -czf dcc-update.tar.gz --exclude=node_modules --exclude=venv --exclude=.git ."
    echo "   然后：scp dcc-update.tar.gz root@$SERVER_IP:$SERVER_PATH/"
    echo "   在服务器上：tar -xzf dcc-update.tar.gz && rm dcc-update.tar.gz"
    echo ""
    echo "5. 执行修复脚本："
    echo "   chmod +x *.sh"
    echo "   ./fix-services.sh"
    echo ""
    echo "6. 检查服务状态："
    echo "   docker-compose -f docker-compose-multi-project.yml ps"
    echo ""
    echo "7. 测试访问："
    echo "   curl http://localhost:8080/api/health"
    echo "   curl http://localhost:8080/"
}

# 创建服务器端修复脚本
create_server_fix_script() {
    print_message "创建服务器端修复脚本..."
    
    cat > fix-services.sh << 'EOF'
#!/bin/bash

echo "=== DCC服务修复脚本 ==="
echo ""

echo "1. 查看当前服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "2. 查看服务日志："
echo "前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 frontend
echo ""
echo "nginx服务日志："
docker-compose -f docker-compose-multi-project.yml logs --tail=10 nginx
echo ""

echo "3. 测试服务内部连接："
echo "测试前端服务："
docker exec dcc-frontend wget --no-verbose --tries=1 --spider http://localhost:3000 || echo "前端服务测试失败"
echo ""
echo "测试nginx服务："
docker exec dcc-nginx wget --no-verbose --tries=1 --spider http://localhost:80 || echo "nginx服务测试失败"
echo ""

echo "4. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down
echo ""

echo "5. 清理Docker系统："
docker system prune -f
echo ""

echo "6. 重新启动服务："
docker-compose -f docker-compose-multi-project.yml up -d --build
echo ""

echo "7. 等待服务启动（60秒）："
sleep 60
echo ""

echo "8. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "9. 测试外部访问："
echo "测试API健康检查："
curl -v http://localhost:8080/api/health || echo "API测试失败"
echo ""
echo "测试前端访问："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "10. 检查端口占用："
netstat -tulpn | grep :8080 || echo "8080端口未监听"
netstat -tulpn | grep :3001 || echo "3001端口未监听"
echo ""

echo "=== 修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
EOF

    chmod +x fix-services.sh
    print_message "服务器端修复脚本已创建"
}

# 主函数
main() {
    print_header "DCC数字员工系统 - 上传并修复脚本"
    
    # 创建服务器端修复脚本
    create_server_fix_script
    
    # 检查SSH连接
    if check_ssh_connection; then
        # 上传代码
        upload_code
        
        # 执行修复
        fix_services
        
        # 显示部署信息
        show_deployment_info
    else
        # 显示手动部署指南
        show_manual_deployment
    fi
    
    print_message "脚本执行完成！"
}

# 运行主函数
main "$@"
