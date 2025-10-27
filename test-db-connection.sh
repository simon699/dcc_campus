#!/bin/bash

# 简单的数据库连接测试脚本

echo "🔍 测试RDS数据库连接..."

# 加载环境变量
source .env

echo "数据库配置:"
echo "  主机: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  用户: $DB_USER"
echo "  数据库: $DB_NAME"

echo ""
echo "测试连接..."

# 测试连接
docker run --rm --network host mysql:8.0 mysql \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" \
    -e "SELECT VERSION();" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ 数据库连接成功！"
else
    echo "❌ 数据库连接失败，请检查："
    echo "  1. RDS密码是否正确"
    echo "  2. RDS安全组是否允许服务器IP访问"
    echo "  3. RDS实例是否正常运行"
fi
