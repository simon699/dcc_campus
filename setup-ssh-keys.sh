#!/bin/bash

# SSH密钥生成和配置脚本
# 用于解决GitHub Actions SSH连接问题

set -e

echo "🔑 SSH密钥生成和配置工具"
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

# 生成SSH密钥对
generate_ssh_key() {
    log_info "生成新的SSH密钥对..."
    
    local key_name="github_actions_key"
    local key_path="$HOME/.ssh/$key_name"
    
    # 检查是否已存在
    if [ -f "$key_path" ]; then
        log_warning "密钥文件已存在: $key_path"
        read -p "是否覆盖现有密钥? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "跳过密钥生成"
            return 0
        fi
    fi
    
    # 生成密钥对（无密码）
    ssh-keygen -t rsa -b 4096 -f "$key_path" -N "" -C "github-actions-$(date +%Y%m%d)"
    
    log_success "SSH密钥对生成完成"
    log_info "私钥路径: $key_path"
    log_info "公钥路径: $key_path.pub"
}

# 显示公钥
show_public_key() {
    local key_path="$HOME/.ssh/github_actions_key.pub"
    
    if [ ! -f "$key_path" ]; then
        log_error "公钥文件不存在: $key_path"
        return 1
    fi
    
    echo ""
    log_info "公钥内容（请复制到服务器的authorized_keys）:"
    echo "================================================"
    cat "$key_path"
    echo "================================================"
    echo ""
}

# 显示私钥
show_private_key() {
    local key_path="$HOME/.ssh/github_actions_key"
    
    if [ ! -f "$key_path" ]; then
        log_error "私钥文件不存在: $key_path"
        return 1
    fi
    
    echo ""
    log_info "私钥内容（请复制到GitHub Secrets的SERVER_SSH_KEY）:"
    echo "================================================"
    cat "$key_path"
    echo "================================================"
    echo ""
}

# 配置服务器authorized_keys
configure_server_keys() {
    log_info "配置服务器authorized_keys..."
    
    local key_path="$HOME/.ssh/github_actions_key.pub"
    
    if [ ! -f "$key_path" ]; then
        log_error "公钥文件不存在: $key_path"
        return 1
    fi
    
    echo ""
    log_warning "请手动执行以下步骤配置服务器:"
    echo ""
    log_info "1. SSH连接到您的服务器:"
    log_info "   ssh user@your-server"
    echo ""
    log_info "2. 将以下公钥添加到authorized_keys:"
    echo "----------------------------------------"
    cat "$key_path"
    echo "----------------------------------------"
    echo ""
    log_info "3. 在服务器上执行:"
    log_info "   echo '$(cat $key_path)' >> ~/.ssh/authorized_keys"
    log_info "   chmod 600 ~/.ssh/authorized_keys"
    log_info "   chmod 700 ~/.ssh"
    echo ""
}

# 测试SSH连接
test_ssh_connection() {
    log_info "测试SSH连接..."
    
    echo ""
    read -p "请输入服务器IP地址: " server_host
    read -p "请输入服务器用户名: " server_user
    read -p "请输入SSH端口 (默认22): " server_port
    
    if [ -z "$server_port" ]; then
        server_port=22
    fi
    
    local key_path="$HOME/.ssh/github_actions_key"
    
    if [ ! -f "$key_path" ]; then
        log_error "私钥文件不存在: $key_path"
        return 1
    fi
    
    log_info "测试SSH连接: $server_user@$server_host:$server_port"
    
    if ssh -i "$key_path" -p "$server_port" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$server_user@$server_host" "echo 'SSH连接成功!'"; then
        log_success "SSH连接测试成功！"
        return 0
    else
        log_error "SSH连接测试失败！"
        return 1
    fi
}

# 显示GitHub配置说明
show_github_config() {
    echo ""
    log_info "GitHub Secrets配置说明:"
    echo ""
    log_info "1. 访问GitHub仓库设置:"
    log_info "   https://github.com/simon699/dcc_campus/settings/secrets/actions"
    echo ""
    log_info "2. 添加或更新以下Secrets:"
    echo ""
    log_info "   SERVER_HOST: 您的服务器IP地址"
    log_info "   SERVER_USER: 服务器用户名"
    log_info "   SERVER_SSH_KEY: 私钥的完整内容（包括头部和尾部）"
    log_info "   SERVER_PORT: SSH端口（默认22）"
    echo ""
    log_info "3. 私钥内容示例:"
    log_info "   -----BEGIN OPENSSH PRIVATE KEY-----"
    log_info "   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn"
    log_info "   ..."
    log_info "   -----END OPENSSH PRIVATE KEY-----"
    echo ""
}

# 主菜单
show_menu() {
    echo ""
    log_info "请选择操作:"
    echo "1. 生成新的SSH密钥对"
    echo "2. 显示公钥内容"
    echo "3. 显示私钥内容"
    echo "4. 配置服务器authorized_keys"
    echo "5. 测试SSH连接"
    echo "6. 显示GitHub配置说明"
    echo "7. 退出"
    echo ""
}

# 主函数
main() {
    echo "开始SSH密钥配置..."
    echo ""
    
    while true; do
        show_menu
        read -p "请输入选项 (1-7): " choice
        
        case $choice in
            1)
                generate_ssh_key
                ;;
            2)
                show_public_key
                ;;
            3)
                show_private_key
                ;;
            4)
                configure_server_keys
                ;;
            5)
                test_ssh_connection
                ;;
            6)
                show_github_config
                ;;
            7)
                log_info "退出程序"
                exit 0
                ;;
            *)
                log_error "无效选项，请重新选择"
                ;;
        esac
        
        echo ""
        read -p "按回车键继续..."
    done
}

# 执行主函数
main "$@"
