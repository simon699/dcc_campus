#!/bin/bash

# DCC数字员工系统 - SQL文件执行测试脚本
# 用于测试SQL文件是否能正确执行

set -e

echo "🧪 SQL文件执行测试"
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

# 检查环境变量
if [ ! -f ".env" ]; then
    log_error "未找到.env文件，请先配置环境变量"
    exit 1
fi

# 加载环境变量
source .env

# 检查SQL文件
sql_files=(
    "backend/database/01_create_tables.sql"
    "backend/database/02_call_tasks.sql"
    "backend/database/03_auto_call_tables.sql"
    "backend/database/04_dcc_leads.sql"
)

log_info "检查SQL文件是否存在..."
for sql_file in "${sql_files[@]}"; do
    if [ -f "$sql_file" ]; then
        log_success "✓ $sql_file 存在"
    else
        log_error "✗ $sql_file 不存在"
        exit 1
    fi
done

log_info "测试SQL文件执行..."
for sql_file in "${sql_files[@]}"; do
    log_info "测试执行: $sql_file"
    
    # 使用cat命令将SQL文件内容传递给mysql命令
    if cat "$sql_file" | docker run --rm --network host -i mysql:8.0 mysql \
        -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null; then
        log_success "✓ $sql_file 执行成功"
    else
        log_error "✗ $sql_file 执行失败"
        exit 1
    fi
done

log_success "所有SQL文件测试通过！"
echo "================================================"
