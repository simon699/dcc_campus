#!/bin/bash

# DCC数字员工系统 - 阿里云Docker部署脚本
# 适用于阿里云ECS服务器部署

set -e

echo "🚀 DCC数字员工系统 - 阿里云部署"
echo "================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查系统环境
check_system() {
    log_info "检查系统环境..."
    
    # 检查操作系统
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "此脚本仅支持Linux系统"
        exit 1
    fi
    
    # 检查是否为root用户
    if [[ $EUID -eq 0 ]]; then
        log_warning "建议不要使用root用户运行此脚本"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "系统环境检查通过"
}

# 安装Docker和Docker Compose
install_docker() {
    log_info "检查Docker环境..."
    
    if command -v docker &> /dev/null; then
        log_success "Docker已安装"
    else
        log_info "安装Docker..."
        
        # 更新包索引
        sudo apt-get update
        
        # 安装必要的包
        sudo apt-get install -y \
            apt-transport-https \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # 添加Docker官方GPG密钥
        curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # 设置稳定版仓库
        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
            $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # 更新包索引
        sudo apt-get update
        
        # 安装Docker Engine
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        
        # 启动Docker服务
        sudo systemctl start docker
        sudo systemctl enable docker
        
        # 将当前用户添加到docker组
        sudo usermod -aG docker $USER
        
        log_success "Docker安装完成"
        log_warning "请重新登录以使docker组权限生效"
    fi
    
    # 检查Docker Compose
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose已安装"
    else
        log_info "安装Docker Compose..."
        
        # 获取最新版本号
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
        
        # 下载Docker Compose
        sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        
        # 添加执行权限
        sudo chmod +x /usr/local/bin/docker-compose
        
        # 创建软链接
        sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        
        log_success "Docker Compose安装完成"
    fi
}

# 配置Docker镜像源
configure_docker_registry() {
    log_info "配置Docker镜像源..."
    
    # 创建Docker配置目录
    sudo mkdir -p /etc/docker
    
    # 配置Docker镜像源
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
    "registry-mirrors": [
        "https://g0qd096q.mirror.aliyuncs.com",
        "https://registry.cn-hangzhou.aliyuncs.com",
        "https://mirror.ccs.tencentyun.com",
        "https://docker.mirrors.ustc.edu.cn",
        "https://reg-mirror.qiniu.com"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    },
    "max-concurrent-downloads": 10,
    "max-concurrent-uploads": 5
}
EOF
    
    # 重启Docker服务
    sudo systemctl daemon-reload
    sudo systemctl restart docker
    
    log_success "Docker镜像源配置完成"
}

