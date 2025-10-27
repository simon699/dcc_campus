#!/bin/bash

# DCC数字员工系统 - 用户表organization_id修复脚本
# 为现有用户添加默认的organization_id

set -e

echo "🔧 用户表organization_id修复脚本"
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
cat > fix_users_org_id.sql << 'EOF'
-- 修复用户表organization_id字段
USE dcc_employee_db;

-- 查看当前用户表结构
DESCRIBE users;

-- 查看现有用户数据
SELECT id, username, phone, organization_id, user_role FROM users;

-- 为organization_id为NULL的用户设置默认值
UPDATE users SET organization_id = 'DEFAULT_ORG' WHERE organization_id IS NULL OR organization_id = '';

-- 为user_role为NULL的用户设置默认值（普通用户）
UPDATE users SET user_role = 2 WHERE user_role IS NULL;

-- 查看修复后的用户数据
SELECT id, username, phone, organization_id, user_role FROM users;

-- 显示修复结果
SELECT 'User table organization_id fix completed successfully!' as result;
EOF

log_info "执行用户表organization_id修复..."

# 执行SQL脚本
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < fix_users_org_id.sql

if [ $? -eq 0 ]; then
    log_success "用户表organization_id修复成功"
else
    log_error "用户表organization_id修复失败"
    exit 1
fi

# 清理临时文件
rm -f fix_users_org_id.sql

echo ""
log_success "修复完成！"
echo "================================================"
echo "📝 修复内容："
echo "1. 为organization_id为NULL的用户设置默认值: 'DEFAULT_ORG'"
echo "2. 为user_role为NULL的用户设置默认值: 2 (普通用户)"
echo ""
echo "🎯 现在可以重新尝试用户注册了！"
echo ""
