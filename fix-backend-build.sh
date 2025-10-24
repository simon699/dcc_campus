#!/bin/bash

# 修复后端构建问题

echo "=== 修复后端构建问题 ==="
echo ""

echo "1. 检查Docker镜像加速器配置："
cat /etc/docker/daemon.json
echo ""

echo "2. 测试Python镜像拉取："
echo "测试拉取Python 3.11镜像："
time docker pull python:3.11-slim || echo "Python镜像拉取失败"
echo ""

echo "3. 如果Python镜像拉取失败，尝试其他版本："
echo "测试拉取Python 3.10镜像："
time docker pull python:3.10-slim || echo "Python 3.10镜像拉取失败"
echo ""

echo "4. 如果仍然失败，修改Dockerfile使用可用的镜像："
echo "备份原始Dockerfile："
cp backend/Dockerfile backend/Dockerfile.backup
echo ""

echo "5. 创建修复后的Dockerfile："
cat > backend/Dockerfile << 'EOF'
# 使用Python 3.10作为基础镜像（更稳定）
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# 安装系统依赖
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        default-libmysqlclient-dev \
        pkg-config \
        curl \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements.txt
COPY requirements.txt .

# 配置pip使用国内镜像源
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip config set global.trusted-host mirrors.aliyun.com \
    && pip config set global.timeout 300 \
    && pip config set global.retries 5

# 安装Python依赖
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建非root用户
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动应用
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
echo ""

echo "6. 重新构建后端服务："
docker-compose -f docker-compose-multi-project.yml build backend
echo ""

echo "7. 启动后端服务："
docker-compose -f docker-compose-multi-project.yml up -d backend
echo ""

echo "8. 等待后端服务启动："
sleep 30
echo ""

echo "9. 检查后端服务状态："
docker-compose -f docker-compose-multi-project.yml logs backend
echo ""

echo "10. 测试后端API："
curl -v http://localhost:8001/api/health || echo "后端API测试失败"
echo ""

echo "=== 后端构建修复完成 ==="
echo "如果仍然有问题，请检查："
echo "1. 网络连接：ping g0qd096q.mirror.aliyuncs.com"
echo "2. Docker配置：docker info | grep -A 5 'Registry Mirrors'"
echo "3. 服务器资源：free -h && df -h"