# 检查项目文件
check_project_files() {
    log_info "检查项目文件..."
    
    # 检查是否在正确的项目目录
    if [[ ! "$(pwd)" == "/opt/dcc_campus/dcc_campus" ]]; then
        log_error "请在项目根目录 /opt/dcc_campus/dcc_campus 下运行此脚本"
        log_info "当前目录: $(pwd)"
        log_info "请执行: cd /opt/dcc_campus/dcc_campus && ./deploy-aliyun.sh"
        exit 1
    fi
    
    # 检查必要文件
    required_files=(
        "docker-compose-china.yml"
        "backend/Dockerfile.china"
        "dcc-digital-employee/Dockerfile"
        "nginx-docker.conf"
        ".env"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少必要文件: $file"
            exit 1
        fi
    done
    
    log_success "项目文件检查通过"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量配置..."
    
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    
    # 检查关键配置
    if ! grep -q "DB_HOST=.*\.mysql\.rds\.aliyuncs\.com" .env; then
        log_error "请确保.env文件中配置了正确的RDS地址"
        exit 1
    fi
    
    if grep -q "DB_PASSWORD=your_rds_password" .env; then
        log_error "请设置.env文件中的DB_PASSWORD为您的实际RDS密码"
        exit 1
    fi
    
    # 检查阿里云相关配置
    if ! grep -q "ALIBABA_CLOUD_ACCESS_KEY_ID=" .env; then
        log_warning "未配置阿里云AccessKey，部分功能可能无法使用"
    fi
    
    log_success "环境变量配置检查通过"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    
    # 检查ufw是否安装
    if command -v ufw &> /dev/null; then
        # 允许必要端口
        sudo ufw allow 22/tcp    # SSH
        sudo ufw allow 80/tcp    # HTTP
        sudo ufw allow 443/tcp   # HTTPS
        
        # 启用防火墙
        sudo ufw --force enable
        
        log_success "防火墙配置完成"
    else
        log_warning "未安装ufw防火墙，请手动配置防火墙规则"
    fi
}

# 初始化数据库
init_database() {
    log_info "初始化RDS数据库..."
    
    # 加载环境变量
    source .env
    
    # 使用Docker MySQL客户端创建数据库
    log_info "创建数据库..."
    docker run --rm --network host mysql:8.0 mysql \
        -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
        -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "数据库 $DB_NAME 创建成功"
    else
        log_error "数据库创建失败，请检查RDS连接信息"
        exit 1
    fi
    
    # 创建表结构
    log_info "创建表结构..."
    sql_files=(
        "backend/database/01_create_tables.sql"
        "backend/database/02_call_tasks.sql"
        "backend/database/03_auto_call_tables.sql"
        "backend/database/04_dcc_leads.sql"
    )
    
    for sql_file in "${sql_files[@]}"; do
        if [ -f "$sql_file" ]; then
            log_info "执行SQL文件: $sql_file"
            # 使用cat命令将SQL文件内容传递给mysql命令
            cat "$sql_file" | docker run --rm --network host -i mysql:8.0 mysql \
                -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                log_success "$sql_file 执行完成"
            else
                log_error "$sql_file 执行失败"
                exit 1
            fi
        else
            log_warning "SQL文件不存在: $sql_file"
        fi
    done
    
    log_success "数据库初始化完成"
}

# 部署应用
deploy_app() {
    log_info "开始部署应用..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f docker-compose-china.yml down 2>/dev/null || true
    
    # 清理旧镜像
    log_info "清理旧镜像..."
    docker system prune -f
    
    # 构建镜像（使用国内镜像源）
    log_info "构建Docker镜像（使用国内镜像源）..."
    
    # 设置Docker构建超时和重试
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # 先拉取基础镜像
    log_info "预拉取基础镜像..."
    docker pull registry.cn-hangzhou.aliyuncs.com/library/python:3.10-slim || true
    docker pull node:lts-alpine || true
    docker pull registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine || true
    
    # 构建镜像，增加超时时间
    timeout 1800 docker-compose -f docker-compose-china.yml build --no-cache --parallel
    
    # 启动服务
    log_info "启动服务..."
    docker-compose -f docker-compose-china.yml up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    log_success "应用部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署结果..."
    
    # 检查服务状态
    docker-compose -f docker-compose-china.yml ps
    
    # 检查API健康状态
    log_info "检查API健康状态..."
    if curl -f http://localhost:8000/api/health >/dev/null 2>&1; then
        log_success "后端API服务正常"
    else
        log_warning "后端API服务可能未正常启动"
    fi
    
    # 检查前端服务
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "前端服务正常"
    else
        log_warning "前端服务可能未正常启动"
    fi
    
    # 检查Nginx服务
    if curl -f http://localhost >/dev/null 2>&1; then
        log_success "Nginx服务正常"
    else
        log_warning "Nginx服务可能未正常启动"
    fi
    
    echo ""
    log_success "部署验证完成"
    echo "================================================"
    echo "🎉 DCC数字员工系统部署完成！"
    echo ""
    echo "访问地址："
    echo "  🌐 主站: http://campus.kongbaijiyi.com"
    echo "  📚 API文档: http://campus.kongbaijiyi.com/docs"
    echo "  🔍 健康检查: http://campus.kongbaijiyi.com/api/health"
    echo ""
    echo "管理命令："
    echo "  📊 查看服务状态: docker-compose -f docker-compose-china.yml ps"
    echo "  📝 查看日志: docker-compose -f docker-compose-china.yml logs -f"
    echo "  🔄 重启服务: docker-compose -f docker-compose-china.yml restart"
    echo "  🛑 停止服务: docker-compose -f docker-compose-china.yml down"
    echo ""
    echo "日志查看："
    echo "  📋 后端日志: docker-compose -f docker-compose-china.yml logs -f backend"
    echo "  📋 前端日志: docker-compose -f docker-compose-china.yml logs -f frontend"
    echo "  📋 Nginx日志: docker-compose -f docker-compose-china.yml logs -f nginx"
    echo ""
}

# 创建管理脚本
create_management_scripts() {
    log_info "创建管理脚本..."
    
    # 创建重启脚本
    cat > restart-services.sh << 'EOF'
#!/bin/bash
echo "🔄 重启DCC数字员工系统服务..."
docker-compose -f docker-compose-china.yml restart
echo "✅ 服务重启完成"
EOF
    
    # 创建停止脚本
    cat > stop-services.sh << 'EOF'
#!/bin/bash
echo "🛑 停止DCC数字员工系统服务..."
docker-compose -f docker-compose-china.yml down
echo "✅ 服务停止完成"
EOF
    
    # 创建日志查看脚本
    cat > view-logs.sh << 'EOF'
#!/bin/bash
echo "📋 查看DCC数字员工系统日志..."
docker-compose -f docker-compose-china.yml logs -f
EOF
    
    # 创建状态查看脚本
    cat > check-status.sh << 'EOF'
#!/bin/bash
echo "📊 DCC数字员工系统状态..."
docker-compose -f docker-compose-china.yml ps
echo ""
echo "🔍 健康检查..."
curl -f http://localhost/api/health && echo "✅ API服务正常" || echo "❌ API服务异常"
EOF
    
    # 给脚本添加执行权限
    chmod +x restart-services.sh stop-services.sh view-logs.sh check-status.sh
    
    log_success "管理脚本创建完成"
}

# 主函数
main() {
    echo "开始部署DCC数字员工系统到阿里云..."
    echo ""
    
    check_system
    install_docker
    configure_docker_registry
    check_project_files
    check_env
    configure_firewall
    init_database
    deploy_app
    verify_deployment
    create_management_scripts
    
    log_success "部署脚本执行完成！"
    echo ""
    echo "📝 后续操作："
    echo "1. 确保域名 campus.kongbaijiyi.com 已解析到服务器IP"
    echo "2. 检查防火墙是否开放80端口"
    echo "3. 设置定时备份数据库"
    echo "4. 配置监控告警"
    echo ""
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
