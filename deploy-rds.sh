#!/bin/bash

# DCC数字员工系统 - 阿里云RDS快速部署脚本
# 服务器地址：47.103.27.235
# 关联域名：campus.kongbaijiyi.com

set -e

echo "🚀 DCC数字员工系统 - 阿里云RDS部署脚本"
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

# 检查Docker是否安装
check_docker() {
    log_info "检查Docker环境..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    log_success "Docker环境检查通过"
}

# 检查环境变量文件
check_env_file() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        if [ -f "env.production" ]; then
            log_info "复制生产环境配置模板..."
            cp env.production .env
            log_warning "请编辑 .env 文件，配置您的RDS数据库信息"
            log_warning "重要配置项："
            log_warning "  - DB_HOST: 您的RDS主机地址"
            log_warning "  - DB_USER: 您的RDS用户名"
            log_warning "  - DB_PASSWORD: 您的RDS密码"
            log_warning "  - 其他API密钥配置"
            echo ""
            read -p "配置完成后按Enter继续..."
        else
            log_error "未找到环境变量配置文件"
            exit 1
        fi
    fi
    log_success "环境变量配置检查完成"
}

# 初始化RDS数据库
init_database() {
    log_info "初始化RDS数据库..."
    
    # 检查Python环境
    if ! command -v python3 &> /dev/null; then
        log_error "Python3未安装，请先安装Python3"
        exit 1
    fi
    
    # 创建虚拟环境（如果不存在）
    if [ ! -d "venv" ]; then
        log_info "创建Python虚拟环境..."
        python3 -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    if [ -f "backend/requirements.txt" ]; then
        log_info "在虚拟环境中安装Python依赖..."
        source venv/bin/activate
        
        # 升级pip到最新版本
        pip install --upgrade pip
        
        # 安装依赖
        pip install -r backend/requirements.txt
        
        deactivate
    fi
    
    # 运行数据库初始化脚本
    if [ -f "init_rds_database.py" ]; then
        log_info "执行数据库初始化..."
        source venv/bin/activate
        python init_rds_database.py
        if [ $? -eq 0 ]; then
            log_success "数据库初始化完成"
        else
            log_error "数据库初始化失败"
            deactivate
            exit 1
        fi
        deactivate
    else
        log_warning "未找到数据库初始化脚本，跳过数据库初始化"
    fi
}

# 准备SSL证书
prepare_ssl() {
    log_info "检查SSL证书配置..."
    
    if [ ! -d "ssl" ]; then
        mkdir -p ssl
        log_warning "SSL证书目录不存在，已创建ssl目录"
        log_warning "如需启用HTTPS，请将证书文件放入ssl目录："
        log_warning "  - ssl/cert.pem (证书文件)"
        log_warning "  - ssl/key.pem (私钥文件)"
    fi
    
    # 检查证书文件
    if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
        log_success "SSL证书文件已准备"
        USE_HTTPS=true
    else
        log_warning "SSL证书文件不存在，将使用HTTP部署"
        USE_HTTPS=false
    fi
}

# 部署应用
deploy_app() {
    log_info "开始部署应用..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose down 2>/dev/null || true
    
    # 清理旧镜像（可选）
    read -p "是否清理旧镜像？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "清理旧镜像..."
        docker system prune -f
    fi
    
    # 构建镜像
    log_info "构建Docker镜像..."
    docker-compose build --no-cache
    
    # 选择部署方式
    if [ "$USE_HTTPS" = true ]; then
        log_info "使用HTTPS配置部署..."
        docker-compose -f docker-compose-https.yml up -d
    else
        log_info "使用HTTP配置部署..."
        docker-compose up -d
    fi
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    log_info "检查服务状态..."
    docker-compose ps
    
    log_success "应用部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署结果..."
    
    # 检查服务健康状态
    log_info "检查服务健康状态..."
    
    # 检查后端API
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
    if [ "$USE_HTTPS" = true ]; then
        echo "  🌐 主站: https://campus.kongbaijiyi.com"
        echo "  📚 API文档: https://campus.kongbaijiyi.com/docs"
        echo "  🔍 健康检查: https://campus.kongbaijiyi.com/api/health"
    else
        echo "  🌐 主站: http://campus.kongbaijiyi.com"
        echo "  📚 API文档: http://campus.kongbaijiyi.com/docs"
        echo "  🔍 健康检查: http://campus.kongbaijiyi.com/api/health"
    fi
    echo ""
    echo "管理命令："
    echo "  📊 查看服务状态: docker-compose ps"
    echo "  📝 查看日志: docker-compose logs -f"
    echo "  🔄 重启服务: docker-compose restart"
    echo "  🛑 停止服务: docker-compose down"
    echo ""
}

# 主函数
main() {
    echo "开始部署DCC数字员工系统到阿里云RDS..."
    echo ""
    
    # 执行部署步骤
    check_docker
    check_env_file
    init_database
    prepare_ssl
    deploy_app
    verify_deployment
    
    log_success "部署脚本执行完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
