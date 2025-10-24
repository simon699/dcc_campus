#!/bin/bash

# DCC数字员工系统 - 本地Docker部署脚本
# 适用于本地开发和测试环境

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    print_success "Docker环境检查通过"
}

# 检查环境变量文件
check_env_file() {
    if [ ! -f ".env" ]; then
        print_warning ".env文件不存在，正在从模板创建..."
        if [ -f "env.template" ]; then
            cp env.template .env
            print_success "已创建.env文件，请根据需要修改配置"
        else
            print_error "env.template文件不存在"
            exit 1
        fi
    else
        print_success ".env文件存在"
    fi
}

# 停止并删除现有容器
cleanup_containers() {
    print_info "正在停止并删除现有容器..."
    
    # 停止所有相关容器
    docker-compose -f docker-compose-fast.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    
    # 删除相关容器
    docker rm -f dcc-mysql dcc-backend dcc-frontend dcc-nginx 2>/dev/null || true
    
    # 删除相关网络
    docker network rm dcc-network 2>/dev/null || true
    
    print_success "容器清理完成"
}

# 清理Docker资源
cleanup_docker() {
    print_info "正在清理Docker资源..."
    
    # 清理未使用的镜像
    docker image prune -f
    
    # 清理未使用的卷（可选，谨慎使用）
    read -p "是否删除未使用的Docker卷？这可能会删除其他项目的数据 (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
        print_success "Docker卷清理完成"
    else
        print_info "跳过Docker卷清理"
    fi
}

# 构建并启动服务
start_services() {
    print_info "正在构建并启动服务..."
    
    # 使用快速构建配置
    docker-compose -f docker-compose-fast.yml up --build -d
    
    print_success "服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    print_info "等待服务启动..."
    
    # 等待MySQL就绪
    print_info "等待MySQL服务启动..."
    timeout 60 bash -c 'until docker exec dcc-mysql mysqladmin ping -h localhost -u root -proot123456 --silent; do sleep 2; done'
    print_success "MySQL服务已就绪"
    
    # 等待后端服务就绪
    print_info "等待后端服务启动..."
    timeout 60 bash -c 'until curl -f http://localhost:8001/api/health >/dev/null 2>&1; do sleep 3; done'
    print_success "后端服务已就绪"
    
    # 等待前端服务就绪
    print_info "等待前端服务启动..."
    timeout 60 bash -c 'until curl -f http://localhost:3001 >/dev/null 2>&1; do sleep 3; done'
    print_success "前端服务已就绪"
    
    # 等待Nginx服务就绪
    print_info "等待Nginx服务启动..."
    timeout 30 bash -c 'until curl -f http://localhost >/dev/null 2>&1; do sleep 2; done'
    print_success "Nginx服务已就绪"
}

# 显示服务状态
show_status() {
    print_info "服务状态："
    echo "=================="
    docker-compose -f docker-compose-fast.yml ps
    
    echo ""
    print_info "访问地址："
    echo "=================="
    echo "前端应用: http://localhost"
    echo "后端API: http://localhost/api"
    echo "API文档: http://localhost/docs"
    echo "ReDoc文档: http://localhost/redoc"
    echo ""
    echo "直接访问端口："
    echo "前端: http://localhost:3001"
    echo "后端: http://localhost:8001"
    echo "MySQL: localhost:3307 (用户名: dcc_user, 密码: ,Dcc123456)"
}

# 显示日志
show_logs() {
    print_info "显示服务日志 (按Ctrl+C退出):"
    docker-compose -f docker-compose-fast.yml logs -f
}

# 主函数
main() {
    echo "=========================================="
    echo "DCC数字员工系统 - 本地Docker部署"
    echo "=========================================="
    
    # 检查Docker环境
    check_docker
    
    # 检查环境变量文件
    check_env_file
    
    # 清理现有容器
    cleanup_containers
    
    # 询问是否清理Docker资源
    read -p "是否清理未使用的Docker资源？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_docker
    fi
    
    # 启动服务
    start_services
    
    # 等待服务就绪
    wait_for_services
    
    # 显示状态
    show_status
    
    echo ""
    print_success "部署完成！"
    echo ""
    echo "常用命令："
    echo "查看日志: docker-compose -f docker-compose-fast.yml logs -f"
    echo "停止服务: docker-compose -f docker-compose-fast.yml down"
    echo "重启服务: docker-compose -f docker-compose-fast.yml restart"
    echo "进入容器: docker exec -it <容器名> /bin/bash"
    echo ""
    
    # 询问是否查看日志
    read -p "是否查看服务日志？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_logs
    fi
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
