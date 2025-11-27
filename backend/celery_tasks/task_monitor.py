"""
定时任务监控相关 Celery 任务
"""
import logging
import time
from typing import Dict, Any, List, Tuple
from celery import Task
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from celery_app import celery_app
from api.auto_task_monitor import auto_task_monitor
from .task_handlers import (
    sync_call_job_ids,
    query_task_execution,
)

logger = logging.getLogger(__name__)

def _normalize_poll_pair(interval: int, duration: int) -> Tuple[int, int]:
    interval = max(5, interval)
    duration = max(interval, duration)
    return interval, duration


def _get_initial_poll_plan() -> List[Tuple[int, int]]:
    """
    解析任务创建后的高频轮询计划
    配置格式：INITIAL_QUERY_POLL_PLAN = "10:120,60:1800,300:7200"
    表示：10秒间隔持续120秒；60秒间隔持续1800秒；300秒间隔持续7200秒
    """
    plan_raw = os.getenv('INITIAL_QUERY_POLL_PLAN', '').strip()
    poll_plan: List[Tuple[int, int]] = []
    
    if plan_raw:
        for chunk in plan_raw.split(','):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                interval_str, duration_str = chunk.split(':', 1)
                poll_plan.append(
                    _normalize_poll_pair(
                        int(interval_str.strip()),
                        int(duration_str.strip())
                    )
                )
            except ValueError:
                logger.warning(f"INITIAL_QUERY_POLL_PLAN 片段 '{chunk}' 解析失败，已跳过")
    
    if not poll_plan:
        interval = int(os.getenv('INITIAL_QUERY_POLL_INTERVAL', '10'))
        duration = int(os.getenv('INITIAL_QUERY_POLL_DURATION', '120'))
        poll_plan.append(_normalize_poll_pair(interval, duration))
    
    return poll_plan


