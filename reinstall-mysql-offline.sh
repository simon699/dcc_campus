#!/bin/bash

# MySQL离线重新安装脚本
# 适用于网络连接问题的情况

set -e

echo "=========================================="
echo "MySQL离线重新安装脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker环境
if ! command -v docker &> /dev/null; then
    print_error "Docker未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose未安装"
    exit 1
fi

print_info "Docker环境检查完成"

# 停止现有服务
print_info "停止现有MySQL服务..."
docker stop dcc-mysql 2>/dev/null || true
docker rm dcc-mysql 2>/dev/null || true

# 检查本地MySQL镜像
print_info "检查本地MySQL镜像..."
if docker images | grep -q mysql; then
    print_info "发现本地MySQL镜像："
    docker images | grep mysql
else
    print_error "没有找到本地MySQL镜像"
    print_info "请先手动拉取MySQL镜像："
    print_info "docker pull mysql:5.7"
    print_info "或者"
    print_info "docker pull mysql:8.0"
    exit 1
fi

# 停止所有相关服务
print_info "停止所有相关服务..."
docker-compose -f docker-compose.yml down 2>/dev/null || true
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || true

# 询问是否删除数据
read -p "是否删除现有MySQL数据？这将删除所有数据库数据 (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "删除MySQL数据卷..."
    docker volume rm dcc-mysql-data 2>/dev/null || true
    print_warning "MySQL数据已删除"
else
    print_info "保留现有MySQL数据"
fi

# 重新启动MySQL服务
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
sleep 15

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
        sleep 3
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "MySQL连接测试失败"
    print_info "MySQL容器日志："
    docker logs dcc-mysql
    exit 1
fi

# 验证数据库
print_info "验证数据库..."
docker exec dcc-mysql mysql -u root -proot123456 -e "
USE dcc_employee_db;
SHOW TABLES;
SELECT 'Database verified successfully' as status;
" 2>/dev/null || {
    print_warning "数据库验证失败，但MySQL服务已启动"
}

# 显示服务信息
print_info "MySQL服务信息："
echo "  容器名称: dcc-mysql"
echo "  数据库: dcc_employee_db"
echo "  用户名: dcc_user"
echo "  密码: ,,Dcc123456"
echo "  端口: 3306 (容器内部)"

# 询问是否启动所有服务
read -p "是否启动所有相关服务? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "启动所有服务..."
    if [ -f "docker-compose-multi-project.yml" ]; then
        docker-compose -f docker-compose-multi-project.yml up -d
    else
        docker-compose -f docker-compose.yml up -d
    fi
    
    print_info "所有服务启动完成！"
fi

print_info "MySQL离线重新安装完成！"
echo "=========================================="
