#!/usr/bin/env python3
"""
测试阿里云ACR访问权限的脚本
"""

import requests
import base64
import json

def test_acr_access(access_key_id, access_key_secret):
    """测试ACR访问权限"""
    
    # 构建认证头
    auth_string = f"{access_key_id}:{access_key_secret}"
    auth_bytes = auth_string.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
    
    headers = {
        'Authorization': f'Basic {auth_b64}',
        'User-Agent': 'GitHub-Actions'
    }
    
    # 测试ACR API
    registry_url = "https://registry.cn-hangzhou.aliyuncs.com/v2/"
    
    try:
        print("正在测试ACR访问权限...")
        response = requests.get(registry_url, headers=headers, timeout=10)
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ ACR访问成功！")
            return True
        elif response.status_code == 401:
            print("❌ 认证失败 - 请检查AccessKey")
            return False
        else:
            print(f"❌ 未知错误: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 连接错误: {e}")
        return False

def test_repository_access(access_key_id, access_key_secret, namespace, repo_name):
    """测试特定仓库的访问权限"""
    
    auth_string = f"{access_key_id}:{access_key_secret}"
    auth_bytes = auth_string.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
    
    headers = {
        'Authorization': f'Basic {auth_b64}',
        'User-Agent': 'GitHub-Actions'
    }
    
    # 测试仓库访问
    repo_url = f"https://registry.cn-hangzhou.aliyuncs.com/v2/{namespace}/{repo_name}/tags/list"
    
    try:
        print(f"正在测试仓库访问: {namespace}/{repo_name}")
        response = requests.get(repo_url, headers=headers, timeout=10)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ 仓库访问成功！")
            return True
        elif response.status_code == 401:
            print("❌ 仓库访问认证失败")
            return False
        elif response.status_code == 404:
            print("❌ 仓库不存在")
            return False
        else:
            print(f"❌ 未知错误: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 连接错误: {e}")
        return False

if __name__ == "__main__":
    print("=== 阿里云ACR访问权限测试 ===")
    print()
    
    # 从环境变量获取AccessKey（安全方式）
    import os
    access_key_id = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
    access_key_secret = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    
    if not access_key_id or not access_key_secret:
        print("❌ 请设置环境变量:")
        print("export ALIBABA_CLOUD_ACCESS_KEY_ID='your_access_key_id'")
        print("export ALIBABA_CLOUD_ACCESS_KEY_SECRET='your_access_key_secret'")
        exit(1)
    
    print(f"AccessKey ID: {access_key_id[:8]}...")
    print(f"AccessKey Secret: {access_key_secret[:8]}...")
    print()
    
    # 测试基本访问
    if test_acr_access(access_key_id, access_key_secret):
        print()
        # 测试特定仓库
        test_repository_access(access_key_id, access_key_secret, "simon699", "frontend")
        test_repository_access(access_key_id, access_key_secret, "simon699", "backend")
    else:
        print("❌ 基本ACR访问失败，请检查AccessKey权限")