class CallbackTask(Task):
    """带回调的任务基类"""
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"监控任务 {task_id} 执行成功")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"监控任务 {task_id} 执行失败: {str(exc)}")


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def monitor_pending_tasks(self):
    """
    定时监控待处理的任务
    每5分钟执行一次，检查是否有需要处理的任务
    """
    try:
        logger.info("=" * 80)
        logger.info("开始执行监控任务: monitor_pending_tasks")
        logger.info("=" * 80)
        
        def run_status_refresh(processed_ids: set, reason: str):
            try:
                refresh_tasks = auto_task_monitor.get_tasks_for_status_refresh(limit=20)
                if not refresh_tasks:
                    logger.info(f"{reason}：无需要兜底检查的任务")
                    return
                for task in refresh_tasks:
                    task_id = task['task_id']
                    if task_id in processed_ids:
                        continue
                    try:
                        logger.info(f"{reason}：兜底检查任务状态 task_id={task_id}")
                        status_result = auto_task_monitor.check_and_update_task_status(task_id)
                        logger.info(f"{reason}：兜底检查结果 task_id={task_id}, result={status_result}")
                    except Exception as inner_e:
                        logger.warning(f"{reason}：兜底检查任务状态失败 task_id={task_id}, error={str(inner_e)}")
            except Exception as outer_e:
                logger.warning(f"{reason}：执行状态兜底检查失败: {str(outer_e)}")
        
        # 获取待处理的任务列表
        pending_tasks = auto_task_monitor.get_pending_tasks()
        
        logger.info(f"查询到 {len(pending_tasks)} 个待处理任务")
        if pending_tasks:
            for task in pending_tasks:
                logger.info(f"  - 任务ID: {task['task_id']}, 名称: {task['task_name']}, 类型: {task['task_type']}, job_group_id: {task.get('job_group_id', 'N/A')}")
        
        processed_task_ids = set()
        
        if not pending_tasks:
            logger.info("暂无待处理的任务，执行状态兜底检查")
            run_status_refresh(processed_task_ids, "无待处理任务")
            return {"status": "success", "message": "暂无待处理的任务", "processed": 0}
        
        logger.info(f"开始处理 {len(pending_tasks)} 个待处理任务")
        
        processed_count = 0
        completed_count = 0
        
        for task in pending_tasks:
            task_id = task['task_id']
            task_name = task['task_name']
            task_type = task['task_type']
            job_group_id = task.get('job_group_id')
            
            # 标记任务为处理中，避免重复处理
            auto_task_monitor.mark_task_processing(task_id)
            
            try:
                logger.info(f"开始处理任务: {task_name} (ID: {task_id}, Type: {task_type})")
                
                # 根据任务类型和状态，触发相应的处理任务
                if task_type == 2:
                    # 外呼开始阶段：需要同步 call_job_id 和获取对话数据
                    if job_group_id:
                        # 触发同步 call_job_id
                        sync_call_job_ids.delay(task_id, job_group_id)
                        logger.info(f"已触发同步 call_job_id: task_id={task_id}")
                    
                    # 触发查询任务执行状态（获取对话数据）
                    query_task_execution.delay(task_id)
                    logger.info(f"已触发查询任务执行状态: task_id={task_id}")
                
                elif task_type >= 3:
                    # task_type=3：外呼完成跟进中
                    # task_type>=4：理论上已完成，但如果存在缺失数据（call_status 为空），需要重新处理
                    if task_type >= 4:
                        logger.info(f"任务 {task_id} 当前状态为 {task_type}，但检测到缺失数据，重新触发执行状态查询")

                    # 检查是否有 call_job_id 为空的情况，需要重新匹配
                    from database.db import execute_query
                    empty_job_id_check_query = """
                        SELECT COUNT(*) as total
                        FROM leads_task_list 
                        WHERE task_id = %s 
                          AND (call_job_id IS NULL OR call_job_id = '')
                          AND (call_status IS NULL OR call_status = '')
                    """
                    empty_job_id_check_result = execute_query(empty_job_id_check_query, (task_id,))
                    empty_job_id_check_total = empty_job_id_check_result[0]['total'] if empty_job_id_check_result and empty_job_id_check_result[0].get('total') else 0
                    
                    if empty_job_id_check_total > 0 and job_group_id:
                        # 如果有 call_job_id 为空的记录，尝试重新同步
                        logger.info(f"任务 {task_id} 发现 {empty_job_id_check_total} 条记录 call_job_id 为空，将重新同步 call_job_id")
                        sync_call_job_ids.delay(task_id, job_group_id)
                        logger.info(f"已触发同步 call_job_id: task_id={task_id}")
                    
                    # 触发查询任务执行状态（获取对话数据和跟进记录）
                    query_task_execution.delay(task_id)
                    logger.info(f"已触发查询任务执行状态: task_id={task_id}")
                
                # 检查并更新任务状态
                status_result = auto_task_monitor.check_and_update_task_status(task_id)
                logger.info(f"任务状态检查结果: task_id={task_id}, result={status_result}")
                processed_task_ids.add(task_id)
                
                # 检查是否有缺少跟进记录的情况，需要触发创建
                # 注意：call_job_id 为空的记录会在 sync_call_job_ids 完成匹配后处理，这里不提前处理
                if status_result.get('status') == 'success':
                    from database.db import execute_query, execute_update
                    
                    # 检查缺少跟进记录的情况（只处理 is_interested IS NULL 的记录）
                    missing_follow_query = """
                        SELECT COUNT(*) as total
                        FROM leads_task_list 
                        WHERE task_id = %s 
                          AND call_status IN ('Succeeded', 'Failed')
                          AND leads_follow_id IS NULL
                          AND is_interested IS NULL
                          AND (
                              (call_job_id IS NOT NULL AND call_job_id != '')
                              OR (call_job_id IS NULL OR call_job_id = '')
                          )
                    """
                    missing_follow_result = execute_query(missing_follow_query, (task_id,))
                    missing_follow_total = missing_follow_result[0]['total'] if missing_follow_result and missing_follow_result[0].get('total') else 0
                    
                    if missing_follow_total > 0:
                        # 检查队列中是否已有待处理的任务，避免重复触发
                        try:
                            import redis
                            redis_host = os.getenv('REDIS_HOST', 'localhost')
                            redis_port = int(os.getenv('REDIS_PORT', '6379'))
                            redis_db = int(os.getenv('REDIS_DB', '0'))
                            redis_password = os.getenv('REDIS_PASSWORD', '')
                            
                            if redis_password:
                                redis_client = redis.Redis(host=redis_host, port=redis_port, db=redis_db, password=redis_password, decode_responses=True)
                            else:
                                redis_client = redis.Redis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)
                            
                            queue_length = redis_client.llen('follow_queue')
                            logger.info(f"任务 {task_id} 发现 {missing_follow_total} 条记录缺少跟进记录，follow_queue 队列中当前有 {queue_length} 个待处理任务")
                            
                            # 如果队列中已有大量任务（超过100个），记录警告，但继续触发（避免任务永远不被处理）
                            if queue_length > 100:
                                logger.warning(f"⚠️ follow_queue 队列中已有 {queue_length} 个待处理任务，worker 处理速度可能较慢。建议增加 worker 并发数或检查 worker 状态")
                            
                            logger.info(f"任务 {task_id} 发现 {missing_follow_total} 条记录缺少跟进记录，将触发跟进记录创建")
                            # 触发跟进记录创建任务（分页处理）
                            from celery_tasks.task_handlers import create_leads_follow, create_leads_follow_by_task_and_phone
                            
                            batch_size = 1000
                            total_triggered = 0
                            
                            for offset in range(0, missing_follow_total, batch_size):
                                    follow_query = """
                                        SELECT call_job_id, task_id, leads_phone
                                        FROM leads_task_list 
                                        WHERE task_id = %s 
                                          AND call_status IN ('Succeeded', 'Failed')
                                          AND leads_follow_id IS NULL
                                          AND is_interested IS NULL
                                        LIMIT %s OFFSET %s
                                    """
                                    follow_records = execute_query(follow_query, (task_id, batch_size, offset))
                                    
                                    if follow_records:
                                        # 批量触发跟进记录创建任务
                                        for record in follow_records:
                                            call_job_id = record.get('call_job_id')
                                            task_id_record = record.get('task_id')
                                            leads_phone = record.get('leads_phone')
                                            
                                            # 如果 call_job_id 为空，使用 task_id 和 leads_phone 创建唯一标识
                                            if call_job_id:
                                                try:
                                                    task_result = create_leads_follow.delay(call_job_id)
                                                    total_triggered += 1
                                                    if total_triggered <= 10:  # 记录前10个任务的详细信息
                                                        logger.info(f"[触发任务 {total_triggered}/{missing_follow_total}] call_job_id={call_job_id}, celery_task_id={task_result.id}")
                                                except Exception as e:
                                                    logger.error(f"触发跟进记录创建任务失败: call_job_id={call_job_id}, error={str(e)}", exc_info=True)
                                            elif task_id_record and leads_phone:
                                                # call_job_id 为空，使用 task_id 和 leads_phone 创建跟进记录
                                                try:
                                                    # 使用 apply_async 确保任务被正确路由到 follow_queue
                                                    task_result = create_leads_follow_by_task_and_phone.apply_async(args=[task_id_record, leads_phone], queue='follow_queue')
                                                    total_triggered += 1
                                                    if total_triggered <= 10:  # 记录前10个任务的详细信息
                                                        logger.info(f"[触发任务 {total_triggered}/{missing_follow_total}] task_id={task_id_record}, leads_phone={leads_phone}, celery_task_id={task_result.id}, queue=follow_queue")
                                                except Exception as e:
                                                    logger.error(f"触发跟进记录创建任务失败: task_id={task_id_record}, leads_phone={leads_phone}, error={str(e)}", exc_info=True)
                                            else:
                                                logger.warning(f"跳过无效记录: call_job_id={call_job_id}, task_id={task_id_record}, leads_phone={leads_phone}")
                                    
                                    # 如果这批记录数少于 batch_size，说明已经处理完所有记录
                                    if len(follow_records) < batch_size:
                                        break
                            
                            # 再次检查队列长度（等待一小段时间让任务进入队列）
                            # 注意：worker 使用 solo pool 且 concurrency=1，处理速度较慢，需要等待更长时间
                            wait_time = min(2.0, total_triggered * 0.01)  # 等待时间：最多2秒，或根据任务数量计算（每个任务约0.01秒）
                            time.sleep(wait_time)
                            final_queue_length = redis_client.llen('follow_queue')
                            logger.info(f"已触发 {total_triggered} 个跟进记录创建任务（共 {missing_follow_total} 条需要处理），等待 {wait_time:.1f} 秒后，follow_queue 队列中现有 {final_queue_length} 个待处理任务")
                            
                            # 如果触发的任务数和队列长度差异很大，记录信息
                            if total_triggered > 0 and final_queue_length == 0:
                                # 队列为空可能是任务被快速处理，或者任务还在处理中（worker 只有1个并发）
                                logger.info(f"ℹ️ 触发了 {total_triggered} 个任务，队列为空。Worker 正在处理这些任务（worker 并发数=1，处理速度较慢，预计需要 {total_triggered * 0.8:.0f} 秒）")
                            elif total_triggered > final_queue_length + 10:
                                remaining_in_queue = final_queue_length
                                processing_or_done = total_triggered - remaining_in_queue
                                logger.info(f"ℹ️ 触发了 {total_triggered} 个任务，队列中有 {remaining_in_queue} 个待处理，{processing_or_done} 个正在被处理或已完成")
                            
                            # 如果队列积压严重，给出提示
                            if final_queue_length > 200:
                                logger.warning(f"⚠️ follow_queue 队列积压严重（{final_queue_length} 个任务），worker 处理速度可能跟不上。建议：1) 增加 worker 并发数；2) 检查 worker 是否正常运行；3) 考虑使用多个 worker 实例")
                        except Exception as e:
                            logger.warning(f"检查队列状态失败，继续触发任务: {str(e)}")
                            # 如果检查队列失败，仍然触发任务（向后兼容）
                            from celery_tasks.task_handlers import create_leads_follow
                            
                            batch_size = 1000
                            total_triggered = 0
                            
                            for offset in range(0, missing_follow_total, batch_size):
                                follow_query = """
                                    SELECT call_job_id
                                    FROM leads_task_list 
                                    WHERE task_id = %s 
                                      AND call_job_id IS NOT NULL 
                                      AND call_job_id != ''
                                      AND call_status IN ('Succeeded', 'Failed')
                                      AND leads_follow_id IS NULL
                                    LIMIT %s OFFSET %s
                                """
                                follow_records = execute_query(follow_query, (task_id, batch_size, offset))
                                
                                if follow_records:
                                    for record in follow_records:
                                        call_job_id = record.get('call_job_id')
                                        if call_job_id:
                                            try:
                                                create_leads_follow.delay(call_job_id)
                                                total_triggered += 1
                                            except Exception as e:
                                                logger.warning(f"触发跟进记录创建任务失败: call_job_id={call_job_id}, error={str(e)}")
                                
                                if len(follow_records) < batch_size:
                                    break
                            
                            logger.info(f"已触发 {total_triggered} 个跟进记录创建任务（共 {missing_follow_total} 条需要处理）")
                    
                    # 检查是否有跟进记录但 is_interested 为 NULL 的情况，需要同步
                    sync_interest_query = """
                        SELECT COUNT(*) as total
                        FROM leads_task_list 
                        WHERE task_id = %s 
                          AND call_job_id IS NOT NULL 
                          AND call_job_id != ''
                          AND call_status IS NOT NULL 
                          AND call_status != ''
                          AND leads_follow_id IS NOT NULL
                          AND is_interested IS NULL
                    """
                    sync_interest_result = execute_query(sync_interest_query, (task_id,))
                    sync_interest_total = sync_interest_result[0]['total'] if sync_interest_result and sync_interest_result[0].get('total') else 0
                    
                    if sync_interest_total > 0:
                        logger.info(f"任务 {task_id} 发现 {sync_interest_total} 条记录有跟进记录但 is_interested 为 NULL，将设置为默认值 0")
                        sync_update_query = """
                            UPDATE leads_task_list
                            SET is_interested = 0
                            WHERE task_id = %s 
                              AND call_job_id IS NOT NULL 
                              AND call_job_id != ''
                              AND call_status IS NOT NULL 
                              AND call_status != ''
                              AND leads_follow_id IS NOT NULL
                              AND is_interested IS NULL
                        """
                        try:
                            execute_update(sync_update_query, (task_id,))
                            logger.info(f"已更新 {sync_interest_total} 条记录的 is_interested 为默认值 0")
                        except Exception as e:
                            logger.warning(f"更新 is_interested 失败: {str(e)}")
                
                # 如果所有记录都处理完（包括 call_status 和 is_interested），标记任务完成
                if status_result.get('status') == 'success':
                    stats = status_result.get('stats', {})
                    total_called = stats.get('total_called', 0) or 0
                    has_status = stats.get('has_status', 0) or 0
                    has_interest = stats.get('has_interest', 0) or 0
                    
                    # 检查是否所有记录都有 is_interested（不为 NULL）
                    from database.db import execute_query
                    check_interest_query = """
                        SELECT COUNT(*) as total
                        FROM leads_task_list 
                        WHERE task_id = %s 
                          AND call_job_id IS NOT NULL 
                          AND call_job_id != ''
                          AND call_status IS NOT NULL 
                          AND call_status != ''
                          AND is_interested IS NULL
                    """
                    check_interest_result = execute_query(check_interest_query, (task_id,))
                    missing_interest = check_interest_result[0]['total'] if check_interest_result and check_interest_result[0].get('total') else 0
                    
                    # 根据文档，判断条件2应该检查 is_interested，而不是 has_follow
                    # 如果所有已外呼的记录都有 call_status 和 is_interested，标记任务完成
                    if total_called > 0 and has_status == total_called and has_interest == total_called and missing_interest == 0:
                        logger.info(f"任务 {task_id} 所有记录都已处理完（包括 call_status 和 is_interested），标记任务完成")
                        auto_task_monitor.mark_task_completed(task_id)
                        completed_count += 1
                    elif missing_interest > 0:
                        logger.info(f"任务 {task_id} 还有 {missing_interest} 条记录的 is_interested 为 NULL，不标记完成")
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"处理任务失败: task_id={task_id}, error={str(e)}")
                # 标记任务处理完成（即使失败也移除，避免一直阻塞）
                auto_task_monitor.mark_task_completed(task_id)
            finally:
                # 注意：这里不立即标记完成，因为异步任务还在执行
                # 任务完成后由异步任务回调或下次检查时清理
                pass
        
        if completed_count == processed_count:
            message = f"已处理 {processed_count} 个任务，全部完成"
        elif completed_count > 0:
            message = f"已检查 {processed_count} 个任务，其中 {completed_count} 个已完成，{processed_count - completed_count} 个仍在处理中"
        else:
            message = f"已检查 {processed_count} 个任务，均未完成（仍在处理中）"
        
        # 处理完待处理任务后，再执行一次状态兜底检查，确保可以晋级到 4
        run_status_refresh(processed_task_ids, "处理待处理任务后")
        
        return {
            "status": "success",
            "message": message,
            "processed": processed_count,
            "completed": completed_count
        }
    
    except Exception as e:
        logger.error(f"监控待处理任务失败: {str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def refresh_task_status(self, task_id: int):
    """
    单次刷新任务状态
    """
    try:
        logger.info(f"手动刷新任务状态: task_id={task_id}")
        result = auto_task_monitor.check_and_update_task_status(task_id)
        logger.info(f"刷新结果: task_id={task_id}, result={result}")
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"刷新任务状态失败: task_id={task_id}, error={str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def process_task_after_creation(self, task_id: int):
    """
    任务创建后立即处理
    在 start_call_task 后调用，立即开始处理任务
    """
    try:
        # 查询任务信息
        from database.db import execute_query
        
        task_query = """
            SELECT id, task_name, task_type, job_group_id
            FROM call_tasks
            WHERE id = %s
        """
        task_result = execute_query(task_query, (task_id,))
        
        if not task_result:
            logger.warning(f"未找到任务: task_id={task_id}")
            return {"status": "failed", "message": "任务不存在"}
        
        task = task_result[0]
        task_type = task['task_type']
        job_group_id = task.get('job_group_id')
        
        logger.info(f"任务创建后立即处理: task_id={task_id}, task_type={task_type}")
        
        # 标记任务为处理中
        auto_task_monitor.mark_task_processing(task_id)
        
        try:
            if task_type == 2 and job_group_id:
                # 外呼开始阶段：同步 call_job_id 和获取对话数据
                sync_call_job_ids.delay(task_id, job_group_id)
                logger.info(f"已触发同步 call_job_id: task_id={task_id}")
                
                # 创建任务后分阶段加速轮询执行状态
                poll_plan = _get_initial_poll_plan()
                
                # 立即触发一次
                query_task_execution.delay(task_id)
                refresh_task_status.delay(task_id)
                logger.info(f"已立即触发查询任务执行状态和状态刷新: task_id={task_id}")
                
                elapsed = 0
                total_scheduled = 0
                max_schedule = int(os.getenv('INITIAL_QUERY_MAX_SCHEDULES', '200'))
                
                for interval, duration in poll_plan:
                    runs = max(1, duration // interval)
                    for i in range(runs):
                        countdown = elapsed + (i + 1) * interval
                        query_task_execution.apply_async(args=[task_id], countdown=countdown)
                        refresh_task_status.apply_async(args=[task_id], countdown=countdown)
                        total_scheduled += 1
                        logger.info(
                            f"已调度查询及状态刷新: task_id={task_id}, interval={interval}s, "
                            f"duration={duration}s, countdown={countdown}s"
                        )
                        if total_scheduled >= max_schedule:
                            logger.warning(
                                f"任务 {task_id} 的调度次数达到上限 {max_schedule}，"
                                "后续将由常规监控任务接管"
                            )
                            break
                    if total_scheduled >= max_schedule:
                        break
                    elapsed += runs * interval
            
            return {"status": "success", "message": f"任务 {task_id} 已开始处理"}
        
        except Exception as e:
            logger.error(f"处理任务失败: task_id={task_id}, error={str(e)}")
            auto_task_monitor.mark_task_completed(task_id)
            raise
    
    except Exception as e:
        logger.error(f"任务创建后处理失败: task_id={task_id}, error={str(e)}")
        raise self.retry(exc=e)

