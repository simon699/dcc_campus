#!/bin/bash

# MySQL数据库初始化脚本
# 用于在外部MySQL服务器上创建数据库和用户

set -e

echo "MySQL数据库初始化脚本"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查参数
if [ $# -lt 1 ]; then
    echo -e "${YELLOW}使用方法: $0 <mysql_host> [mysql_port] [mysql_root_password]${NC}"
    echo "示例: $0 your-mysql-server.com 3306 your-root-password"
    exit 1
fi

MYSQL_HOST=$1
MYSQL_PORT=${2:-3306}
MYSQL_ROOT_PASSWORD=${3:-""}
DB_NAME=${DB_NAME:-dcc_employee_db}
DB_USER=${DB_USER:-dcc_user}
DB_PASSWORD=${DB_PASSWORD:-dcc123456}

echo -e "${GREEN}开始初始化MySQL数据库...${NC}"
echo "主机: $MYSQL_HOST"
echo "端口: $MYSQL_PORT"
echo "数据库: $DB_NAME"
echo "用户: $DB_USER"

# 创建数据库和用户的SQL脚本
cat > /tmp/init_mysql.sql << EOF
-- 创建数据库
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';

-- 授权
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示创建的数据库
SHOW DATABASES;

-- 显示用户权限
SHOW GRANTS FOR '$DB_USER'@'%';
EOF

# 执行SQL脚本
if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
    echo "使用root密码连接MySQL..."
    mysql -h $MYSQL_HOST -P $MYSQL_PORT -u root -p$MYSQL_ROOT_PASSWORD < /tmp/init_mysql.sql
else
    echo "使用无密码连接MySQL..."
    mysql -h $MYSQL_HOST -P $MYSQL_PORT -u root < /tmp/init_mysql.sql
fi

# 清理临时文件
rm -f /tmp/init_mysql.sql

echo -e "${GREEN}MySQL数据库初始化完成！${NC}"
echo "数据库连接信息："
echo "  主机: $MYSQL_HOST"
echo "  端口: $MYSQL_PORT"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo "  密码: $DB_PASSWORD"

# 测试连接
echo -e "${GREEN}测试数据库连接...${NC}"
if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
    mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $DB_USER -p$DB_PASSWORD -e "USE $DB_NAME; SELECT 'Connection successful!' as status;"
else
    mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $DB_USER -p$DB_PASSWORD -e "USE $DB_NAME; SELECT 'Connection successful!' as status;"
fi

echo -e "${GREEN}数据库连接测试成功！${NC}"
