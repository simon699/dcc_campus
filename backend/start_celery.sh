#!/bin/bash

# Celery Worker 和 Beat 启动脚本

# 设置工作目录
cd "$(dirname "$0")"

# 检查虚拟环境是否存在
if [ ! -d "venv" ]; then
    echo "❌ 虚拟环境不存在，请先创建虚拟环境"
    echo "   python3 -m venv venv"
    exit 1
fi

# 激活虚拟环境
echo "🔧 激活虚拟环境..."
source venv/bin/activate

# 创建日志目录（如果不存在）
mkdir -p logs

# 检查 Redis 是否运行
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis 未运行，请先启动 Redis"
    echo "   macOS: brew services start redis"
    echo "   Linux: sudo systemctl start redis"
    exit 1
fi

echo "✅ Redis 连接正常"

# 检查 Celery 是否安装
if ! python -c "import celery" 2>/dev/null; then
    echo "❌ Celery 未安装，正在安装..."
    pip install -r requirements.txt
fi

# 检查 Celery Worker 是否已在运行
if [ -f "logs/celery_worker.pid" ]; then
    WORKER_PID=$(cat logs/celery_worker.pid)
    if ps -p $WORKER_PID > /dev/null 2>&1; then
        echo "ℹ️  Celery Worker 已在运行 (PID: $WORKER_PID)"
        WORKER_RUNNING=true
    else
        echo "⚠️  发现旧的 Worker PID 文件，正在清理..."
        rm -f logs/celery_worker.pid
        WORKER_RUNNING=false
    fi
else
    WORKER_RUNNING=false
fi

# 检查 Celery Beat 是否已在运行
if [ -f "logs/celery_beat.pid" ]; then
    BEAT_PID=$(cat logs/celery_beat.pid)
    if ps -p $BEAT_PID > /dev/null 2>&1; then
        echo "ℹ️  Celery Beat 已在运行 (PID: $BEAT_PID)"
        BEAT_RUNNING=true
    else
        echo "⚠️  发现旧的 Beat PID 文件，正在清理..."
        rm -f logs/celery_beat.pid
        BEAT_RUNNING=false
    fi
else
    BEAT_RUNNING=false
fi

# 启动 Celery Worker（如果未运行）
if [ "$WORKER_RUNNING" = false ]; then
    echo "🚀 启动 Celery Worker..."
    # 使用 solo pool 避免 prefork 模式下的 SIGSEGV 问题（macOS Python 3.13 兼容性）
    celery -A celery_app worker \
        --loglevel=info \
        --pool=solo \
        --concurrency=1 \
        --logfile=logs/celery_worker.log \
        --pidfile=logs/celery_worker.pid \
        --queues=default,sync_queue,download_queue,ai_queue,query_queue,follow_queue,monitor_queue \
        --detach
    echo "✅ Celery Worker 已启动（使用 solo pool，监听所有队列）"
else
    echo "⏭️  跳过 Celery Worker 启动（已在运行）"
    echo "⚠️  注意：如果 Worker 没有监听 monitor_queue，请重启 Worker"
fi

# 启动 Celery Beat（如果未运行）
if [ "$BEAT_RUNNING" = false ]; then
    echo "🚀 启动 Celery Beat..."
    celery -A celery_app beat \
        --loglevel=info \
        --logfile=logs/celery_beat.log \
        --pidfile=logs/celery_beat.pid \
        --detach
    echo "✅ Celery Beat 已启动"
else
    echo "⏭️  跳过 Celery Beat 启动（已在运行）"
fi

echo ""
echo "✅ Celery Worker 和 Beat 运行状态检查完成"
echo ""
echo "📊 查看日志:"
echo "   Worker: tail -f logs/celery_worker.log"
echo "   Beat:   tail -f logs/celery_beat.log"
echo ""
echo "🛑 停止服务:"
echo "   ./stop_celery.sh"
echo ""
echo "🌺 启动 Flower 监控 (可选):"
echo "   celery -A celery_app flower --port=5555"

