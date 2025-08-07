#!/bin/bash

# SSL证书配置脚本
# 域名: campus.kongbaijiyi.com

set -e

echo "配置SSL证书..."

# 服务器信息
SERVER_IP="47.103.27.235"
DOMAIN="campus.kongbaijiyi.com"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}开始配置SSL证书...${NC}"

# 连接到服务器并配置SSL
ssh root@${SERVER_IP} << 'EOF'
    set -e
    
    echo "安装Certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
    
    echo "停止Nginx服务..."
    docker-compose -f /opt/dcc-digital-employee/docker-compose.yml stop nginx
    
    echo "获取SSL证书..."
    certbot certonly --standalone -d campus.kongbaijiyi.com --non-interactive --agree-tos --email admin@kongbaijiyi.com
    
    echo "创建SSL目录..."
    mkdir -p /opt/dcc-digital-employee/ssl
    
    echo "复制SSL证书..."
    cp /etc/letsencrypt/live/campus.kongbaijiyi.com/fullchain.pem /opt/dcc-digital-employee/ssl/cert.pem
    cp /etc/letsencrypt/live/campus.kongbaijiyi.com/privkey.pem /opt/dcc-digital-employee/ssl/key.pem
    
    echo "设置证书权限..."
    chmod 644 /opt/dcc-digital-employee/ssl/cert.pem
    chmod 600 /opt/dcc-digital-employee/ssl/key.pem
    
    echo "配置自动续期..."
    echo "0 12 * * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/campus.kongbaijiyi.com/fullchain.pem /opt/dcc-digital-employee/ssl/cert.pem && cp /etc/letsencrypt/live/campus.kongbaijiyi.com/privkey.pem /opt/dcc-digital-employee/ssl/key.pem && docker-compose -f /opt/dcc-digital-employee/docker-compose.yml restart nginx" | crontab -
    
    echo "重新启动Nginx服务..."
    docker-compose -f /opt/dcc-digital-employee/docker-compose.yml up -d nginx
    
    echo "SSL证书配置完成！"
    echo "域名: https://campus.kongbaijiyi.com"
EOF

echo -e "${GREEN}SSL证书配置完成！${NC}"
echo "现在可以通过 https://campus.kongbaijiyi.com 访问应用"
