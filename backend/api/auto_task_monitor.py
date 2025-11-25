"""
自动化任务监控器
负责监控和自动处理外呼任务的各个阶段
"""
import logging
import os
import time
from typing import Dict, Any, List, Set
from database.db import execute_query, execute_update

logger = logging.getLogger(__name__)


class AutoTaskMonitor:
    """自动化任务监控器"""
    
    def __init__(self):
        self._processing_tasks: Set[int] = set()  # 正在处理的任务ID集合，避免重复处理
        self._processing_timeout = 300  # 处理超时时间（秒），超过此时间自动清除
        self._processing_start_time: Dict[int, float] = {}  # 任务开始处理的时间
        self._redis_client = None
        self._redis_processing_key = "auto_task_monitor:processing_tasks"
    
    def get_pending_tasks(self) -> List[Dict[str, Any]]:
        """
        获取待处理的任务列表
        
        筛选条件：
        - task_type = 2（外呼开始）或 3（外呼完成跟进中）
        - job_group_id 不为空
        - 不在正在处理的集合中
        - 对于 task_type=2：只要有 job_group_id 就处理（即使所有记录都已完成）
        - 对于 task_type=3：任务下还有未完成的记录（缺少 call_status 或 leads_follow_id）
        
        返回：任务列表，包含 task_id, task_name, task_type, job_group_id
        """
        try:
            # 清理超时的处理中任务
            self._cleanup_timeout_tasks()
            
            query = """
                SELECT DISTINCT ct.id as task_id, ct.task_name, ct.task_type, ct.job_group_id
                FROM call_tasks ct
                INNER JOIN leads_task_list ltl ON ct.id = ltl.task_id
                WHERE ct.task_type IN (2, 3)
                  AND ct.job_group_id IS NOT NULL 
                  AND ct.job_group_id != ''
                  AND (
                      -- task_type=2 的任务：只要有 job_group_id 就处理
                      ct.task_type = 2
                      -- 或者 task_type=3 的任务：有未完成的记录
                      OR (
                          ct.task_type = 3
                          AND (
                              -- call_job_id 为空且 call_status 为 NULL 的记录（需要设置状态）
                              EXISTS (
                                  SELECT 1 FROM leads_task_list 
                                  WHERE task_id = ct.id 
                                  AND (call_job_id IS NULL OR call_job_id = '')
                                  AND (call_status IS NULL OR call_status = '')
                              )
                              -- 或者缺少 call_status 的记录（call_job_id 不为空）
                              OR EXISTS (
                                  SELECT 1 FROM leads_task_list 
                                  WHERE task_id = ct.id 
                                  AND call_job_id IS NOT NULL 
                                  AND call_job_id != ''
                                  AND (call_status IS NULL OR call_status = '')
                              )
                              -- 或者缺少跟进记录（leads_follow_id 为 NULL）的记录
                              -- 注意：如果缺少跟进记录，is_interested 也会是 NULL，需要先创建跟进记录
                              OR EXISTS (
                                  SELECT 1 FROM leads_task_list 
                                  WHERE task_id = ct.id 
                                  AND call_job_id IS NOT NULL 
                                  AND call_job_id != ''
                                  AND call_status IS NOT NULL 
                                  AND call_status != ''
                                  AND leads_follow_id IS NULL
                              )
                              -- 或者缺少 is_interested 的记录（根据文档，判断条件2应该检查 is_interested）
                              OR EXISTS (
                                  SELECT 1 FROM leads_task_list 
                                  WHERE task_id = ct.id 
                                  AND call_job_id IS NOT NULL 
                                  AND call_job_id != ''
                                  AND call_status IS NOT NULL 
                                  AND call_status != ''
                                  AND call_status != 'Failed'
                                  AND leads_follow_id IS NOT NULL
                                  AND is_interested IS NULL
                              )
                          )
                      )
                  )
                ORDER BY ct.id ASC
                LIMIT 10
            """
            tasks = execute_query(query)
            logger.info(f"SQL查询返回 {len(tasks)} 个任务")
            if tasks:
                logger.info(f"查询到的任务: {[{'id': t['task_id'], 'name': t['task_name'], 'type': t['task_type']} for t in tasks]}")
            
            # 过滤掉正在处理的任务
            processing_map = self._current_processing_map()
            processing_count = len(processing_map)
            if processing_count > 0:
                logger.info(f"正在处理的任务ID: {list(processing_map.keys())}")
            
            pending_tasks = [
                task for task in tasks 
                if task['task_id'] not in processing_map
            ]
            
            filtered_count = len(tasks) - len(pending_tasks)
            if filtered_count > 0:
                logger.info(f"过滤掉 {filtered_count} 个正在处理的任务")
            
            logger.info(f"最终返回 {len(pending_tasks)} 个待处理任务")
            return pending_tasks
        except Exception as e:
            logger.error(f"获取待处理任务失败: {str(e)}")
            return []
    
    def get_tasks_for_status_refresh(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        获取需要做状态兜底检查的任务（主要是 task_type=3）
        防止任务已经满足条件但不再进入待处理列表，导致状态无法提升到 4
        """
        try:
            processing_map = self._current_processing_map()
            query = """
                SELECT id as task_id, task_name, task_type
                FROM call_tasks
                WHERE task_type = 3
                ORDER BY id DESC
                LIMIT %s
            """
            tasks = execute_query(query, (limit,))
            refresh_tasks = [
                task for task in tasks
                if task['task_id'] not in processing_map
            ]
            if refresh_tasks:
                logger.info(f"获取到 {len(refresh_tasks)} 个待状态兜底检查的任务: {[t['task_id'] for t in refresh_tasks]}")
            return refresh_tasks
        except Exception as e:
            logger.error(f"获取状态兜底任务失败: {str(e)}")
            return []
    
    def diagnose_task(self, task_id: int) -> Dict[str, Any]:
        """
        诊断任务为什么没有被处理
        
        返回诊断信息，包括：
        - 任务基本信息
        - 是否符合处理条件
        - 不符合的原因
        """
        try:
            # 查询任务信息
            task_query = """
                SELECT id, task_name, task_type, job_group_id
                FROM call_tasks
                WHERE id = %s
            """
            task_result = execute_query(task_query, (task_id,))
            
            if not task_result:
                return {
                    "status": "error",
                    "message": "任务不存在",
                    "task_id": task_id
                }
            
            task_info = task_result[0]
            task_type = task_info['task_type']
            job_group_id = task_info.get('job_group_id')
            
            # 检查是否在处理中
            processing_map = self._current_processing_map()
            is_processing = task_id in processing_map
            
            # 检查是否符合处理条件
            reasons = []
            can_process = True
            
            # 检查 task_type
            if task_type not in [2, 3]:
                can_process = False
                reasons.append(f"任务状态为 {task_type}，不是待处理状态（需要 2 或 3）")
            
            # 检查 job_group_id
            if not job_group_id or job_group_id == '':
                can_process = False
                reasons.append("任务没有 job_group_id")
            
            # 检查是否在处理中
            if is_processing:
                can_process = False
                reasons.append("任务正在处理中（可能被其他进程处理）")
            
            # 统计任务记录情况
            stats_query = """
                SELECT 
                    COUNT(*) as total_leads,
                    SUM(CASE WHEN call_job_id IS NOT NULL AND call_job_id != '' THEN 1 ELSE 0 END) as has_job_id,
                    SUM(CASE WHEN call_status IS NOT NULL AND call_status != '' THEN 1 ELSE 0 END) as has_status,
                    SUM(CASE WHEN leads_follow_id IS NOT NULL THEN 1 ELSE 0 END) as has_follow
                FROM leads_task_list
                WHERE task_id = %s
            """
            stats_result = execute_query(stats_query, (task_id,))
            stats = stats_result[0] if stats_result else {}
            
            total_leads = stats.get('total_leads', 0) or 0
            has_job_id = stats.get('has_job_id', 0) or 0
            has_status = stats.get('has_status', 0) or 0
            has_follow = stats.get('has_follow', 0) or 0
            
            # 对于 task_type=3，检查是否有未完成记录
            if task_type == 3:
                missing_status = has_job_id - has_status
                missing_follow = has_job_id - has_follow
                
                if missing_status == 0 and missing_follow == 0:
                    can_process = False
                    reasons.append("所有记录都已完成（有 call_status 和 leads_follow_id）")
            
            return {
                "status": "success",
                "task_id": task_id,
                "task_name": task_info['task_name'],
                "task_type": task_type,
                "job_group_id": job_group_id,
                "can_process": can_process,
                "is_processing": is_processing,
                "reasons": reasons,
                "stats": {
                    "total_leads": total_leads,
                    "has_job_id": has_job_id,
                    "has_status": has_status,
                    "has_follow": has_follow,
                    "missing_job_id": total_leads - has_job_id,
                    "missing_status": has_job_id - has_status,
                    "missing_follow": has_job_id - has_follow
                }
            }
        except Exception as e:
            logger.error(f"诊断任务失败: task_id={task_id}, error={str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "task_id": task_id
            }
    
    def mark_task_processing(self, task_id: int):
        """标记任务为处理中"""
        start_time = time.time()
        redis_client = self._get_redis_client()
        if redis_client:
            try:
                redis_client.hset(self._redis_processing_key, task_id, start_time)
                # 设置一个较长的过期时间，避免 hash 永久占用（后续有操作会不断刷新）
                redis_client.expire(self._redis_processing_key, max(self._processing_timeout * 2, 600))
                logger.info(f"[Redis] 标记任务 {task_id} 为处理中")
            except Exception as e:
                logger.warning(f"写入 Redis 处理中任务失败，回退到进程内存: task_id={task_id}, error={str(e)}")
        self._processing_tasks.add(task_id)
        self._processing_start_time[task_id] = start_time
        logger.info(f"标记任务 {task_id} 为处理中")
    
    def mark_task_completed(self, task_id: int):
        """标记任务处理完成"""
        redis_client = self._get_redis_client()
        if redis_client:
            try:
                redis_client.hdel(self._redis_processing_key, task_id)
                logger.info(f"[Redis] 标记任务 {task_id} 处理完成")
            except Exception as e:
                logger.warning(f"从 Redis 移除处理中任务失败: task_id={task_id}, error={str(e)}")
        self._processing_tasks.discard(task_id)
        self._processing_start_time.pop(task_id, None)
        logger.info(f"标记任务 {task_id} 处理完成")
    
    def _cleanup_timeout_tasks(self):
        """清理超时的处理中任务"""
        current_time = time.time()
        processing_map = self._current_processing_map()
        timeout_tasks = [
            task_id for task_id, start_time in processing_map.items()
            if current_time - start_time > self._processing_timeout
        ]
        redis_client = self._get_redis_client()
        for task_id in timeout_tasks:
            elapsed_time = current_time - processing_map.get(task_id, current_time)
            logger.warning(f"任务 {task_id} 处理超时（已处理 {elapsed_time:.1f} 秒，超过 {self._processing_timeout} 秒），自动清除处理状态")
            if redis_client:
                try:
                    redis_client.hdel(self._redis_processing_key, task_id)
                    logger.info(f"[Redis] 超时清除任务 {task_id} 的处理中状态")
                except Exception as e:
                    logger.warning(f"从 Redis 清除任务 {task_id} 处理中状态失败: {str(e)}")
            self._processing_tasks.discard(task_id)
            self._processing_start_time.pop(task_id, None)
    
    def _get_redis_client(self):
        if self._redis_client is not None:
            return self._redis_client
        try:
            import redis
        except ImportError:
            logger.warning("未安装 redis 库，自动化监控将使用进程内存作为锁")
            self._redis_client = None
            return None
        
        redis_host = os.getenv('REDIS_HOST', 'localhost')
        redis_port = int(os.getenv('REDIS_PORT', '6379'))
        redis_db = int(os.getenv('REDIS_DB', '0'))
        redis_password = os.getenv('REDIS_PASSWORD', '')
        
        try:
            if redis_password:
                client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password,
                    decode_responses=True
                )
            else:
                client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    decode_responses=True
                )
            client.ping()
            self._redis_client = client
            logger.info("AutoTaskMonitor 已启用 Redis 作为分布式锁")
        except Exception as e:
            logger.warning(f"连接 Redis 失败，使用进程内存作为锁: {str(e)}")
            self._redis_client = None
        return self._redis_client
    
    def _current_processing_map(self) -> Dict[int, float]:
        redis_client = self._get_redis_client()
        if redis_client:
            try:
                raw_data = redis_client.hgetall(self._redis_processing_key)
                processing_map: Dict[int, float] = {}
                for task_id_str, start_time_str in raw_data.items():
                    try:
                        processing_map[int(task_id_str)] = float(start_time_str)
                    except (TypeError, ValueError):
                        continue
                # 更新本地缓存，方便诊断函数使用
                self._processing_tasks = set(processing_map.keys())
                self._processing_start_time = processing_map.copy()
                return processing_map
            except Exception as e:
                logger.warning(f"从 Redis 获取处理中任务失败，回退至进程内缓存: {str(e)}")
        return self._processing_start_time.copy()
    
    def check_and_update_task_status(self, task_id: int) -> Dict[str, Any]:
        """
        检查并更新任务状态
        
        根据 leads_task_list 中的数据，判断任务是否完成：
        - 如果所有已外呼的记录都有 call_status，则更新 task_type = 3
        - 如果所有需要创建跟进记录的任务（call_status 为最终状态 'Succeeded' 或 'Failed'）都已创建跟进记录，则更新 task_type = 4
        """
        try:
            # 查询任务信息
            task_query = """
                SELECT id, task_name, task_type
                FROM call_tasks
                WHERE id = %s
            """
            task_result = execute_query(task_query, (task_id,))
            
            if not task_result:
                return {"status": "error", "message": "任务不存在"}
            
            task_info = task_result[0]
            current_task_type = task_info['task_type']
            
            # 统计已外呼的记录
            stats_query = """
                SELECT 
                    COUNT(*) as total_called,
                    SUM(CASE WHEN call_status IS NOT NULL AND call_status != '' THEN 1 ELSE 0 END) as has_status,
                    SUM(CASE WHEN leads_follow_id IS NOT NULL THEN 1 ELSE 0 END) as has_follow,
                    SUM(CASE WHEN is_interested IS NOT NULL THEN 1 ELSE 0 END) as has_interest
                FROM leads_task_list
                WHERE task_id = %s
            """
            stats_result = execute_query(stats_query, (task_id,))
            
            if not stats_result:
                return {"status": "success", "message": "暂无数据"}
            
            stats = stats_result[0]
            total_called = stats.get('total_called', 0) or 0
            has_status = stats.get('has_status', 0) or 0
            has_follow = stats.get('has_follow', 0) or 0
            has_interest = stats.get('has_interest', 0) or 0
            
            # 统计需要创建跟进记录的记录数（call_status 为最终状态的记录）
            final_status_query = """
                SELECT 
                    COUNT(*) as total_final_status,
                    SUM(CASE WHEN leads_follow_id IS NOT NULL THEN 1 ELSE 0 END) as has_follow_final
                FROM leads_task_list
                WHERE task_id = %s
                  AND call_status IN ('Succeeded', 'Failed')
            """
            final_status_result = execute_query(final_status_query, (task_id,))
            total_final_status = final_status_result[0]['total_final_status'] if final_status_result and final_status_result[0].get('total_final_status') else 0
            has_follow_final = final_status_result[0]['has_follow_final'] if final_status_result and final_status_result[0].get('has_follow_final') else 0
            
            # 判断是否需要更新状态
            updated = False
            
            # 如果所有已外呼的记录都有 call_status，且当前状态 < 3，则更新为 3
            if total_called > 0 and has_status == total_called and current_task_type < 3:
                update_query = """
                    UPDATE call_tasks
                    SET task_type = 3
                    WHERE id = %s
                """
                execute_update(update_query, (task_id,))
                updated = True
                logger.info(f"任务 {task_id} 状态更新为 3（外呼完成）")
            
            # 如果所有需要创建跟进记录的任务（call_status 为最终状态）都已创建跟进记录，且当前状态 < 4，则更新为 4
            # 重要：只统计 call_status 为最终状态（'Succeeded' 或 'Failed'）的记录
            logger.info(f"任务 {task_id} 状态检查: total_final_status={total_final_status}, has_follow_final={has_follow_final}, current_task_type={current_task_type}")
            
            if total_final_status > 0 and has_follow_final == total_final_status and current_task_type < 4:
                update_query = """
                    UPDATE call_tasks
                    SET task_type = 4
                    WHERE id = %s
                """
                execute_update(update_query, (task_id,))
                updated = True
                logger.info(f"任务 {task_id} 状态更新为 4（跟进完成，所有最终状态的记录都已创建跟进记录）")
            elif total_final_status > 0:
                logger.info(f"任务 {task_id} 未更新为 4: total_final_status={total_final_status}, has_follow_final={has_follow_final}, current_task_type={current_task_type}")
            elif total_final_status == 0:
                # 如果没有最终状态的记录，检查是否所有记录都有跟进记录（可能是其他状态）
                all_follow_query = """
                    SELECT 
                        COUNT(*) as total_with_job_id,
                        SUM(CASE WHEN leads_follow_id IS NOT NULL THEN 1 ELSE 0 END) as has_follow_all
                    FROM leads_task_list
                    WHERE task_id = %s
                """
                all_follow_result = execute_query(all_follow_query, (task_id,))
                total_records = all_follow_result[0]['total_with_job_id'] if all_follow_result and all_follow_result[0].get('total_with_job_id') else 0
                has_follow_all = all_follow_result[0]['has_follow_all'] if all_follow_result and all_follow_result[0].get('has_follow_all') else 0
                logger.info(f"任务 {task_id} 没有最终状态的记录，检查所有记录: total_records={total_records}, has_follow_all={has_follow_all}")
            
            return {
                "status": "success",
                "updated": updated,
                "stats": {
                    "total_called": total_called,
                    "has_status": has_status,
                    "has_follow": has_follow,
                    "has_interest": has_interest,
                    "total_final_status": total_final_status,
                    "has_follow_final": has_follow_final
                }
            }
        except Exception as e:
            logger.error(f"检查任务状态失败: task_id={task_id}, error={str(e)}")
            return {"status": "error", "message": str(e)}


# 全局监控器实例
auto_task_monitor = AutoTaskMonitor()

