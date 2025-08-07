#!/bin/bash

# ACR部署配置脚本
# 用于快速配置阿里云ACR控制台自动构建

echo "=== DCC数字员工系统 - ACR部署配置 ==="
echo ""

# 检查是否在项目根目录
if [ ! -f "Dockerfile" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "✅ 检测到Dockerfile，开始配置ACR部署..."
echo ""

# 显示配置信息
echo "📋 ACR控制台配置信息："
echo "----------------------------------------"
echo "代码仓库: https://github.com/simon699/dcc_campus.git"
echo "分支: main"
echo "构建目录: /"
echo "Dockerfile路径: Dockerfile"
echo "镜像标签: V1.0"
echo "----------------------------------------"
echo ""

# 显示必需的环境变量
echo "🔧 必需的环境变量配置："
echo "----------------------------------------"
cat << 'EOF'
DB_PASSWORD=your_database_password
JWT_SECRET_KEY=your_jwt_secret_key
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
INSTANCE_ID=your_instance_id
DASHSCOPE_API_KEY=your_dashscope_api_key
ALIBAILIAN_APP_ID=your_alibailian_app_id
EXTERNAL_API_TOKEN=your_external_api_token
EOF
echo "----------------------------------------"
echo ""

# 显示可选的环境变量
echo "🔧 可选的环境变量配置："
echo "----------------------------------------"
cat << 'EOF'
ENVIRONMENT=production
DEBUG=False
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=dcc_user
DB_NAME=dcc_employee_db
JWT_EXPIRE_HOURS=24
SCENE_ID_API_URL=https://your-api.com/get-scene-id
API_TIMEOUT=30
EOF
echo "----------------------------------------"
echo ""

# 检查项目文件
echo "📁 检查项目文件结构..."
if [ -d "backend" ]; then
    echo "✅ backend目录存在"
else
    echo "❌ backend目录不存在"
fi

if [ -f "backend/requirements.txt" ]; then
    echo "✅ requirements.txt存在"
else
    echo "❌ requirements.txt不存在"
fi

if [ -f "backend/main.py" ]; then
    echo "✅ main.py存在"
else
    echo "❌ main.py不存在"
fi

if [ -d "dcc-digital-employee" ]; then
    echo "✅ 前端项目目录存在"
else
    echo "❌ 前端项目目录不存在"
fi

echo ""

# 显示部署步骤
echo "🚀 部署步骤："
echo "1. 登录阿里云ACR控制台"
echo "2. 选择您的命名空间和镜像仓库"
echo "3. 配置自动构建规则（使用上述信息）"
echo "4. 设置环境变量"
echo "5. 点击'立即构建'"
echo "6. 等待构建完成"
echo "7. 使用Docker Compose部署到ECS"
echo ""

# 显示验证命令
echo "🔍 部署验证命令："
echo "----------------------------------------"
echo "# 检查容器状态"
echo "docker ps"
echo ""
echo "# 查看应用日志"
echo "docker logs dcc_backend"
echo ""
echo "# 健康检查"
echo "curl http://your-server-ip:8000/health"
echo ""
echo "# API测试"
echo "curl -X POST http://your-server-ip:8000/api/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"username\":\"admin\",\"password\":\"admin\"}'"
echo "----------------------------------------"
echo ""

echo "✅ 配置完成！请按照上述步骤在ACR控制台进行部署。"
echo ""
echo "💡 提示：如果遇到网络问题，推荐使用ACR控制台自动构建，"
echo "   这样可以避免本地网络限制。"
