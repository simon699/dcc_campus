#!/bin/bash

# DCC数字员工系统 - MySQL客户端数据库初始化脚本
# 直接使用MySQL客户端连接RDS，避免Python环境问题

set -e

echo "🚀 DCC数字员工系统 - MySQL客户端数据库初始化"
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

# 检查环境变量文件
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    
    # 加载环境变量
    source .env
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        log_error "请确保.env文件中配置了完整的数据库信息"
        exit 1
    fi
    
    log_success "环境变量配置检查通过"
    log_info "数据库配置: $DB_HOST:$DB_PORT/$DB_NAME (用户: $DB_USER)"
}

# 检查MySQL客户端
check_mysql_client() {
    log_info "检查MySQL客户端..."
    
    if command -v mysql &> /dev/null; then
        log_success "MySQL客户端已安装"
        return 0
    fi
    
    log_info "MySQL客户端未安装，使用Docker MySQL客户端..."
    
    # 使用Docker MySQL客户端
    MYSQL_CMD="docker run --rm --network host mysql:8.0 mysql"
    return 1
}

# 测试数据库连接
test_connection() {
    log_info "测试数据库连接..."
    
    if check_mysql_client; then
        # 使用本地MySQL客户端
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT VERSION();" 2>/dev/null
    else
        # 使用Docker MySQL客户端
        docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT VERSION();" 2>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        log_success "数据库连接测试通过"
    else
        log_error "数据库连接测试失败"
        exit 1
    fi
}

# 创建数据库
create_database() {
    log_info "创建数据库..."
    
    if check_mysql_client; then
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    else
        docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        log_success "数据库 $DB_NAME 创建成功"
    else
        log_error "数据库创建失败"
        exit 1
    fi
}

# 创建表结构
create_tables() {
    log_info "创建表结构..."
    
    # SQL文件列表
    sql_files=(
        "backend/database/01_create_tables.sql"
        "backend/database/02_call_tasks.sql"
        "backend/database/03_auto_call_tables.sql"
        "backend/database/04_dcc_leads.sql"
    )
    
    for sql_file in "${sql_files[@]}"; do
        if [ -f "$sql_file" ]; then
            log_info "执行SQL文件: $sql_file"
            
            if check_mysql_client; then
                mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$sql_file" 2>/dev/null
            else
                docker run --rm --network host -v "$(pwd):/data" mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "/data/$sql_file" 2>/dev/null
            fi
            
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
    
    log_success "所有表创建完成"
}

# 验证表创建
verify_tables() {
    log_info "验证表创建..."
    
    if check_mysql_client; then
        tables=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | wc -l)
    else
        tables=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;" 2>/dev/null | wc -l)
    fi
    
    if [ "$tables" -gt 1 ]; then
        log_success "表创建验证通过，共创建 $((tables-1)) 个表"
    else
        log_warning "表创建验证失败，可能没有创建表"
    fi
}

# 主函数
main() {
    echo "开始初始化RDS数据库..."
    echo ""
    
    check_env
    test_connection
    create_database
    create_tables
    verify_tables
    
    echo ""
    log_success "🎉 数据库初始化完成！"
    echo ""
    echo "下一步：运行 ./deploy-server.sh 部署应用"
}

# 错误处理
trap 'log_error "数据库初始化过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"
