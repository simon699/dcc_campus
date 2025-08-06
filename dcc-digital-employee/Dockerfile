# 分阶段构建减小镜像体积
FROM node:16-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 生产环境镜像
FROM node:16-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# 配置环境变量（后端API地址）
ENV NEXT_PUBLIC_API_BASE_URL=https://campus.kongbaijiyi.com/api
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]