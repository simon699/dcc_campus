#!/bin/bash

# DCC数字员工系统 - ECS直接运行部署脚本
# 不使用Docker，直接在ECS上安装和运行

set -e

echo "🚀 DCC数字员工系统 - ECS直接运行部署"
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

# 安装系统依赖
install_system_deps() {
    log_info "安装系统依赖..."
    
    # 更新包索引
    sudo apt-get update
    
    # 安装必要的系统包
    sudo apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        build-essential \
        libmysqlclient-dev \
        pkg-config \
        curl \
        wget \
        git \
        nginx \
        supervisor \
        htop \
        vim \
        unzip
    
    log_success "系统依赖安装完成"
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js..."
    
    # 检查Node.js是否已安装
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        log_success "Node.js已安装: $node_version"
        return 0
    fi
    
    # 使用NodeSource安装Node.js 20 LTS
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # 验证安装
    node_version=$(node --version)
    npm_version=$(npm --version)
    log_success "Node.js安装完成: $node_version"
    log_success "npm安装完成: $npm_version"
}

# 配置Python环境
setup_python_env() {
    log_info "配置Python环境..."
    
    # 创建虚拟环境
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        log_success "Python虚拟环境创建完成"
    else
        log_info "Python虚拟环境已存在"
    fi
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 升级pip
    pip install --upgrade pip
    
    # 配置pip使用国内镜像源
    pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
    pip config set global.trusted-host mirrors.aliyun.com
    
    log_success "Python环境配置完成"
}

# 安装后端依赖
install_backend_deps() {
    log_info "安装后端依赖..."
    
    # 激活虚拟环境
    source venv/bin/activate
    
    # 安装Python依赖
    cd backend
    pip install -r requirements.txt
    cd ..
    
    log_success "后端依赖安装完成"
}

# 安装前端依赖
install_frontend_deps() {
    log_info "安装前端依赖..."
    
    # 配置npm使用国内镜像源
    npm config set registry https://registry.npmmirror.com
    
    # 安装前端依赖
    cd dcc-digital-employee
    npm install
    cd ..
    
    log_success "前端依赖安装完成"
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
    
    log_success "环境变量配置检查通过"
}

