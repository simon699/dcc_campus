# DCC数字员工系统 - 服务器部署问题解决方案

## 问题分析

您遇到的主要问题：
1. **Python环境管理问题**：服务器使用外部管理的Python环境
2. **网络超时问题**：pip安装包时网络超时
3. **数据库连接问题**：脚本尝试连接localhost而不是RDS

## 解决方案

我为您创建了多个解决方案，按推荐顺序排列：

### 方案1：MySQL客户端直接连接（推荐）

使用MySQL客户端直接连接RDS，完全避免Python环境问题：

```bash
# 在服务器上执行
./init-database-mysql.sh
```

**优势：**
- 不需要Python环境
- 直接使用MySQL客户端
- 网络要求低
- 执行速度快

### 方案2：Docker构建镜像（备选）

使用Docker构建包含依赖的镜像：

```bash
# 在服务器上执行
./init-database-simple.sh
```

**优势：**
- 避免网络超时问题
- 使用预构建镜像
- 环境隔离

### 方案3：手动MySQL命令（最简单）

如果脚本都有问题，可以手动执行：

```bash
# 1. 测试连接
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p

# 2. 创建数据库
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p -e "CREATE DATABASE IF NOT EXISTS dcc_employee_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. 创建表结构
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p dcc_employee_db < backend/database/01_create_tables.sql
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p dcc_employee_db < backend/database/02_call_tasks.sql
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p dcc_employee_db < backend/database/03_auto_call_tables.sql
mysql -h rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com -P 3306 -u dcc_user -p dcc_employee_db < backend/database/04_dcc_leads.sql
```

## 完整部署流程

### 第一步：确保环境变量正确

```bash
# 检查.env文件
cat .env | grep DB_

# 应该看到：
# DB_HOST=rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com
# DB_PORT=3306
# DB_USER=dcc_user
# DB_PASSWORD=您的实际密码
# DB_NAME=dcc_employee_db
```

### 第二步：初始化数据库

```bash
# 推荐使用MySQL客户端方案
./init-database-mysql.sh

# 如果失败，尝试Docker方案
./init-database-simple.sh

# 如果都失败，使用手动命令
```

### 第三步：部署应用

```bash
# 部署应用
./deploy-server.sh

# 或者手动部署
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 第四步：验证部署

```bash
# 检查服务状态
docker-compose ps

# 检查API健康状态
curl http://localhost/api/health

# 查看日志
docker-compose logs -f
```

## 故障排除

### 1. RDS连接问题

**检查RDS安全组：**
- 确保允许服务器IP `47.103.27.235` 访问3306端口
- 检查RDS实例状态是否正常

**测试连接：**
```bash
# 使用telnet测试端口
telnet rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com 3306

# 使用nc测试
nc -zv rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com 3306
```

### 2. 网络问题

**检查网络连接：**
```bash
# 检查DNS解析
nslookup rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com

# 检查路由
traceroute rm-uf659mlhqay324l921o.mysql.rds.aliyuncs.com
```

### 3. 权限问题

**检查文件权限：**
```bash
# 确保脚本有执行权限
chmod +x *.sh

# 检查文件所有者
ls -la *.sh
```

## 快速部署命令

如果您想快速开始，按以下顺序执行：

```bash
# 1. 登录服务器
ssh root@47.103.27.235

# 2. 进入项目目录
cd /opt/dcc-employee

# 3. 检查环境变量
cat .env | grep DB_

# 4. 初始化数据库（选择一种方案）
./init-database-mysql.sh
# 或者
./init-database-simple.sh
# 或者手动执行MySQL命令

# 5. 部署应用
./deploy-server.sh

# 6. 验证部署
docker-compose ps
curl http://localhost/api/health
```

## 预期结果

部署成功后，您应该能够通过以下地址访问：

- **主站**: http://campus.kongbaijiyi.com
- **API文档**: http://campus.kongbaijiyi.com/docs
- **健康检查**: http://campus.kongbaijiyi.com/api/health

## 联系支持

如果所有方案都失败，请提供：
1. 错误日志
2. 网络连接测试结果
3. RDS安全组配置截图
4. 服务器环境信息

---

**建议优先尝试方案1（MySQL客户端），这是最稳定和快速的方案。**
