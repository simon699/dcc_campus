#!/bin/bash

echo "=== 阿里云ACR个人版测试 ==="

# 请替换为您的实际信息
ACR_USERNAME="sfwtaobao@126.com"
ACR_PASSWORD=",Sfw3470699"
ACR_REGISTRY="crpi-6kf9zd5057bjgono.cn-shanghai.personal.cr.aliyuncs.com"

echo "1. 测试Docker登录ACR个人版..."
echo "用户名: ${ACR_USERNAME}"
echo "注册表: ${ACR_REGISTRY}"

# 测试登录
echo "${ACR_PASSWORD}" | docker login ${ACR_REGISTRY} -u ${ACR_USERNAME} --password-stdin

echo ""
echo "2. 如果登录成功，测试推送镜像..."
if docker login ${ACR_REGISTRY} -u ${ACR_USERNAME} --password-stdin <<< "${ACR_PASSWORD}" 2>/dev/null; then
    echo "✅ 登录成功！"
    echo "现在可以推送镜像到: ${ACR_REGISTRY}/simon699/"
else
    echo "❌ 登录失败，请检查："
    echo "1. 用户名是否正确"
    echo "2. 固定密码是否正确"
    echo "3. 注册表地址是否正确"
fi

echo ""
echo "=== GitHub Secrets配置 ==="
echo "需要在GitHub仓库设置中添加以下Secrets："
echo "ACR_USERNAME: ${ACR_USERNAME}"
echo "ACR_PASSWORD: ${ACR_PASSWORD}"