# 初始化数据库
init_database() {
    log_info "初始化RDS数据库..."
    
    # 加载环境变量
    source .env
    
    # 安装MySQL客户端
    sudo apt-get install -y mysql-client
    
    # 创建数据库
    log_info "创建数据库..."
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
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
            mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
                < "$sql_file" 2>/dev/null
            
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

# 配置Nginx
configure_nginx() {
    log_info "配置Nginx..."
    
    # 备份原配置
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    
    # 创建Nginx配置
    sudo tee /etc/nginx/sites-available/dcc-campus > /dev/null <<EOF
server {
    listen 80;
    server_name campus.kongbaijiyi.com;
    
    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # API路由 - 转发到后端
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS头设置
        add_header Access-Control-Allow-Origin "http://campus.kongbaijiyi.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, access-token" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # 处理CORS预检请求
        if (\$request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "http://campus.kongbaijiyi.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, access-token" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # API文档路由
    location /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # ReDoc文档路由
    location /redoc {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # OpenAPI JSON路由
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 前端应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
    
    # 启用站点
    sudo ln -sf /etc/nginx/sites-available/dcc-campus /etc/nginx/sites-enabled/
    
    # 删除默认站点
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试Nginx配置
    sudo nginx -t
    
    # 重启Nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    log_success "Nginx配置完成"
}

# 配置Supervisor
configure_supervisor() {
    log_info "配置Supervisor..."
    
    # 后端服务配置
    sudo tee /etc/supervisor/conf.d/dcc-backend.conf > /dev/null <<EOF
[program:dcc-backend]
command=/opt/dcc_campus/dcc_campus/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
directory=/opt/dcc_campus/dcc_campus/backend
user=root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/dcc-backend.log
environment=PATH="/opt/dcc_campus/dcc_campus/venv/bin"
EOF
    
    # 前端服务配置
    sudo tee /etc/supervisor/conf.d/dcc-frontend.conf > /dev/null <<EOF
[program:dcc-frontend]
command=npm start
directory=/opt/dcc_campus/dcc_campus/dcc-digital-employee
user=root
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/dcc-frontend.log
environment=NODE_ENV=production,NEXT_PUBLIC_API_BASE_URL=http://campus.kongbaijiyi.com/api
EOF
    
    # 重新加载Supervisor配置
    sudo supervisorctl reread
    sudo supervisorctl update
    
    log_success "Supervisor配置完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 启动后端服务
    sudo supervisorctl start dcc-backend
    
    # 启动前端服务
    sudo supervisorctl start dcc-frontend
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    sudo supervisorctl status
    
    log_success "服务启动完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署结果..."
    
    # 检查服务状态
    sudo supervisorctl status
    
    # 检查端口
    netstat -tlnp | grep -E ':(80|3000|8000)'
    
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
    echo "  📊 查看服务状态: sudo supervisorctl status"
    echo "  📝 查看日志: sudo supervisorctl tail -f dcc-backend"
    echo "  🔄 重启服务: sudo supervisorctl restart dcc-backend"
    echo "  🛑 停止服务: sudo supervisorctl stop dcc-backend"
    echo ""
}

# 创建管理脚本
create_management_scripts() {
    log_info "创建管理脚本..."
    
    # 创建重启脚本
    cat > restart-services.sh << 'EOF'
#!/bin/bash
echo "🔄 重启DCC数字员工系统服务..."
sudo supervisorctl restart dcc-backend
sudo supervisorctl restart dcc-frontend
sudo systemctl restart nginx
echo "✅ 服务重启完成"
EOF
    
    # 创建停止脚本
    cat > stop-services.sh << 'EOF'
#!/bin/bash
echo "🛑 停止DCC数字员工系统服务..."
sudo supervisorctl stop dcc-backend
sudo supervisorctl stop dcc-frontend
sudo systemctl stop nginx
echo "✅ 服务停止完成"
EOF
    
    # 创建日志查看脚本
    cat > view-logs.sh << 'EOF'
#!/bin/bash
echo "📋 查看DCC数字员工系统日志..."
echo "选择要查看的日志："
echo "1) 后端日志"
echo "2) 前端日志"
echo "3) Nginx日志"
echo "4) 所有日志"
read -p "请选择 (1-4): " choice

case $choice in
    1) sudo supervisorctl tail -f dcc-backend ;;
    2) sudo supervisorctl tail -f dcc-frontend ;;
    3) sudo tail -f /var/log/nginx/access.log ;;
    4) echo "后端日志:"; sudo supervisorctl tail -f dcc-backend & echo "前端日志:"; sudo supervisorctl tail -f dcc-frontend & echo "Nginx日志:"; sudo tail -f /var/log/nginx/access.log ;;
    *) echo "无效选择" ;;
esac
EOF
    
    # 创建状态查看脚本
    cat > check-status.sh << 'EOF'
#!/bin/bash
echo "📊 DCC数字员工系统状态..."
echo "=== Supervisor服务状态 ==="
sudo supervisorctl status
echo ""
echo "=== 端口监听状态 ==="
netstat -tlnp | grep -E ':(80|3000|8000)'
echo ""
echo "=== 健康检查 ==="
curl -f http://localhost/api/health && echo "✅ API服务正常" || echo "❌ API服务异常"
EOF
    
    # 给脚本添加执行权限
    chmod +x restart-services.sh stop-services.sh view-logs.sh check-status.sh
    
    log_success "管理脚本创建完成"
}

# 主函数
main() {
    echo "开始部署DCC数字员工系统到ECS（直接运行模式）..."
    echo ""
    
    check_system
    install_system_deps
    install_nodejs
    setup_python_env
    install_backend_deps
    install_frontend_deps
    check_env
    init_database
    configure_nginx
    configure_supervisor
    start_services
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
