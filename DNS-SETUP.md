# DNS域名配置说明

## 域名信息
- 主域名：`kongbaijiyi.com`
- 应用域名：`campus.kongbaijiyi.com`
- 服务器IP：`47.103.27.235`

## DNS配置步骤

### 1. 登录域名管理控制台
访问您的域名注册商控制台（如阿里云、腾讯云等）

### 2. 添加A记录
在域名管理页面添加以下A记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | campus | 47.103.27.235 | 600 |

### 3. 验证DNS解析
配置完成后，可以通过以下命令验证DNS解析：

```bash
# 检查域名解析
nslookup campus.kongbaijiyi.com

# 或者使用dig命令
dig campus.kongbaijiyi.com
```

### 4. 等待DNS生效
DNS配置通常需要5-30分钟生效，请耐心等待。

## 测试访问

DNS生效后，可以通过以下方式测试：

1. **HTTP访问**：`http://campus.kongbaijiyi.com`
2. **HTTPS访问**：`https://campus.kongbaijiyi.com`（需要先配置SSL证书）

## SSL证书配置

运行SSL证书配置脚本：

```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

## 常见问题

### 1. DNS解析不生效
- 检查A记录是否正确配置
- 等待DNS缓存刷新（最多24小时）
- 清除本地DNS缓存

### 2. 无法访问网站
- 确认服务器防火墙已开放80和443端口
- 检查Docker服务是否正常运行
- 查看服务器日志排查问题

### 3. SSL证书问题
- 确保域名解析已生效
- 检查80端口是否可访问（Let's Encrypt验证需要）
- 查看证书申请日志

## 监控和维护

### 1. 域名监控
建议设置域名监控，及时发现解析问题。

### 2. SSL证书续期
证书会自动续期，但建议定期检查续期状态。

### 3. 备份配置
定期备份DNS配置和SSL证书。
