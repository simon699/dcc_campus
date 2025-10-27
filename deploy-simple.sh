#!/bin/bash

# DCC数字员工系统 - 简化部署脚本
# 完全避免Python网络问题

set -e

echo "🚀 DCC数字员工系统 - 简化部署"
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

# 检查Docker
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

# 检查环境变量
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    
    # 检查关键配置
    if ! grep -q "DB_HOST=yrm-" .env; then
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
    
    # 使用Docker MySQL客户端创建数据库
    log_info "创建数据库..."
    docker run --rm --network host mysql:8.0 mysql \
        -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
        -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "数据库 $DB_NAME 创建成功"
    else
        log_error "数据库创建失败"
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
            docker run --rm --network host -v "$(pwd):/data" mysql:8.0 mysql \
                -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
                < "/data/$sql_file" 2>/dev/null
            
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
    docker-compose down 2>/dev/null || true
    
    # 构建镜像
    log_info "构建Docker镜像..."
    docker-compose build --no-cache
    
    # 启动服务
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    log_success "应用部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署结果..."
    
    # 检查服务状态
    docker-compose ps
    
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
    echo "  📊 查看服务状态: docker-compose ps"
    echo "  📝 查看日志: docker-compose logs -f"
    echo "  🔄 重启服务: docker-compose restart"
    echo "  🛑 停止服务: docker-compose down"
    echo ""
}

# 主函数
main() {
    echo "开始部署DCC数字员工系统..."
    echo ""
    
    check_docker
    check_env
    init_database
    deploy_app
    verify_deployment
    
    log_success "部署脚本执行完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
