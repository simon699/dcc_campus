#!/bin/bash

# GitHub Actions 自动部署验证脚本
# 用于测试和验证自动部署是否正常工作

set -e

echo "🔍 GitHub Actions 自动部署验证"
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

# 检查GitHub Actions配置文件
check_workflow_config() {
    log_info "检查GitHub Actions配置..."
    
    if [ ! -f ".github/workflows/deploy.yml" ]; then
        log_error "未找到GitHub Actions配置文件"
        return 1
    fi
    
    log_success "GitHub Actions配置文件存在"
    
    # 检查配置文件内容
    if grep -q "on:" .github/workflows/deploy.yml; then
        log_success "配置文件格式正确"
    else
        log_error "配置文件格式可能有问题"
        return 1
    fi
    
    # 显示触发条件
    log_info "触发条件:"
    grep -A 5 "on:" .github/workflows/deploy.yml | head -6
}

# 检查远程仓库配置
check_remote_config() {
    log_info "检查远程仓库配置..."
    
    local github_remote=$(git remote -v | grep github.com | head -1)
    
    if [ -n "$github_remote" ]; then
        log_success "GitHub远程仓库已配置: $github_remote"
        
        # 提取仓库信息
        local repo_url=$(echo $github_remote | awk '{print $2}')
        local repo_name=$(echo $repo_url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\)\.git.*/\1/')
        
        log_info "仓库名称: $repo_name"
        log_info "GitHub Actions URL: https://github.com/$repo_name/actions"
        
        return 0
    else
        log_error "未找到GitHub远程仓库"
        return 1
    fi
}

# 检查Secrets配置
check_secrets_config() {
    log_info "检查GitHub Secrets配置..."
    
    local repo_url=$(git remote -v | grep github.com | head -1 | awk '{print $2}')
    local repo_name=$(echo $repo_url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\)\.git.*/\1/')
    
    log_warning "请手动检查以下Secrets是否已配置:"
    log_info "仓库地址: https://github.com/$repo_name/settings/secrets/actions"
    log_info "需要配置的Secrets:"
    log_info "  - SERVER_HOST: 服务器IP地址"
    log_info "  - SERVER_USER: 服务器用户名"
    log_info "  - SERVER_SSH_KEY: SSH私钥"
    log_info "  - SERVER_PORT: SSH端口（可选，默认22）"
}

# 创建测试提交
create_test_commit() {
    log_info "创建测试提交..."
    
    # 创建一个测试文件
    echo "# GitHub Actions 测试文件" > test-deploy-$(date +%Y%m%d-%H%M%S).md
    echo "创建时间: $(date)" >> test-deploy-$(date +%Y%m%d-%H%M%S).md
    echo "测试GitHub Actions自动部署功能" >> test-deploy-$(date +%Y%m%d-%H%M%S).md
    
    # 添加到Git
    git add .
    git commit -m "test: GitHub Actions自动部署测试 $(date +%Y%m%d-%H%M%S)"
    
    log_success "测试提交已创建"
}

# 推送测试
push_test() {
    log_info "推送测试提交到GitHub..."
    
    # 获取GitHub远程仓库名称
    local github_remote=$(git remote -v | grep github.com | head -1 | awk '{print $1}')
    
    if [ -z "$github_remote" ]; then
        log_error "未找到GitHub远程仓库"
        return 1
    fi
    
    # 推送到GitHub
    git push $github_remote main
    
    log_success "代码已推送到GitHub"
    
    # 显示Actions页面链接
    local repo_url=$(git remote -v | grep github.com | head -1 | awk '{print $2}')
    local repo_name=$(echo $repo_url | sed 's/.*github.com[:/]\([^/]*\/[^/]*\)\.git.*/\1/')
    
    log_info "请查看GitHub Actions运行状态:"
    log_info "https://github.com/$repo_name/actions"
}

# 检查本地服务状态
check_local_services() {
    log_info "检查本地服务状态..."
    
    # 检查前端服务
    if netstat -tlnp 2>/dev/null | grep -q ":3001 "; then
        log_success "前端服务运行正常 (端口3001)"
    else
        log_warning "前端服务未运行"
    fi
    
    # 检查后端服务
    if netstat -tlnp 2>/dev/null | grep -q ":8000 "; then
        log_success "后端服务运行正常 (端口8000)"
    else
        log_warning "后端服务未运行"
    fi
}

# 显示验证步骤
show_verification_steps() {
    echo ""
    log_info "验证GitHub Actions自动部署的步骤:"
    echo ""
    log_info "1. 检查配置文件:"
    log_info "   - 确认 .github/workflows/deploy.yml 存在"
    log_info "   - 确认触发条件配置正确"
    echo ""
    log_info "2. 检查Secrets配置:"
    log_info "   - 访问GitHub仓库的Settings > Secrets and variables > Actions"
    log_info "   - 确认所有必需的Secrets已配置"
    echo ""
    log_info "3. 推送测试代码:"
    log_info "   - 运行此脚本创建测试提交"
    log_info "   - 推送到GitHub触发Actions"
    echo ""
    log_info "4. 监控Actions运行:"
    log_info "   - 访问GitHub Actions页面"
    log_info "   - 查看workflow运行状态"
    log_info "   - 检查部署日志"
    echo ""
    log_info "5. 验证服务器部署:"
    log_info "   - 检查服务器上的服务状态"
    log_info "   - 访问应用确认更新生效"
}

# 主函数
main() {
    echo "开始验证GitHub Actions自动部署配置..."
    echo ""
    
    # 检查配置
    check_workflow_config
    check_remote_config
    check_secrets_config
    
    echo ""
    log_info "配置检查完成"
    
    # 询问是否创建测试提交
    echo ""
    read -p "是否创建测试提交并推送到GitHub? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_test_commit
        push_test
        
        echo ""
        log_success "测试提交已推送！"
        log_info "请访问GitHub Actions页面查看运行状态"
    else
        log_info "跳过测试提交"
    fi
    
    # 显示验证步骤
    show_verification_steps
    
    # 检查本地服务
    check_local_services
}

# 执行主函数
main "$@"
