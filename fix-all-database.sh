#!/bin/bash

# DCC数字员工系统 - 综合数据库修复脚本
# 修复所有数据库字段问题

set -e

echo "🔧 综合数据库修复脚本"
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

# 创建综合修复SQL脚本
cat > fix_all_database_issues.sql << 'EOF'
-- 综合数据库修复脚本
USE dcc_employee_db;

-- 1. 修复DCC用户表字段长度
ALTER TABLE dcc_user MODIFY COLUMN user_password VARCHAR(255) NOT NULL COMMENT '用户密码';
ALTER TABLE dcc_user MODIFY COLUMN user_name VARCHAR(100) NOT NULL COMMENT '用户名称';
ALTER TABLE dcc_user MODIFY COLUMN user_org_id VARCHAR(100) NOT NULL COMMENT '用户组织ID';

-- 2. 修复用户表organization_id字段
-- 为organization_id为NULL的用户设置默认值
UPDATE users SET organization_id = 'DEFAULT_ORG' WHERE organization_id IS NULL OR organization_id = '';

-- 为user_role为NULL的用户设置默认值（普通用户）
UPDATE users SET user_role = 2 WHERE user_role IS NULL;

-- 3. 修改表结构，添加默认值
ALTER TABLE users MODIFY COLUMN organization_id VARCHAR(20) NOT NULL DEFAULT 'DEFAULT_ORG';
ALTER TABLE users MODIFY COLUMN user_role INT NOT NULL DEFAULT 2;

-- 4. 查看修复结果
SELECT 'DCC用户表结构:' as table_name;
DESCRIBE dcc_user;

SELECT '用户表结构:' as table_name;
DESCRIBE users;

SELECT '用户数据:' as data_info;
SELECT id, username, phone, organization_id, user_role FROM users;

SELECT 'DCC用户数据:' as data_info;
SELECT id, user_name, user_org_id, user_status FROM dcc_user;

-- 5. 显示修复完成信息
SELECT 'All database issues have been fixed successfully!' as result;
EOF

log_info "执行综合数据库修复..."

# 执行SQL脚本
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" < fix_all_database_issues.sql

if [ $? -eq 0 ]; then
    log_success "综合数据库修复成功"
else
    log_error "综合数据库修复失败"
    exit 1
fi

# 清理临时文件
rm -f fix_all_database_issues.sql

echo ""
log_success "修复完成！"
echo "================================================"
echo "📝 修复内容："
echo "1. DCC用户表字段长度扩展："
echo "   - user_password: VARCHAR(50) → VARCHAR(255)"
echo "   - user_name: VARCHAR(50) → VARCHAR(100)"
echo "   - user_org_id: VARCHAR(50) → VARCHAR(100)"
echo ""
echo "2. 用户表字段修复："
echo "   - organization_id: 添加默认值 'DEFAULT_ORG'"
echo "   - user_role: 添加默认值 2 (普通用户)"
echo "   - 为现有NULL值设置默认值"
echo ""
echo "🎯 现在可以正常使用以下API了："
echo "   - POST /api/register (用户注册)"
echo "   - POST /api/dcc/user/create (DCC用户创建)"
echo ""
