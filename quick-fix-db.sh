#!/bin/bash

# DCC数字员工系统 - 快速数据库修复命令
# 手动执行数据库字段修复

echo "🔧 快速数据库字段修复"
echo "================================================"

# 加载环境变量
source .env

echo "执行以下SQL命令修复数据库字段："
echo ""
echo "mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME"
echo ""
echo "然后在MySQL命令行中执行："
echo ""
echo "ALTER TABLE dcc_user MODIFY COLUMN user_password VARCHAR(255) NOT NULL COMMENT '用户密码';"
echo "ALTER TABLE dcc_user MODIFY COLUMN user_name VARCHAR(100) NOT NULL COMMENT '用户名称';"
echo "ALTER TABLE dcc_user MODIFY COLUMN user_org_id VARCHAR(100) NOT NULL COMMENT '用户组织ID';"
echo "DESCRIBE dcc_user;"
echo "exit;"
echo ""
echo "或者直接运行修复脚本："
echo "./fix-database-fields.sh"
echo ""
