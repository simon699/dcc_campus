#!/bin/bash

# DCC数字员工系统 - 数据库初始化脚本（Docker版本）
# 使用Docker容器来避免Python环境管理问题

set -e

echo "🚀 DCC数字员工系统 - 数据库初始化（Docker版本）"
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

# 测试数据库连接
test_connection() {
    log_info "测试数据库连接..."
    
    docker run --rm \
        --network host \
        python:3.11-slim \
        bash -c "
            pip install pymysql python-dotenv >/dev/null 2>&1
            python -c \"
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

try:
    connection = pymysql.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        charset='utf8mb4'
    )
    
    with connection.cursor() as cursor:
        cursor.execute('SELECT VERSION()')
        version = cursor.fetchone()
        print(f'✅ 数据库连接成功，版本: {version[0]}')
    
    connection.close()
except Exception as e:
    print(f'❌ 数据库连接失败: {e}')
    exit(1)
\"
        "
    
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
    
    docker run --rm \
        --network host \
        -v $(pwd):/app \
        -w /app \
        python:3.11-slim \
        bash -c "
            pip install pymysql python-dotenv >/dev/null 2>&1
            python -c \"
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # 连接到MySQL服务器（不指定数据库）
    connection = pymysql.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        charset='utf8mb4'
    )
    
    with connection.cursor() as cursor:
        # 创建数据库
        db_name = os.getenv('DB_NAME')
        cursor.execute(f'CREATE DATABASE IF NOT EXISTS {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
        print(f'✅ 数据库 {db_name} 创建成功')
    
    connection.close()
except Exception as e:
    print(f'❌ 创建数据库失败: {e}')
    exit(1)
\"
        "
    
    if [ $? -eq 0 ]; then
        log_success "数据库创建完成"
    else
        log_error "数据库创建失败"
        exit 1
    fi
}

# 创建表结构
create_tables() {
    log_info "创建表结构..."
    
    docker run --rm \
        --network host \
        -v $(pwd):/app \
        -w /app \
        python:3.11-slim \
        bash -c "
            pip install pymysql python-dotenv >/dev/null 2>&1
            python -c \"
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # 连接到指定数据库
    connection = pymysql.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME'),
        charset='utf8mb4'
    )
    
    with connection.cursor() as cursor:
        # 读取并执行SQL文件
        sql_files = [
            'backend/database/01_create_tables.sql',
            'backend/database/02_call_tasks.sql', 
            'backend/database/03_auto_call_tables.sql',
            'backend/database/04_dcc_leads.sql'
        ]
        
        for sql_file in sql_files:
            if os.path.exists(sql_file):
                print(f'📄 执行SQL文件: {sql_file}')
                with open(sql_file, 'r', encoding='utf-8') as f:
                    sql_content = f.read()
                    
                # 分割SQL语句并执行
                sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
                for statement in sql_statements:
                    if statement:
                        cursor.execute(statement)
                
                print(f'✅ {sql_file} 执行完成')
            else:
                print(f'⚠️  SQL文件不存在: {sql_file}')
        
        connection.commit()
        print('✅ 所有表创建完成')
    
    connection.close()
except Exception as e:
    print(f'❌ 创建表失败: {e}')
    exit(1)
\"
        "
    
    if [ $? -eq 0 ]; then
        log_success "表结构创建完成"
    else
        log_error "表结构创建失败"
        exit 1
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
    
    echo ""
    log_success "🎉 数据库初始化完成！"
    echo ""
    echo "下一步：运行 ./deploy-server.sh 部署应用"
}

# 错误处理
trap 'log_error "数据库初始化过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"
