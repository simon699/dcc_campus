#!/bin/bash

# Celery Worker 和 Beat 停止脚本

# 设置工作目录
cd "$(dirname "$0")"

# 停止 Celery Worker
if [ -f logs/celery_worker.pid ]; then
    echo "🛑 停止 Celery Worker..."
    kill $(cat logs/celery_worker.pid) 2>/dev/null
    rm logs/celery_worker.pid
    echo "✅ Celery Worker 已停止"
else
    echo "ℹ️  Celery Worker 未运行"
fi

# 停止 Celery Beat
if [ -f logs/celery_beat.pid ]; then
    echo "🛑 停止 Celery Beat..."
    kill $(cat logs/celery_beat.pid) 2>/dev/null
    rm logs/celery_beat.pid
    echo "✅ Celery Beat 已停止"
else
    echo "ℹ️  Celery Beat 未运行"
fi

# 清理残留进程
pkill -f "celery.*celery_app" 2>/dev/null

echo "✅ 所有 Celery 进程已停止"

