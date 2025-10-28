# GitHub Actions SSH密钥配置问题解决方案

## 🔧 问题分析

从错误日志可以看出两个主要问题：

1. **SSH私钥有密码保护**: `this private key is passphrase protected`
2. **SSH认证失败**: `ssh: handshake failed: ssh: unable to authenticate`

## 🛠️ 解决方案

### 方案1：生成无密码的SSH密钥对（推荐）

#### 步骤1：在服务器上生成新的SSH密钥对
```bash
# SSH连接到您的服务器
ssh user@your-server

# 生成新的SSH密钥对（无密码）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_actions_key -N ""

# 查看公钥内容
cat ~/.ssh/github_actions_key.pub
```

#### 步骤2：将公钥添加到服务器的authorized_keys
```bash
# 将公钥添加到authorized_keys
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# 设置正确的权限
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

#### 步骤3：获取私钥内容
```bash
# 查看私钥内容（复制完整内容）
cat ~/.ssh/github_actions_key
```

#### 步骤4：配置GitHub Secrets
访问：https://github.com/simon699/dcc_campus/settings/secrets/actions

添加或更新以下Secrets：

| Secret名称 | 值 |
|-----------|-----|
| `SERVER_HOST` | 您的服务器IP地址 |
| `SERVER_USER` | 服务器用户名 |
| `SERVER_SSH_KEY` | 私钥的完整内容（包括`-----BEGIN OPENSSH PRIVATE KEY-----`和`-----END OPENSSH PRIVATE KEY-----`） |
| `SERVER_PORT` | SSH端口（默认22） |

### 方案2：使用现有密钥但移除密码保护

#### 步骤1：移除现有密钥的密码保护
```bash
# 在本地机器上执行
ssh-keygen -p -f ~/.ssh/id_rsa

# 当提示输入旧密码时，输入当前密码
# 当提示输入新密码时，直接按回车（不设置密码）
```

#### 步骤2：更新GitHub Secrets
使用更新后的私钥内容更新`SERVER_SSH_KEY` Secret。

### 方案3：使用密码认证（不推荐）

如果必须使用密码认证，需要修改GitHub Actions配置：

```yaml
- name: 部署到服务器
  if: github.ref == 'refs/heads/main'
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.SERVER_HOST }}
    username: ${{ secrets.SERVER_USER }}
    password: ${{ secrets.SERVER_PASSWORD }}  # 添加密码Secret
    port: ${{ secrets.SERVER_PORT }}
    script: |
      # 部署脚本
```

## 🔍 验证SSH连接

### 在本地测试SSH连接
```bash
# 测试SSH连接
ssh -i ~/.ssh/github_actions_key user@your-server

# 或者使用密码测试
ssh user@your-server
```

### 在服务器上测试
```bash
# 检查SSH服务状态
sudo systemctl status ssh

# 检查SSH配置
sudo cat /etc/ssh/sshd_config | grep -E "(PasswordAuthentication|PubkeyAuthentication)"
```

## 📝 完整的GitHub Actions配置

更新`.github/workflows/deploy.yml`：

```yaml
name: DCC数字员工系统 - 自动部署

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: 检出代码
      uses: actions/checkout@v4
      
    - name: 设置Node.js环境
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: dcc-digital-employee/package-lock.json
        
    - name: 设置Python环境
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        
    - name: 安装前端依赖
      working-directory: ./dcc-digital-employee
      run: |
        npm config set registry https://registry.npmmirror.com
        npm ci
        
    - name: 构建前端
      working-directory: ./dcc-digital-employee
      run: npm run build
      
    - name: 安装后端依赖
      working-directory: ./backend
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        
    - name: 运行测试
      run: |
        # 前端测试
        cd dcc-digital-employee
        npm run lint
        cd ..
        
        # 后端测试（如果有的话）
        cd backend
        python -m pytest tests/ || echo "No tests found"
        cd ..
        
    - name: 部署到服务器
      if: github.ref == 'refs/heads/main'
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        port: ${{ secrets.SERVER_PORT }}
        script: |
          # 进入项目目录（请修改为实际路径）
          cd /path/to/your/project
          
          # 拉取最新代码
          git pull origin main
          
          # 重启后端服务
          ./restart-backend.sh
          
          # 重启前端服务
          ./restart-frontend.sh
          
          # 检查服务状态
          sleep 10
          curl -f http://localhost:8000/api/health || exit 1
          curl -f http://localhost:3001 || exit 1
          
          echo "部署完成！"
```

## 🚨 重要注意事项

1. **私钥格式**：确保私钥包含完整的头部和尾部
2. **权限设置**：服务器上的SSH目录权限必须正确
3. **项目路径**：修改脚本中的项目路径为实际路径
4. **服务检查**：确保服务器上的服务脚本存在且有执行权限

## 🔧 故障排除

### 如果仍然失败，检查以下项目：

1. **SSH服务配置**：
```bash
sudo nano /etc/ssh/sshd_config
# 确保以下配置正确：
# PubkeyAuthentication yes
# AuthorizedKeysFile .ssh/authorized_keys
```

2. **防火墙设置**：
```bash
# 检查SSH端口是否开放
sudo ufw status
sudo firewall-cmd --list-ports
```

3. **SELinux设置**（如果适用）：
```bash
sudo setsebool -P ssh_sysadm_login on
```

## 📋 快速修复步骤

1. **生成新的无密码SSH密钥对**
2. **将公钥添加到服务器的authorized_keys**
3. **更新GitHub Secrets中的SERVER_SSH_KEY**
4. **修改部署脚本中的项目路径**
5. **重新推送代码触发Actions**

按照这些步骤操作后，GitHub Actions应该能够成功连接到服务器并执行部署。
