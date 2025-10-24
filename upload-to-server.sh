#!/bin/bash

# 上传文件到服务器并执行重新构建脚本

set -e

# 服务器配置
SERVER_IP="47.103.27.235"
SERVER_PATH="/opt/dcc_campus"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header "DCC数字员工系统 - 上传并重新构建"

# 检查SSH连接
check_ssh_connection() {
    print_message "检查服务器连接..."
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes root@$SERVER_IP "echo 'SSH连接正常'" 2>/dev/null; then
        print_error "无法连接到服务器 $SERVER_IP"
        print_message "请确保："
        echo "  1. 服务器IP地址正确"
        echo "  2. SSH密钥已配置"
        echo "  3. 服务器防火墙允许SSH连接"
        echo ""
        print_message "将显示手动上传步骤..."
        return 1
    fi
    print_message "服务器连接正常"
    return 0
}

# 上传文件到服务器
upload_files() {
    print_message "上传文件到服务器..."
    
    # 创建临时目录
    TEMP_DIR="/tmp/dcc-rebuild-$(date +%s)"
    
    # 打包当前代码
    print_message "打包当前代码..."
    tar -czf dcc-rebuild.tar.gz \
        --exclude=node_modules \
        --exclude=venv \
        --exclude=.git \
        --exclude=__pycache__ \
        --exclude=*.pyc \
        --exclude=.env \
        --exclude=backup-*.tar.gz \
        --exclude=dcc-*.tar.gz \
        .
    
    # 上传代码到服务器
    print_message "上传代码到服务器..."
    scp dcc-rebuild.tar.gz root@$SERVER_IP:$TEMP_DIR/
    
    # 上传重新构建脚本
    print_message "上传重新构建脚本..."
    scp rebuild-images.sh root@$SERVER_IP:$TEMP_DIR/
    
    # 在服务器上解压代码并执行脚本
    print_message "在服务器上解压代码并执行重新构建..."
    ssh root@$SERVER_IP "
        mkdir -p $TEMP_DIR
        cd $SERVER_PATH
        tar -xzf $TEMP_DIR/dcc-rebuild.tar.gz
        chmod +x rebuild-images.sh
        rm -f $TEMP_DIR/dcc-rebuild.tar.gz
        echo '开始执行重新构建脚本...'
        ./rebuild-images.sh
    "
    
    # 清理本地临时文件
    rm -f dcc-rebuild.tar.gz
    print_message "上传和重新构建完成"
}

# 显示手动上传步骤
show_manual_upload() {
    print_header "手动上传步骤"
    
    echo "由于SSH连接问题，请按以下步骤手动上传："
    echo ""
    echo "1. 在本地打包代码："
    echo "   tar -czf dcc-rebuild.tar.gz --exclude=node_modules --exclude=venv --exclude=.git ."
    echo ""
    echo "2. 上传文件到服务器："
    echo "   scp dcc-rebuild.tar.gz root@$SERVER_IP:$SERVER_PATH/"
    echo "   scp rebuild-images.sh root@$SERVER_IP:$SERVER_PATH/"
    echo ""
    echo "3. SSH登录服务器："
    echo "   ssh root@$SERVER_IP"
    echo ""
    echo "4. 在服务器上执行："
    echo "   cd $SERVER_PATH"
    echo "   tar -xzf dcc-rebuild.tar.gz"
    echo "   chmod +x rebuild-images.sh"
    echo "   ./rebuild-images.sh"
    echo ""
    echo "5. 清理临时文件："
    echo "   rm -f dcc-rebuild.tar.gz"
}

# 主函数
main() {
    # 检查SSH连接
    if check_ssh_connection; then
        # 上传文件并执行重新构建
        upload_files
    else
        # 显示手动上传步骤
        show_manual_upload
    fi
    
    print_message "脚本执行完成！"
}

# 运行主函数
main "$@"
