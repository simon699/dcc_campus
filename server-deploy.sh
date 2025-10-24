#!/bin/bash

# DCC数字员工系统 - 服务器部署脚本
# 适用于阿里云ECS服务器部署 (IP: 47.103.27.235)

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
PROJECT_NAME="dcc-digital-employee"
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

# 检查本地环境
check_local_env() {
    print_info "检查本地环境..."
    
    if ! command -v docker &> /dev/null; then
        print_error "本地Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "本地Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    if ! command -v rsync &> /dev/null; then
        print_error "rsync未安装，请先安装rsync"
        exit 1
    fi
    
    print_success "本地环境检查通过"
}

# 检查服务器连接
check_server_connection() {
    print_info "检查服务器连接..."
    
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes ${SERVER_USER}@${SERVER_IP} "echo '连接成功'" 2>/dev/null; then
        print_error "无法连接到服务器 ${SERVER_IP}"
        print_info "请确保："
        echo "1. 服务器IP地址正确"
        echo "2. SSH密钥已配置"
        echo "3. 服务器防火墙允许SSH连接"
        echo "4. 服务器用户权限正确"
        exit 1
    fi
    
    print_success "服务器连接正常"
}

# 准备部署文件
prepare_deployment() {
    print_info "准备部署文件..."
    
    # 创建临时部署目录
    TEMP_DIR="/tmp/dcc-deploy-$(date +%s)"
    mkdir -p "$TEMP_DIR"
    
    # 复制项目文件
    print_info "复制项目文件到临时目录..."
    rsync -av --exclude='.git' \
              --exclude='node_modules' \
              --exclude='.next' \
              --exclude='__pycache__' \
              --exclude='*.pyc' \
              --exclude='venv' \
              --exclude='.env' \
              --exclude='*.log' \
              --exclude='mysql_data' \
              --exclude='nginx_logs' \
              ./ "$TEMP_DIR/"
    
    # 创建服务器环境变量文件
    print_info "创建服务器环境变量文件..."
    cat > "$TEMP_DIR/.env" << EOF
# DCC数字员工系统 - 服务器环境配置
# 部署时间: $(date)

# ===================
# 数据库配置
# ===================
DB_HOST=mysql
DB_PORT=3306
DB_USER=dcc_user
DB_PASSWORD=,Dcc123456
DB_NAME=dcc_employee_db

# ===================
# JWT认证配置
# ===================
JWT_SECRET_KEY=dcc-jwt-secret-key-2024-$(date +%s)
JWT_EXPIRE_HOURS=24

# ===================
# 阿里云配置
# ===================
ALIBABA_CLOUD_ACCESS_KEY_ID=\${ALIBABA_CLOUD_ACCESS_KEY_ID}
ALIBABA_CLOUD_ACCESS_KEY_SECRET=\${ALIBABA_CLOUD_ACCESS_KEY_SECRET}
INSTANCE_ID=\${INSTANCE_ID}

# ===================
# 阿里百炼配置
# ===================
DASHSCOPE_API_KEY=\${DASHSCOPE_API_KEY}
ALIBAILIAN_APP_ID=\${ALIBAILIAN_APP_ID}

# ===================
# 应用配置
# ===================
ENVIRONMENT=production
DEBUG=false

# ===================
# 前端配置
# ===================
NEXT_PUBLIC_API_BASE_URL=http://${SERVER_IP}/api
NODE_ENV=production

# ===================
# 部署配置
# ===================
SERVER_DOMAIN=${SERVER_IP}
ENABLE_HTTPS=false
LOG_LEVEL=INFO
ENABLE_MONITORING=true
EOF
    
    print_success "部署文件准备完成: $TEMP_DIR"
    echo "$TEMP_DIR"
}

