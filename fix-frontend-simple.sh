#!/bin/bash

# 简单修复前端问题 - 不使用dumb-init

echo "=== 简单修复前端问题 ==="
echo ""

echo "1. 停止所有服务："
docker-compose -f docker-compose-multi-project.yml down 2>/dev/null || echo "没有运行中的服务"
echo ""

echo "2. 备份原始Dockerfile："
cp dcc-digital-employee/Dockerfile dcc-digital-employee/Dockerfile.backup
echo ""

echo "3. 创建简化的Dockerfile："
cat > dcc-digital-employee/Dockerfile << 'EOF'
# 使用Node.js 18作为基础镜像
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
# 配置阿里云镜像源加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
# 更新包索引并安装必要的依赖
RUN apk update && apk add --no-cache \
    libc6-compat
WORKDIR /app

# 配置npm使用国内镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制package.json和package-lock.json
COPY package*.json ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_LINT=false

# 显示调试信息
RUN echo "开始构建应用..."
RUN npm run build

# 生产阶段
FROM base AS runner
WORKDIR /app

# 配置阿里云镜像源加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置正确的权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制构建后的应用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用（不使用dumb-init）
CMD ["node", "server.js"]
EOF
echo ""

echo "4. 重新构建前端服务："
docker-compose -f docker-compose-multi-project.yml build frontend
echo ""

echo "5. 启动所有服务："
docker-compose -f docker-compose-multi-project.yml up -d
echo ""

echo "6. 等待服务启动："
sleep 60
echo ""

echo "7. 检查服务状态："
docker-compose -f docker-compose-multi-project.yml ps
echo ""

echo "8. 查看前端服务日志："
docker-compose -f docker-compose-multi-project.yml logs frontend
echo ""

echo "9. 测试服务访问："
echo "测试前端："
curl -v http://localhost:8080/ || echo "前端测试失败"
echo ""

echo "=== 前端问题修复完成 ==="
echo "访问地址："
echo "  校园系统：http://campus.kongbaijiyi.com:8080"
echo "  API文档：http://campus.kongbaijiyi.com:8080/docs"
echo "  API接口：http://campus.kongbaijiyi.com:8080/api"
