#!/bin/bash

# DCC数字员工系统 - 多项目部署脚本
# 用于解决端口冲突问题，支持多项目共存

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
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
    
    print_message "Docker环境检查通过"
}

# 检查端口占用
check_ports() {
    local ports=("3306" "8000" "3000" "80" "443")
    local conflicts=()
    
    for port in "${ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            conflicts+=($port)
        fi
    done
    
    if [ ${#conflicts[@]} -gt 0 ]; then
        print_warning "检测到端口冲突: ${conflicts[*]}"
        print_message "将使用多项目部署配置避免冲突"
        return 1
    else
        print_message "端口检查通过，无冲突"
        return 0
    fi
}

# 创建环境配置文件
setup_env() {
    if [ ! -f .env ]; then
        print_message "创建环境配置文件..."
        cp env.template .env
        print_warning "请编辑 .env 文件，填入实际配置值"
        print_message "特别是以下配置项："
        echo "  - ALIBABA_CLOUD_ACCESS_KEY_ID"
        echo "  - ALIBABA_CLOUD_ACCESS_KEY_SECRET"
        echo "  - DASHSCOPE_API_KEY"
        echo "  - ALIBAILIAN_APP_ID"
        echo ""
        read -p "按回车键继续，或Ctrl+C退出编辑配置..."
    else
        print_message "环境配置文件已存在"
    fi
}

# 选择部署模式
select_deployment_mode() {
    print_header "选择部署模式"
    echo "1. 标准部署（单项目，使用标准端口）"
    echo "2. 多项目部署（避免端口冲突，使用自定义端口）"
    echo "3. 外部数据库部署（使用服务器现有MySQL）"
    echo ""
    
    while true; do
        read -p "请选择部署模式 (1-3): " choice
        case $choice in
            1)
                DEPLOY_MODE="standard"
                COMPOSE_FILE="docker-compose.yml"
                print_message "选择标准部署模式"
                break
                ;;
            2)
                DEPLOY_MODE="multi-project"
                COMPOSE_FILE="docker-compose-multi-project.yml"
                print_message "选择多项目部署模式"
                break
                ;;
            3)
                DEPLOY_MODE="external-db"
                COMPOSE_FILE="docker-compose.yml"
                print_message "选择外部数据库部署模式"
                print_warning "请确保服务器MySQL服务已启动，并创建相应数据库"
                break
                ;;
            *)
                print_error "无效选择，请输入1-3"
                ;;
        esac
    done
}

# 配置外部数据库
setup_external_db() {
    if [ "$DEPLOY_MODE" = "external-db" ]; then
        print_message "配置外部数据库连接..."
        
        read -p "请输入MySQL主机地址 (默认: localhost): " DB_HOST
        DB_HOST=${DB_HOST:-localhost}
        
        read -p "请输入MySQL端口 (默认: 3306): " DB_PORT
        DB_PORT=${DB_PORT:-3306}
        
        read -p "请输入数据库用户名 (默认: root): " DB_USER
        DB_USER=${DB_USER:-root}
        
        read -s -p "请输入数据库密码: " DB_PASSWORD
        echo ""
        
        read -p "请输入数据库名称 (默认: dcc_employee_db): " DB_NAME
        DB_NAME=${DB_NAME:-dcc_employee_db}
        
        # 更新环境变量
        sed -i "s/DB_HOST=mysql/DB_HOST=$DB_HOST/" .env
        sed -i "s/DB_PORT=3306/DB_PORT=$DB_PORT/" .env
        sed -i "s/DB_USER=dcc_user/DB_USER=$DB_USER/" .env
        sed -i "s/DB_PASSWORD=dcc123456/DB_PASSWORD=$DB_PASSWORD/" .env
        sed -i "s/DB_NAME=dcc_employee_db/DB_NAME=$DB_NAME/" .env
        
        print_message "外部数据库配置完成"
    fi
}

# 停止现有服务
stop_existing_services() {
    print_message "停止现有服务..."
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true
    print_message "现有服务已停止"
}

# 构建和启动服务
start_services() {
    print_header "启动服务"
    
    if [ "$DEPLOY_MODE" = "multi-project" ]; then
        print_message "使用多项目配置启动服务..."
        docker-compose -f docker-compose-multi-project.yml up -d --build
    else
        print_message "使用标准配置启动服务..."
        docker-compose -f docker-compose.yml up -d --build
    fi
    
    print_message "服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    print_message "等待服务启动..."
    
    # 等待MySQL就绪
    print_message "等待MySQL服务就绪..."
    timeout 60 bash -c 'until docker exec dcc-mysql mysqladmin ping -h localhost -u root -proot123456 --silent; do sleep 2; done' || {
        print_error "MySQL服务启动超时"
        return 1
    }
    
    # 等待后端服务就绪
    print_message "等待后端服务就绪..."
    timeout 60 bash -c 'until curl -f http://localhost:8000/api/health >/dev/null 2>&1; do sleep 2; done' || {
        print_error "后端服务启动超时"
        return 1
    }
    
    # 等待前端服务就绪
    print_message "等待前端服务就绪..."
    timeout 60 bash -c 'until curl -f http://localhost:3000 >/dev/null 2>&1; do sleep 2; done' || {
        print_error "前端服务启动超时"
        return 1
    }
    
    print_message "所有服务已就绪"
}

# 显示部署信息
show_deployment_info() {
    print_header "部署完成"
    
    if [ "$DEPLOY_MODE" = "multi-project" ]; then
        echo "访问地址："
        echo "  前端应用: http://localhost:8080"
        echo "  后端API: http://localhost:8080/api"
        echo "  API文档: http://localhost:8080/docs"
        echo ""
        echo "服务端口："
        echo "  MySQL: 3307 (外部访问)"
        echo "  后端: 8001 (外部访问)"
        echo "  前端: 3001 (外部访问)"
        echo "  Nginx: 8080 (外部访问)"
    else
        echo "访问地址："
        echo "  前端应用: http://localhost"
        echo "  后端API: http://localhost/api"
        echo "  API文档: http://localhost/docs"
        echo ""
        echo "服务端口："
        echo "  MySQL: 内部访问"
        echo "  后端: 8000 (外部访问)"
        echo "  前端: 3000 (外部访问)"
        echo "  Nginx: 80 (外部访问)"
    fi
    
    echo ""
    echo "管理命令："
    echo "  查看服务状态: docker-compose -f $COMPOSE_FILE ps"
    echo "  查看服务日志: docker-compose -f $COMPOSE_FILE logs -f"
    echo "  停止服务: docker-compose -f $COMPOSE_FILE down"
    echo "  重启服务: docker-compose -f $COMPOSE_FILE restart"
}

# 主函数
main() {
    print_header "DCC数字员工系统部署脚本"
    
    # 检查Docker环境
    check_docker
    
    # 检查端口冲突
    if ! check_ports; then
        print_warning "检测到端口冲突，建议使用多项目部署模式"
    fi
    
    # 设置环境配置
    setup_env
    
    # 选择部署模式
    select_deployment_mode
    
    # 配置外部数据库（如果需要）
    setup_external_db
    
    # 停止现有服务
    stop_existing_services
    
    # 启动服务
    start_services
    
    # 等待服务就绪
    if wait_for_services; then
        show_deployment_info
        print_message "部署成功完成！"
    else
        print_error "服务启动失败，请检查日志"
        docker-compose -f $COMPOSE_FILE logs
        exit 1
    fi
}

# 运行主函数
main "$@"
