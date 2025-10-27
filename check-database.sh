#!/bin/bash

# DCC数字员工系统 - 数据库连接和更新检查脚本
# 检查数据库连接和更新问题

set -e

echo "🔍 数据库连接和更新检查脚本"
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

log_info "数据库连接信息:"
echo "  主机: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo ""

# 检查数据库连接
log_info "检查数据库连接..."
if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1; then
    log_success "✓ 数据库连接正常"
else
    log_error "✗ 数据库连接失败"
    exit 1
fi

# 检查数据库和表
log_info "检查数据库和表..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
USE $DB_NAME;
SHOW TABLES;
"

echo ""
log_info "检查用户表数据..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
USE $DB_NAME;
SELECT '用户表数据:' as table_info;
SELECT id, username, phone, organization_id, user_role, create_time FROM users ORDER BY id DESC LIMIT 5;
"

echo ""
log_info "检查DCC用户表数据..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
USE $DB_NAME;
SELECT 'DCC用户表数据:' as table_info;
SELECT id, user_name, user_org_id, user_status, create_time FROM dcc_user ORDER BY id DESC LIMIT 5;
"

echo ""
log_info "检查表结构..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
USE $DB_NAME;
SELECT '用户表结构:' as table_structure;
DESCRIBE users;
SELECT 'DCC用户表结构:' as table_structure;
DESCRIBE dcc_user;
"

echo ""
log_warning "可能的问题和解决方案："
echo "================================================"
echo "1. 事务未提交："
echo "   - Navicat中确保点击了'提交'按钮"
echo "   - 检查是否有未提交的事务"
echo ""
echo "2. 连接的是不同的数据库："
echo "   - 确认Navicat连接的是正确的数据库: $DB_NAME"
echo "   - 检查连接的主机和端口是否正确"
echo ""
echo "3. 权限问题："
echo "   - 确认数据库用户有UPDATE权限"
echo "   - 检查是否有行级锁"
echo ""
echo "4. 缓存问题："
echo "   - 刷新Navicat数据视图"
echo "   - 重新连接数据库"
echo ""
echo "5. 应用程序缓存："
echo "   - 重启后端服务: sudo supervisorctl restart dcc-backend"
echo "   - 检查应用程序是否有数据缓存"
echo ""

log_info "手动测试数据库更新..."
read -p "是否要测试插入一条测试数据？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "插入测试数据..."
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
    USE $DB_NAME;
    INSERT INTO users (username, password, phone, organization_id, create_time, user_role) 
    VALUES ('test_user_$(date +%s)', 'test_password', '1380000$(date +%s | tail -c 4)', 'TEST_ORG', NOW(), 2);
    SELECT '测试数据插入成功' as result;
    SELECT id, username, phone, organization_id FROM users WHERE username LIKE 'test_user_%' ORDER BY id DESC LIMIT 1;
    "
    
    log_info "删除测试数据..."
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "
    USE $DB_NAME;
    DELETE FROM users WHERE username LIKE 'test_user_%';
    SELECT '测试数据删除成功' as result;
    "
fi

echo ""
log_success "检查完成！"
echo "================================================"
