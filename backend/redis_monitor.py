"""
Redis 监控工具
用于在 Redis Insight 中查看 Celery 任务状态
"""
import redis
import json
from datetime import datetime
from typing import Dict, List, Any
import os
from dotenv import load_dotenv

load_dotenv()

# Redis 配置
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')

# 连接 Redis
if REDIS_PASSWORD:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True
    )
else:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=True
    )


def get_queue_lengths() -> Dict[str, int]:
    """获取所有队列的长度"""
    queues = {
        'default': 'celery',
        'sync_queue': 'sync_queue',
        'download_queue': 'download_queue',
        'ai_queue': 'ai_queue',
        'query_queue': 'query_queue',
        'follow_queue': 'follow_queue',
        'monitor_queue': 'monitor_queue',
    }
    
    result = {}
    for name, queue_key in queues.items():
        length = redis_client.llen(queue_key)
        result[name] = length
    
    return result


def get_active_workers() -> List[Dict[str, Any]]:
    """获取活跃的 Worker 信息"""
    workers = []
    pattern = 'celery-worker-*'
    
    for key in redis_client.scan_iter(match=pattern):
        worker_id = key.replace('celery-worker-', '')
        worker_data = redis_client.get(key)
        
        if worker_data:
            try:
                data = json.loads(worker_data)
                workers.append({
                    'id': worker_id,
                    'data': data,
                    'last_seen': datetime.fromtimestamp(data.get('timestamp', 0)).isoformat() if data.get('timestamp') else None
                })
            except:
                workers.append({
                    'id': worker_id,
                    'data': worker_data,
                    'last_seen': None
                })
    
    return workers


def get_task_results(limit: int = 100) -> List[Dict[str, Any]]:
    """获取最近的任务结果"""
    results = []
    pattern = 'celery-task-meta-*'
    
    keys = []
    for key in redis_client.scan_iter(match=pattern):
        keys.append(key)
    
    # 按时间排序，获取最新的
    keys = sorted(keys, reverse=True)[:limit]
    
    for key in keys:
        task_id = key.replace('celery-task-meta-', '')
        task_data = redis_client.get(key)
        
        if task_data:
            try:
                data = json.loads(task_data)
                results.append({
                    'task_id': task_id,
                    'status': data.get('status', 'UNKNOWN'),
                    'result': data.get('result'),
                    'traceback': data.get('traceback'),
                    'date_done': data.get('date_done'),
                })
            except:
                results.append({
                    'task_id': task_id,
                    'status': 'ERROR',
                    'result': task_data,
                })
    
    return results


def get_pending_tasks() -> List[Dict[str, Any]]:
    """获取待处理的任务"""
    tasks = []
    
    # 检查所有队列
    queues = ['celery', 'sync_queue', 'download_queue', 'ai_queue', 'query_queue', 'follow_queue', 'monitor_queue']
    
    for queue in queues:
        length = redis_client.llen(queue)
        if length > 0:
            # 获取队列中的任务（不删除）
            items = redis_client.lrange(queue, 0, min(10, length) - 1)
            for item in items:
                try:
                    task_data = json.loads(item)
                    tasks.append({
                        'queue': queue,
                        'task_id': task_data.get('id'),
                        'task_name': task_data.get('task'),
                        'args': task_data.get('args', []),
                        'kwargs': task_data.get('kwargs', {}),
                    })
                except:
                    tasks.append({
                        'queue': queue,
                        'task_id': None,
                        'task_name': 'UNKNOWN',
                        'raw_data': item[:100],  # 只显示前100个字符
                    })
    
    return tasks


def get_beat_schedule() -> Dict[str, Any]:
    """获取 Beat 调度信息"""
    beat_key = 'celery-beat-schedule'
    schedule_data = redis_client.get(beat_key)
    
    if schedule_data:
        try:
            return json.loads(schedule_data)
        except:
            return {'raw': schedule_data}
    
    return {}


def print_monitor_info():
    """打印监控信息"""
    print("=" * 80)
    print("Celery 任务监控信息")
    print("=" * 80)
    print()
    
    # 队列长度
    print("📊 队列长度:")
    queue_lengths = get_queue_lengths()
    for queue, length in queue_lengths.items():
        status = "🟢" if length == 0 else "🟡" if length < 10 else "🔴"
        print(f"  {status} {queue}: {length} 个任务")
    print()
    
    # 活跃 Worker
    print("👷 活跃 Worker:")
    workers = get_active_workers()
    if workers:
        for worker in workers:
            print(f"  ✅ {worker['id']}")
            if worker['last_seen']:
                print(f"     最后活跃: {worker['last_seen']}")
    else:
        print("  ❌ 没有活跃的 Worker")
    print()
    
    # 待处理任务
    print("⏳ 待处理任务 (前10个):")
    pending = get_pending_tasks()
    if pending:
        for task in pending[:10]:
            print(f"  📋 {task['task_name']} (队列: {task['queue']})")
            if task.get('task_id'):
                print(f"     ID: {task['task_id']}")
    else:
        print("  ✅ 没有待处理的任务")
    print()
    
    # 最近任务结果
    print("📝 最近任务结果 (前10个):")
    results = get_task_results(limit=10)
    for result in results:
        status_icon = {
            'SUCCESS': '✅',
            'FAILURE': '❌',
            'PENDING': '⏳',
            'STARTED': '🔄',
            'RETRY': '🔄',
        }.get(result['status'], '❓')
        
        print(f"  {status_icon} {result['task_id'][:36]}... - {result['status']}")
        if result.get('date_done'):
            print(f"     完成时间: {result['date_done']}")
    print()
    
    # Beat 调度
    print("⏰ Beat 调度:")
    schedule = get_beat_schedule()
    if schedule:
        print(f"  ✅ Beat 调度已配置")
    else:
        print(f"  ❌ 未找到 Beat 调度信息")
    print()


if __name__ == '__main__':
    try:
        # 测试连接
        redis_client.ping()
        print("✅ Redis 连接成功\n")
        
        print_monitor_info()
        
    except redis.ConnectionError:
        print("❌ 无法连接到 Redis")
        print(f"   请检查 Redis 是否运行在 {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        print(f"❌ 错误: {str(e)}")

