"""
Celery 应用配置
用于异步任务处理和定时任务调度
"""
from celery import Celery
from celery.schedules import crontab
import os
from dotenv import load_dotenv

load_dotenv()

# Redis 配置
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')

# 构建 Redis URL
if REDIS_PASSWORD:
    redis_url = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
else:
    redis_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# 创建 Celery 应用
celery_app = Celery(
    'dcc_digital_employee',
    broker=redis_url,
    backend=redis_url,
    include=['celery_tasks']
)

# Celery 配置
celery_app.conf.update(
    # 任务序列化
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Shanghai',
    enable_utc=True,
    
    # 任务路由
    task_routes={
        'celery_tasks.task_handlers.sync_call_job_ids': {'queue': 'sync_queue'},
        'celery_tasks.task_handlers.download_recording': {'queue': 'download_queue'},
        'celery_tasks.task_handlers.generate_follow': {'queue': 'ai_queue'},
        'celery_tasks.task_handlers.query_task_execution': {'queue': 'query_queue'},
        'celery_tasks.task_handlers.create_leads_follow': {'queue': 'follow_queue'},
        'celery_tasks.task_handlers.create_leads_follow_by_task_and_phone': {'queue': 'follow_queue'},
        'celery_tasks.task_monitor.monitor_pending_tasks': {'queue': 'monitor_queue'},
        'celery_tasks.task_monitor.process_task_after_creation': {'queue': 'monitor_queue'},
        'celery_tasks.task_monitor.refresh_task_status': {'queue': 'monitor_queue'},
    },
    
    # 任务优先级
    task_default_priority=5,
    task_inherit_parent_priority=True,
    
    # 任务重试配置
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # 结果过期时间
    result_expires=3600,  # 1小时
    
    # Worker 配置
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,  # 降低值，让 worker 更频繁重启，避免内存泄漏和崩溃
    worker_disable_rate_limits=False,
    
    # 定时任务配置
    beat_schedule={
        # 每5分钟执行一次任务监控
        'monitor-pending-tasks': {
            'task': 'celery_tasks.task_monitor.monitor_pending_tasks',
            'schedule': 300.0,  # 每5分钟（300秒）
            'options': {'queue': 'monitor_queue', 'priority': 5}
        },
    },
)

# 任务去重配置（使用 Redis 实现）
celery_app.conf.task_default_queue = 'default'
celery_app.conf.task_default_exchange = 'tasks'
celery_app.conf.task_default_exchange_type = 'direct'
celery_app.conf.task_default_routing_key = 'default'

