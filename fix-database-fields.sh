#!/bin/bash

# DCC数字员工系统 - 数据库字段修复脚本
# 修复user_password字段长度问题

set -e

echo "🔧 数据库字段修复脚本"
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

log_info "连接数据库: $DB_HOST:$DB_PORT/$DB_NAME"

# 创建修复SQL脚本
cat > fix_password_field.sql << 'EOF'
-- 修复DCC用户表密码字段长度
USE dcc_employee_db;

-- 查看当前表结构
DESCRIBE dcc_user;

-- 修改user_password字段长度为255
ALTER TABLE dcc_user MODIFY COLUMN user_password VARCHAR(255) NOT NULL COMMENT '用户密码';

-- 修改user_name字段长度为100
ALTER TABLE dcc_user MODIFY COLUMN user_name VARCHAR(100) NOT NULL COMMENT '用户名称';

-- 修改user_org_id字段长度为100
ALTER TABLE dcc_user MODIFY COLUMN user_org_id VARCHAR(100) NOT NULL COMMENT '用户组织ID';

-- 查看修改后的表结构
DESCRIBE dcc_user;

-- 显示修改结果
SELECT 'Database field modification completed successfully!' as result;
EOF

log_info "执行数据库字段修复..."

# 执行SQL脚本
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < fix_password_field.sql

if [ $? -eq 0 ]; then
    log_success "数据库字段修复成功"
else
    log_error "数据库字段修复失败"
    exit 1
fi

# 清理临时文件
rm -f fix_password_field.sql

echo ""
log_success "修复完成！"
echo "================================================"
echo "📝 修复内容："
echo "1. user_password 字段长度: VARCHAR(50) → VARCHAR(255)"
echo "2. user_name 字段长度: VARCHAR(50) → VARCHAR(100)"
echo "3. user_org_id 字段长度: VARCHAR(50) → VARCHAR(100)"
echo ""
echo "🎯 现在可以重新尝试注册用户了！"
echo ""
