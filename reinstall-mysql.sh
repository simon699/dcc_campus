#!/bin/bash

# MySQL重新安装脚本
# 服务器: 47.103.27.235
# 用户名: dcc_user
# 密码: ,,Dcc123456

set -e  # 遇到错误立即退出

echo "=========================================="
echo "开始重新安装MySQL镜像"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    print_error "Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

print_info "Docker环境检查完成"

# 检查网络连接
print_info "检查网络连接..."
if ping -c 3 docker.io > /dev/null 2>&1; then
    print_info "网络连接正常"
else
    print_warning "网络连接可能有问题，将使用镜像源"
fi

# 停止并删除现有的MySQL容器
print_info "停止现有的MySQL容器..."
docker stop dcc-mysql 2>/dev/null || true
docker rm dcc-mysql 2>/dev/null || true

# 删除MySQL镜像
print_info "删除现有的MySQL镜像..."
docker rmi mysql:8.0 2>/dev/null || true
docker rmi mysql:5.7 2>/dev/null || true

# 清理Docker系统
print_info "清理Docker系统..."
docker system prune -f

# 配置Docker镜像源（针对中国大陆网络优化）
print_info "配置Docker镜像源..."
if [ ! -f /etc/docker/daemon.json ]; then
    sudo mkdir -p /etc/docker
    sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
        "https://docker.1ms.run",
    "https://g0qd096q.mirror.aliyuncs.com",
    "https://docker-0.unsee.tech",
    "https://docker.xuanyuan.me",
    "https://mirror.ccs.tencentyun.com"
  ],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    print_info "Docker镜像源配置完成，重启Docker服务..."
    sudo systemctl restart docker
    sleep 5
fi

# 拉取MySQL镜像（带重试机制）
pull_mysql_image() {
    local image=$1
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        print_info "拉取 $image 镜像 (尝试 $attempt/$max_attempts)..."
        if docker pull $image; then
            print_info "$image 镜像拉取成功"
            return 0
        else
            print_warning "$image 镜像拉取失败，重试 $attempt/$max_attempts"
            sleep 5
            ((attempt++))
        fi
    done
    
    print_error "$image 镜像拉取失败，请检查网络连接"
    return 1
}

# 拉取MySQL镜像
if ! pull_mysql_image "mysql:8.0"; then
    print_warning "MySQL 8.0镜像拉取失败，尝试使用MySQL 5.7..."
    if ! pull_mysql_image "mysql:5.7"; then
        print_error "所有MySQL镜像拉取失败"
        print_info "请尝试以下解决方案："
        print_info "1. 检查网络连接"
        print_info "2. 手动拉取镜像: docker pull mysql:5.7"
        print_info "3. 或者使用本地已有镜像"
        
        # 检查是否有本地MySQL镜像
        if docker images | grep -q mysql; then
            print_info "发现本地MySQL镜像，将使用本地镜像"
            docker images | grep mysql
        else
            print_error "没有可用的MySQL镜像，脚本退出"
            exit 1
        fi
    fi
else
    pull_mysql_image "mysql:5.7"
fi

# 停止所有相关服务
print_info "停止所有相关服务..."
docker-compose -f docker-compose.yml down 2>/dev/null || true
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || true

# 删除MySQL数据卷（可选，如果需要完全重新开始）
read -p "是否删除现有MySQL数据？这将删除所有数据库数据 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "删除MySQL数据卷..."
    docker volume rm dcc-mysql-data 2>/dev/null || true
    print_warning "MySQL数据已删除"
else
    print_info "保留现有MySQL数据"
fi

# 重新启动服务
print_info "重新启动MySQL服务..."

# 检查使用哪个compose文件
if [ -f "docker-compose-multi-project.yml" ]; then
    print_info "使用多项目配置文件启动服务..."
    docker-compose -f docker-compose-multi-project.yml up -d mysql
else
    print_info "使用默认配置文件启动服务..."
    docker-compose -f docker-compose.yml up -d mysql
fi

# 等待MySQL启动
print_info "等待MySQL服务启动..."
sleep 10

# 检查MySQL容器状态
print_info "检查MySQL容器状态..."
if docker ps | grep -q dcc-mysql; then
    print_info "MySQL容器运行正常"
else
    print_error "MySQL容器启动失败"
    docker logs dcc-mysql
    exit 1
fi

# 测试MySQL连接
print_info "测试MySQL连接..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec dcc-mysql mysqladmin ping -h localhost -u root -proot123456 &>/dev/null; then
        print_info "MySQL连接测试成功"
        break
    else
        print_warning "MySQL连接测试失败，重试 $attempt/$max_attempts"
        sleep 2
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "MySQL连接测试失败，请检查日志"
    docker logs dcc-mysql
    exit 1
fi

# 验证数据库和用户
print_info "验证数据库和用户..."
docker exec dcc-mysql mysql -u root -proot123456 -e "
USE dcc_employee_db;
SHOW TABLES;
SELECT 'Database and tables verified successfully' as status;
"

# 显示MySQL连接信息
print_info "MySQL服务信息："
echo "  容器名称: dcc-mysql"
echo "  数据库: dcc_employee_db"
echo "  用户名: dcc_user"
echo "  密码: ,,Dcc123456"
echo "  端口: 3306 (容器内部)"
if docker ps --format "table {{.Names}}\t{{.Ports}}" | grep dcc-mysql | grep -q ":3307"; then
    echo "  外部端口: 3307"
fi

print_info "MySQL重新安装完成！"

# 询问是否启动所有服务
read -p "是否启动所有相关服务 (后端、前端、Nginx)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "启动所有服务..."
    if [ -f "docker-compose-multi-project.yml" ]; then
        docker-compose -f docker-compose-multi-project.yml up -d
    else
        docker-compose -f docker-compose.yml up -d
    fi
    
    print_info "所有服务启动完成！"
    print_info "服务状态："
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo "=========================================="
echo "MySQL重新安装脚本执行完成"
echo "=========================================="
