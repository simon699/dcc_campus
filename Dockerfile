# DCC数字员工系统 - 主Dockerfile
# 用于阿里云ACR部署

# 使用多阶段构建 - 使用官方镜像源
FROM aliyunfc/runtime-python3.9:latest AS backend-builder

WORKDIR /build/backend

# 设置pip镜像源 - 使用阿里云镜像源，添加重试机制
ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_TIMEOUT=120
ENV PIP_RETRIES=3

# 复制后端依赖文件
COPY backend/requirements.txt .

# 安装依赖，添加重试机制
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 3 --timeout 120 -r requirements.txt

# 后端生产镜像
FROM aliyunfc/runtime-python3.9:latest AS backend

WORKDIR /app

# 复制Python包
COPY --from=backend-builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# 复制后端应用代码
COPY backend/ .

# 设置环境变量
ENV PYTHONPATH=/app
ENV ENVIRONMENT=production
ENV DEBUG=False

# 创建非root用户
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app

# 切换到非root用户
USER app

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
