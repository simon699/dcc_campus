#!/bin/bash

# DCC数字员工系统 - 简化数据库初始化脚本
# 使用预构建镜像避免网络问题

set -e

echo "🚀 DCC数字员工系统 - 简化数据库初始化"
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

# 检查环境变量文件
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    
    # 加载环境变量
    source .env
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        log_error "请确保.env文件中配置了完整的数据库信息"
        exit 1
    fi
    
    log_success "环境变量配置检查通过"
    log_info "数据库配置: $DB_HOST:$DB_PORT/$DB_NAME (用户: $DB_USER)"
}

# 创建数据库初始化Python脚本
create_init_script() {
    log_info "创建数据库初始化脚本..."
    
    cat > init_db.py << 'EOF'
#!/usr/bin/env python3
import pymysql
import os
from pathlib import Path

def main():
    # 从环境变量获取配置
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    DB_NAME = os.getenv('DB_NAME')
    
    print(f"连接数据库: {DB_HOST}:{DB_PORT}")
    
    try:
        # 1. 创建数据库
        print("创建数据库...")
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4'
        )
        
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ 数据库 {DB_NAME} 创建成功")
        
        conn.close()
        
        # 2. 创建表结构
        print("创建表结构...")
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset='utf8mb4'
        )
        
        with conn.cursor() as cursor:
            # SQL文件列表
            sql_files = [
                'backend/database/01_create_tables.sql',
                'backend/database/02_call_tasks.sql', 
                'backend/database/03_auto_call_tables.sql',
                'backend/database/04_dcc_leads.sql'
            ]
            
            for sql_file in sql_files:
                if Path(sql_file).exists():
                    print(f"📄 执行SQL文件: {sql_file}")
                    with open(sql_file, 'r', encoding='utf-8') as f:
                        sql_content = f.read()
                    
                    # 分割并执行SQL语句
                    statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
                    for statement in statements:
                        if statement:
                            cursor.execute(statement)
                    
                    print(f"✅ {sql_file} 执行完成")
                else:
                    print(f"⚠️  SQL文件不存在: {sql_file}")
            
            conn.commit()
            print("✅ 所有表创建完成")
        
        conn.close()
        print("🎉 数据库初始化完成！")
        
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
EOF
    
    log_success "数据库初始化脚本创建完成"
}

# 使用Docker运行初始化脚本
run_init_with_docker() {
    log_info "使用Docker运行数据库初始化..."
    
    # 创建Dockerfile
    cat > Dockerfile.init << 'EOF'
FROM python:3.11-slim

# 安装依赖
RUN pip install pymysql

# 设置工作目录
WORKDIR /app

# 复制文件
COPY .env /app/
COPY init_db.py /app/
COPY backend/database/ /app/backend/database/

# 运行初始化脚本
CMD ["python", "init_db.py"]
EOF
    
    # 构建镜像
    log_info "构建初始化镜像..."
    docker build -f Dockerfile.init -t dcc-init .
    
    # 运行初始化
    log_info "执行数据库初始化..."
    docker run --rm --network host dcc-init
    
    if [ $? -eq 0 ]; then
        log_success "数据库初始化完成"
    else
        log_error "数据库初始化失败"
        exit 1
    fi
    
    # 清理临时文件
    rm -f Dockerfile.init init_db.py
}

# 主函数
main() {
    echo "开始初始化RDS数据库..."
    echo ""
    
    check_env
    create_init_script
    run_init_with_docker
    
    echo ""
    log_success "🎉 数据库初始化完成！"
    echo ""
    echo "下一步：运行 ./deploy-server.sh 部署应用"
}

# 错误处理
trap 'log_error "数据库初始化过程中发生错误"; exit 1' ERR

# 执行主函数
main "$@"
