# GitHub Actions 自动部署验证指南

## 🔍 如何验证GitHub Actions自动部署是否生效

### 1. 检查配置文件状态

✅ **配置文件已存在**: `.github/workflows/deploy.yml`
✅ **触发条件已配置**: 推送到main分支时自动触发
✅ **GitHub仓库已配置**: `simon699/dcc_campus`

### 2. 必须配置的GitHub Secrets

访问以下链接配置Secrets：
**https://github.com/simon699/dcc_campus/settings/secrets/actions**

需要配置以下Secrets：

| Secret名称 | 说明 | 示例值 |
|-----------|------|--------|
| `SERVER_HOST` | 服务器IP地址 | `192.168.1.100` |
| `SERVER_USER` | 服务器用户名 | `root` 或 `ubuntu` |
| `SERVER_SSH_KEY` | SSH私钥内容 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_PORT` | SSH端口（可选） | `22` |

### 3. 验证步骤

#### 步骤1：配置Secrets
1. 访问GitHub仓库设置页面
2. 进入 "Secrets and variables" > "Actions"
3. 点击 "New repository secret"
4. 添加上述4个Secrets

#### 步骤2：测试推送
```bash
# 运行验证脚本
./verify-github-actions.sh

# 或者手动创建测试提交
echo "# 测试自动部署 $(date)" >> test-deploy.md
git add .
git commit -m "test: 测试GitHub Actions自动部署"
git push dcc_campus main
```

#### 步骤3：监控Actions运行
访问：**https://github.com/simon699/dcc_campus/actions**

查看：
- ✅ Workflow是否被触发
- ✅ 构建步骤是否成功
- ✅ 部署步骤是否成功
- ❌ 如果有错误，查看详细日志

### 4. 常见问题排查

#### 问题1：Actions没有被触发
**原因**：
- 推送到了错误的分支
- 配置文件路径错误
- 配置文件语法错误





**解决**：
```bash
# 确认当前分支
git branch

# 确认配置文件
ls -la .github/workflows/

# 检查配置文件语法
cat .github/workflows/deploy.yml
```

#### 问题2：构建失败
**原因**：
- 依赖安装失败
- 代码语法错误
- 环境配置问题

**解决**：
- 查看Actions日志中的错误信息
- 检查package.json和requirements.txt
- 确认Node.js和Python版本

#### 问题3：部署失败
**原因**：
- SSH连接失败
- Secrets配置错误
- 服务器权限问题

**解决**：
- 检查SERVER_HOST、SERVER_USER、SERVER_SSH_KEY
- 测试SSH连接：`ssh -i ~/.ssh/id_rsa user@server`
- 确认服务器上的项目路径正确

### 5. 验证部署成功

#### 检查服务器状态
```bash
# SSH连接到服务器
ssh user@server

# 检查服务状态
ps aux | grep -E "next|uvicorn"
netstat -tlnp | grep -E ":(3001|8000)"

# 查看日志
tail -f frontend.log
tail -f backend.log
```

#### 检查应用访问
- 前端：`http://your-server:3001`
- 后端API：`http://your-server:8000/api/health`
- API文档：`http://your-server:8000/docs`

### 6. 实时监控

#### GitHub Actions页面
- 访问：https://github.com/simon699/dcc_campus/actions
- 查看最新的workflow运行状态
- 点击查看详细日志

#### 服务器监控
```bash
# 监控服务状态
watch -n 5 'ps aux | grep -E "next|uvicorn"'

# 监控日志
tail -f frontend.log backend.log
```

### 7. 测试自动部署

#### 方法1：修改代码测试
```bash
# 修改任意文件
echo "// 测试修改 $(date)" >> dcc-digital-employee/src/app/page.tsx

# 提交并推送
git add .
git commit -m "test: 测试自动部署 $(date)"
git push dcc_campus main
```

#### 方法2：使用验证脚本
```bash
# 运行验证脚本
./verify-github-actions.sh
```

### 8. 成功标志

✅ **GitHub Actions成功标志**：
- Workflow被触发
- 所有步骤显示绿色✓
- 部署步骤成功完成

✅ **服务器部署成功标志**：
- 服务进程正在运行
- 端口3001和8000被监听
- 应用可以正常访问

✅ **自动更新成功标志**：
- 代码修改后推送
- GitHub Actions自动运行
- 服务器上的代码自动更新
- 服务自动重启

### 9. 故障排除命令

```bash
# 检查GitHub Actions配置
cat .github/workflows/deploy.yml

# 检查远程仓库
git remote -v

# 检查当前分支
git branch

# 检查最近提交
git log --oneline -5

# 检查服务器连接
ssh -i ~/.ssh/id_rsa user@server "echo 'SSH连接成功'"

# 检查服务器服务状态
ssh user@server "ps aux | grep -E 'next|uvicorn'"
```

通过以上步骤，您可以完全验证GitHub Actions自动部署是否正常工作！