# 上传文件到服务器
upload_to_server() {
    local temp_dir="$1"
    
    print_info "上传文件到服务器..."
    
    # 在服务器上创建部署目录
    ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${DEPLOY_DIR}"
    
    # 上传项目文件
    print_info "正在上传项目文件..."
    rsync -av --delete "$temp_dir/" ${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/
    
    # 设置文件权限
    ssh ${SERVER_USER}@${SERVER_IP} "chmod +x ${DEPLOY_DIR}/*.sh"
    
    print_success "文件上传完成"
}

# 在服务器上部署
deploy_on_server() {
    print_info "在服务器上执行部署..."
    
    ssh ${SERVER_USER}@${SERVER_IP} << EOF
        set -e
        
        echo "=========================================="
        echo "DCC数字员工系统 - 服务器部署"
        echo "服务器: ${SERVER_IP}"
        echo "部署目录: ${DEPLOY_DIR}"
        echo "=========================================="
        
        cd ${DEPLOY_DIR}
        
        # 检查Docker环境
        if ! command -v docker &> /dev/null; then
            echo "安装Docker..."
            curl -fsSL https://get.docker.com | sh
            systemctl start docker
            systemctl enable docker
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            echo "安装Docker Compose..."
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # 停止并删除现有容器
        echo "停止并删除现有容器..."
        docker-compose -f docker-compose-fast.yml down --remove-orphans 2>/dev/null || true
        docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
        
        # 删除相关容器和网络
        docker rm -f dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true
        docker network rm dcc-network 2>/dev/null || true
        
        # 清理Docker资源
        docker image prune -f
        
        # 启动服务
        echo "启动服务..."
        docker-compose -f docker-compose-fast.yml up --build -d
        
        # 等待服务启动
        echo "等待服务启动..."
        sleep 30
        
        # 检查服务状态
        echo "检查服务状态..."
        docker-compose -f docker-compose-fast.yml ps
        
        echo ""
        echo "部署完成！"
        echo "访问地址: http://${SERVER_IP}"
        echo "API文档: http://${SERVER_IP}/docs"
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
    if curl -f http://${SERVER_IP}/api/health >/dev/null 2>&1; then
        print_success "后端API服务正常"
    else
        print_warning "后端API服务可能未就绪，请稍后检查"
    fi
    
    if curl -f http://${SERVER_IP} >/dev/null 2>&1; then
        print_success "前端服务正常"
    else
        print_warning "前端服务可能未就绪，请稍后检查"
    fi
    
    print_info "部署验证完成"
    echo ""
    echo "访问地址："
    echo "前端应用: http://${SERVER_IP}"
    echo "后端API: http://${SERVER_IP}/api"
    echo "API文档: http://${SERVER_IP}/docs"
    echo "ReDoc文档: http://${SERVER_IP}/redoc"
}

# 清理临时文件
cleanup_temp() {
    local temp_dir="$1"
    if [ -d "$temp_dir" ]; then
        print_info "清理临时文件..."
        rm -rf "$temp_dir"
        print_success "临时文件清理完成"
    fi
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo "=========================================="
    echo "部署信息"
    echo "=========================================="
    echo "服务器IP: ${SERVER_IP}"
    echo "部署目录: ${DEPLOY_DIR}"
    echo "项目名称: ${PROJECT_NAME}"
    echo ""
    echo "访问地址："
    echo "前端应用: http://${SERVER_IP}"
    echo "后端API: http://${SERVER_IP}/api"
    echo "API文档: http://${SERVER_IP}/docs"
    echo ""
    echo "服务器管理命令："
    echo "ssh ${SERVER_USER}@${SERVER_IP}"
    echo "cd ${DEPLOY_DIR}"
    echo "docker-compose -f docker-compose-fast.yml logs -f"
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "DCC数字员工系统 - 服务器部署"
    echo "目标服务器: ${SERVER_IP}"
    echo "=========================================="
    
    # 检查本地环境
    check_local_env
    
    # 检查服务器连接
    check_server_connection
    
    # 准备部署文件
    TEMP_DIR=$(prepare_deployment)
    
    # 上传文件到服务器
    upload_to_server "$TEMP_DIR"
    
    # 在服务器上部署
    deploy_on_server
    
    # 验证部署
    verify_deployment
    
    # 清理临时文件
    cleanup_temp "$TEMP_DIR"
    
    # 显示部署信息
    show_deployment_info
    
    print_success "部署完成！"
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
