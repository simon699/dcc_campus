#!/bin/bash

# Docker登录测试脚本
echo "=== 测试Docker登录阿里云ACR ==="

# 请将以下值替换为您的实际AccessKey
ACCESS_KEY_ID="your_access_key_id"
ACCESS_KEY_SECRET="your_access_key_secret"

echo "正在测试Docker登录..."
echo "AccessKey ID: ${ACCESS_KEY_ID:0:8}..."
echo "AccessKey Secret: ${ACCESS_KEY_SECRET:0:8}..."

# 测试登录
echo "docker login registry.cn-hangzhou.aliyuncs.com -u $ACCESS_KEY_ID -p $ACCESS_KEY_SECRET"

# 实际执行登录（取消注释以执行）
# docker login registry.cn-hangzhou.aliyuncs.com -u $ACCESS_KEY_ID -p $ACCESS_KEY_SECRET

echo ""
echo "如果登录成功，说明AccessKey正确"
echo "如果登录失败，请检查："
echo "1. AccessKey是否正确"
echo "2. AccessKey是否有ACR权限"
echo "3. 是否使用了正确的用户AccessKey"
