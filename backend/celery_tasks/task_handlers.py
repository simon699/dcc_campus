"""
具体任务处理函数
"""
import logging
import json
import sys
import os
import time
from datetime import datetime
from typing import Dict, Any
from celery import Task
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from celery_app import celery_app
from database.db import execute_query, execute_update
from openAPI.ali_bailian_api import ali_bailian_api

logger = logging.getLogger(__name__)


class CallbackTask(Task):
    """带回调的任务基类"""
    def on_success(self, retval, task_id, args, kwargs):
        logger.info(f"任务 {task_id} 执行成功")
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"任务 {task_id} 执行失败: {str(exc)}")


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def sync_call_job_ids(self, task_id: int, job_group_id: str):
    """
    同步 call_job_id 从 job_group
    """
    try:
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from query_jobs_with_result import Sample as QueryJobsWithResultSample
        from api.auto_call_utils import safe_getattr

        # 先获取第一页，确定总页数
        page_size = 100
        page = 1
        try:
            jobs_group_data = QueryJobsWithResultSample.main(
                [],
                job_group_id=job_group_id,
                page_number=page,
                page_size=page_size
            )
        except Exception as e:
            logger.error(f"调用 list_jobs_by_group 第{page}页失败: {str(e)}")
            raise self.retry(exc=e)

        jobs_list = safe_getattr(jobs_group_data, 'list', 'List', default=None)
        total_jobs = safe_getattr(jobs_group_data, 'row_count', 'TotalCount', default=0) or 0
        total_pages = (total_jobs + page_size - 1) // page_size if page_size > 0 else 0

        def collect_updates_from_jobs(jobs_page_list):
            updates_local = []
            for job in (jobs_page_list or []):
                job_id = safe_getattr(job, "id", default=None)
                latest_task = safe_getattr(job, 'latest_task', default=None)
                contacts = safe_getattr(latest_task, 'contact', default=None)
                phone_numbers = []
                if contacts:
                    # contacts 可能是单个对象或列表
                    if isinstance(contacts, (list, tuple)):
                        # 如果是列表，遍历每个 contact
                        for contact in contacts:
                            phone = safe_getattr(contact, 'phone_number', 'PhoneNumber', 'phoneNumber', default=None)
                            if phone:
                                phone_numbers.append(phone)
                    else:
                        # 如果是单个对象，直接获取 phone_number
                        phone = safe_getattr(contacts, 'phone_number', 'PhoneNumber', 'phoneNumber', default=None)
                        if phone:
                            phone_numbers.append(phone)
                
                if job_id and phone_numbers:
                    for phone in phone_numbers:
                        updates_local.append((job_id, phone))
            return updates_local

        all_updates = []
        if jobs_list:
            all_updates.extend(collect_updates_from_jobs(jobs_list))

        # 遍历剩余页
        for page in range(2, total_pages + 1):
            try:
                jobs_group_data = QueryJobsWithResultSample.main(
                    [],
                    job_group_id=job_group_id,
                    page_number=page,
                    page_size=page_size
                )
                jobs_list = safe_getattr(jobs_group_data, 'list', 'List', default=None)
                if jobs_list:
                    all_updates.extend(collect_updates_from_jobs(jobs_list))
            except Exception as e:
                logger.warning(f"调用 list_jobs_by_group 第{page}页失败: {str(e)}")
                continue

        # 批量更新 call_job_id
        matched_count = 0
        if all_updates:
            for job_id, phone in all_updates:
                try:
                    affected_rows = execute_update(
                        """
                        UPDATE leads_task_list
                        SET call_job_id = %s
                        WHERE task_id = %s 
                          AND leads_phone = %s 
                          AND (call_job_id IS NULL OR call_job_id = '')
                        """,
                        (job_id, task_id, phone)
                    )
                    if affected_rows > 0:
                        matched_count += affected_rows
                except Exception as e:
                    logger.warning(f"更新 call_job_id 失败: task_id={task_id}, phone={phone}, error={str(e)}")

        logger.info(f"同步 call_job_id 完成: task_id={task_id}, 更新了 {matched_count} 条记录")
        return {
            "status": "success", 
            "updated_count": matched_count
        }
    
    except Exception as e:
        logger.error(f"同步 call_job_id 失败: task_id={task_id}, error={str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=30)
def download_recording(self, task_id: str, call_job_id: str):
    """
    下载录音URL
    """
    try:
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from download_recording import Sample as DownloadRecordingSample

        new_url = DownloadRecordingSample.main([], task_id=task_id)
        if new_url:
            # 需要根据 call_job_id 更新，但这里只有 task_id，需要查询
            execute_update(
                """
                UPDATE leads_task_list
                SET recording_url = %s
                WHERE call_task_id = %s
                """,
                (new_url, task_id)
            )
            logger.info(f"成功下载录音URL: call_task_id={task_id}")
            return {"status": "success", "recording_url": new_url}
        else:
            logger.warning(f"下载录音URL失败: call_task_id={task_id}, 返回值为None")
            return {"status": "failed", "message": "录音URL为空"}
    
    except Exception as e:
        logger.error(f"下载录音URL失败: call_task_id={task_id}, error={str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def generate_follow(self, call_job_id: str):
    """
    生成跟进记录（调用AI分析）
    """
    try:
        # 检查是否已存在跟进记录
        check_query = """
            SELECT is_interested, leads_follow_id
            FROM leads_task_list
            WHERE call_job_id = %s
        """
        guard_rows = execute_query(check_query, (call_job_id,))
        
        if not guard_rows:
            logger.warning(f"未找到 call_job_id={call_job_id} 的记录")
            return {"status": "failed", "message": "记录不存在"}
        
        if guard_rows[0].get('is_interested') is not None or guard_rows[0].get('leads_follow_id') is not None:
            logger.info(f"call_job_id={call_job_id} 已有跟进记录，跳过")
            return {"status": "skipped", "message": "已有跟进记录"}
        
        # 调用 get_leads_follow_id 函数
        from api.auto_call_api import get_leads_follow_id
        result = get_leads_follow_id(call_job_id, force=False, dry_run=False)
        
        logger.info(f"生成跟进记录完成: call_job_id={call_job_id}")
        return {"status": "success", "result": result}
    
    except Exception as e:
        logger.error(f"生成跟进记录失败: call_job_id={call_job_id}, error={str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=120)
def query_task_execution(self, task_id: int):
    """
    查询任务执行状态并更新
    """
    try:
        # 获取任务信息
        task_info_rows = execute_query(
            """
            SELECT id, task_name, task_type, job_group_id
            FROM call_tasks
            WHERE id = %s
            """,
            (task_id,)
        )
        if not task_info_rows:
            logger.warning(f"未找到 task_id={task_id} 的任务")
            return {"status": "failed", "message": "任务不存在"}
        
        task_info = task_info_rows[0]

        # 延用请求模型并触发核心查询
        from api.auto_call_api import QueryTaskExecutionRequest, _query_task_execution_core

        # 先查询总数，确定需要处理多少页
        # 处理 call_status 为空或 call_conversation 为空的记录，确保能获取到完整的通话数据
        count_query = """
            SELECT COUNT(*) as total
            FROM leads_task_list 
            WHERE task_id = %s 
              AND call_job_id IS NOT NULL 
              AND call_job_id != ''
              AND ((call_status IS NULL OR call_status = '') 
                   OR (call_conversation IS NULL OR call_conversation = ''))
        """
        count_result = execute_query(count_query, (task_id,))
        total_jobs = count_result[0]['total'] if count_result and count_result[0].get('total') else 0
        
        if total_jobs == 0:
            # 检查是否有 call_job_id 但 call_status 仍为空的记录（可能是中间状态 Executing 没有被保存）
            # 这些记录需要继续轮询，直到状态变为最终状态
            pending_status_query = """
                SELECT COUNT(*) as total
                FROM leads_task_list 
                WHERE task_id = %s 
                  AND call_job_id IS NOT NULL 
                  AND call_job_id != ''
                  AND (call_status IS NULL OR call_status = '')
            """
            pending_status_result = execute_query(pending_status_query, (task_id,))
            pending_status_total = pending_status_result[0]['total'] if pending_status_result and pending_status_result[0].get('total') else 0
            
            if pending_status_total > 0:
                logger.info(f"任务 {task_id} 还有 {pending_status_total} 条记录 call_job_id 不为空但 call_status 为空（可能是中间状态未被保存），需要继续轮询，不标记任务完成")
                # 不标记为完成，让监控任务继续轮询
                return {
                    "status": "success",
                    "message": f"还有 {pending_status_total} 条记录需要继续轮询获取 call_status",
                    "total_jobs": 0,
                    "pending_status_total": pending_status_total
                }
            
            # 检查是否有 call_status 为最终状态但缺少跟进记录的情况（只处理 is_interested IS NULL 的记录）
            # 重要：只处理 call_status 为最终状态（'Succeeded' 或 'Failed'）的记录
            follow_count_query = """
                SELECT COUNT(*) as total
                FROM leads_task_list 
                WHERE task_id = %s 
                  AND call_status IN ('Succeeded', 'Failed')
                  AND leads_follow_id IS NULL
                  AND is_interested IS NULL
            """
            follow_count_result = execute_query(follow_count_query, (task_id,))
            follow_total = follow_count_result[0]['total'] if follow_count_result and follow_count_result[0].get('total') else 0
            
            if follow_total > 0:
                logger.info(f"任务 {task_id} 没有 call_status 为空的记录，但有 {follow_total} 条记录缺少跟进记录，将触发跟进记录创建")
                # 触发跟进记录创建任务
                from celery_tasks.task_handlers import create_leads_follow, create_leads_follow_by_task_and_phone
                
                # 分批获取需要创建跟进记录的记录列表（每批1000条）
                batch_size = 1000
                total_triggered = 0
                
                for offset in range(0, follow_total, batch_size):
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
                            
                            if call_job_id:
                                try:
                                    create_leads_follow.delay(call_job_id)
                                    total_triggered += 1
                                except Exception as e:
                                    logger.warning(f"触发跟进记录创建任务失败: call_job_id={call_job_id}, error={str(e)}")
                            elif task_id_record and leads_phone:
                                try:
                                    create_leads_follow_by_task_and_phone.delay(task_id_record, leads_phone)
                                    total_triggered += 1
                                except Exception as e:
                                    logger.warning(f"触发跟进记录创建任务失败: task_id={task_id_record}, leads_phone={leads_phone}, error={str(e)}")
                    
                    # 如果这批记录数少于 batch_size，说明已经处理完所有记录
                    if len(follow_records) < batch_size:
                        break
                
                logger.info(f"已触发 {total_triggered} 个跟进记录创建任务（共 {follow_total} 条需要处理）")
                
                # 等待一小段时间，让跟进记录创建任务开始处理
                wait_time = min(5, follow_total / 100)  # 等待时间：最多5秒，或根据任务数量计算
                logger.info(f"等待 {wait_time:.1f} 秒，让跟进记录创建任务开始处理...")
                time.sleep(wait_time)
                
                # 检查跟进记录创建情况
                check_follow_query = """
                    SELECT COUNT(*) as total
                    FROM leads_task_list 
                    WHERE task_id = %s 
                      AND call_status IN ('Succeeded', 'Failed')
                      AND leads_follow_id IS NULL
                      AND is_interested IS NULL
                """
                check_follow_result = execute_query(check_follow_query, (task_id,))
                remaining_follow = check_follow_result[0]['total'] if check_follow_result and check_follow_result[0].get('total') else 0
                
                if remaining_follow > 0:
                    logger.info(f"等待后仍有 {remaining_follow} 条记录缺少跟进记录，不标记任务完成，等待监控任务下次继续检查")
                    # 不标记为完成，等待跟进记录创建完成
                    return {
                        "status": "success", 
                        "message": f"已触发 {total_triggered} 个跟进记录创建任务，仍有 {remaining_follow} 条待处理", 
                        "total_jobs": 0,
                        "triggered_follow_tasks": total_triggered,
                        "total_follow_needed": follow_total,
                        "remaining_follow": remaining_follow
                    }
                else:
                    logger.info(f"等待后所有跟进记录已创建完成，继续检查任务状态")
                    # 继续检查任务是否完成
            
            logger.info(f"任务 {task_id} 没有需要处理的记录（call_job_id为空或call_status已有值，且跟进记录已完整）")
            from api.auto_task_monitor import auto_task_monitor
            auto_task_monitor.mark_task_completed(task_id)
            return {"status": "success", "message": "没有需要处理的记录", "total_jobs": 0}
        
        # 分页处理所有数据
        page_size = 200
        total_pages = (total_jobs + page_size - 1) // page_size
        logger.info(f"任务 {task_id} 共有 {total_jobs} 条记录，需要处理 {total_pages} 页")
        
        total_updated = 0
        total_errors = 0
        all_results = []
        failed_pages = []  # 记录失败的页码，用于后续重试
        
        try:
            for page in range(1, total_pages + 1):
                logger.info(f"处理任务 {task_id} 第 {page}/{total_pages} 页")
                
                req = QueryTaskExecutionRequest(
                    task_id=task_id,
                    page=page,
                    page_size=page_size,
                    skip_recording=True,
                    only_followed=False,
                    interest=None,
                    apply_update=True
                )
                
                # 为每一页添加重试机制（最多重试3次）
                page_success = False
                max_page_retries = 3
                page_retry_delay = 5  # 重试延迟（秒）
                
                for retry_count in range(max_page_retries):
                    try:
                        result = _query_task_execution_core(
                            request=req,
                            task_info=task_info,
                            job_group_status=None
                        )
                        
                        if result and result.get('data'):
                            updated_count = result['data'].get('updated_count', 0)
                            error_count = result['data'].get('error_count', 0)
                            total_updated += updated_count
                            total_errors += error_count
                            logger.info(f"第 {page}/{total_pages} 页处理完成: 更新 {updated_count} 条，错误 {error_count} 条")
                        
                        # 只保存第一页的结果用于返回
                        if page == 1:
                            all_results = result
                        
                        page_success = True
                        break  # 成功则跳出重试循环
                        
                    except Exception as page_e:
                        error_msg = str(page_e)
                        error_type = type(page_e).__name__
                        error_type_str = str(type(page_e))
                        
                        # 判断是否为网络错误（应该重试）
                        is_network_error = (
                            'Connection' in error_msg or 
                            'RemoteDisconnected' in error_msg or
                            'timeout' in error_msg.lower() or
                            '连接' in error_msg or
                            '网络' in error_msg or
                            'Connection aborted' in error_msg
                        )
                        
                        # 判断是否为业务错误（不应该重试）
                        # 检查 HTTPException（可能被包装成其他类型）
                        is_http_exception = (
                            'HTTPException' in error_type or 
                            'HTTPException' in error_type_str or
                            'fastapi' in error_type_str.lower()
                        )
                        
                        is_business_error = (
                            is_http_exception or
                            '4008' in error_msg or 
                            '没有已分配的外呼任务' in error_msg or
                            '没有有效的call_job_id' in error_msg or
                            'code": 4008' in error_msg or
                            'code": 4009' in error_msg
                        )
                        
                        if is_business_error:
                            # 业务错误不重试，直接跳过
                            logger.warning(f"处理第 {page}/{total_pages} 页失败（业务错误，不重试）: {error_msg}")
                            total_errors += 1
                            break
                        
                        if retry_count < max_page_retries - 1:
                            # 还有重试机会
                            logger.warning(f"处理第 {page}/{total_pages} 页失败（第 {retry_count + 1}/{max_page_retries} 次尝试）: {error_msg}，{page_retry_delay}秒后重试...")
                            time.sleep(page_retry_delay)
                        else:
                            # 重试次数用完
                            logger.error(f"处理第 {page}/{total_pages} 页失败（已重试 {max_page_retries} 次）: {error_msg}")
                            total_errors += 1
                            failed_pages.append(page)
                
                # 如果页面处理失败，记录但继续处理下一页
                if not page_success:
                    logger.warning(f"第 {page}/{total_pages} 页处理失败，已记录到失败列表，将继续处理其他页")
            
            # 如果有失败的页，尝试重试一次（使用更长的延迟）
            if failed_pages:
                logger.info(f"检测到 {len(failed_pages)} 个失败的页: {failed_pages}，将进行最终重试...")
                time.sleep(10)  # 等待10秒后再重试，给网络恢复时间
                
                retry_failed_pages = []
                for page in failed_pages:
                    logger.info(f"重试处理任务 {task_id} 第 {page}/{total_pages} 页")
                    
                    req = QueryTaskExecutionRequest(
                        task_id=task_id,
                        page=page,
                        page_size=page_size,
                        skip_recording=True,
                        only_followed=False,
                        interest=None,
                        apply_update=True
                    )
                    
                    try:
                        result = _query_task_execution_core(
                            request=req,
                            task_info=task_info,
                            job_group_status=None
                        )
                        
                        if result and result.get('data'):
                            updated_count = result['data'].get('updated_count', 0)
                            error_count = result['data'].get('error_count', 0)
                            total_updated += updated_count
                            total_errors += error_count
                            logger.info(f"重试成功：第 {page}/{total_pages} 页处理完成: 更新 {updated_count} 条，错误 {error_count} 条")
                        else:
                            retry_failed_pages.append(page)
                            
                    except Exception as retry_e:
                        error_msg = str(retry_e)
                        logger.error(f"重试失败：处理第 {page}/{total_pages} 页仍然失败: {error_msg}")
                        retry_failed_pages.append(page)
                
                if retry_failed_pages:
                    logger.warning(f"最终仍有 {len(retry_failed_pages)} 个页处理失败: {retry_failed_pages}")
                    failed_pages = retry_failed_pages  # 更新失败列表为仍然失败的页
                else:
                    logger.info(f"所有失败的页在重试后都成功处理了")
                    failed_pages = []  # 清空失败列表
            
            logger.info(f"查询任务执行状态完成: task_id={task_id}, 总共处理 {total_pages} 页，更新 {total_updated} 条，错误 {total_errors} 条")
            if failed_pages:
                logger.warning(f"仍有 {len(failed_pages)} 个页处理失败: {failed_pages}，这些页的数据可能未更新")
            
            # 如果查询到了记录但更新数为0，说明可能有中间状态（如 Executing）的记录被跳过了
            # 需要继续轮询，不标记任务完成
            if total_jobs > 0 and total_updated == 0:
                logger.info(f"任务 {task_id} 查询到 {total_jobs} 条记录但更新数为0，可能是中间状态（如 Executing）被跳过，需要继续轮询，不标记任务完成")
                # 不标记为完成，让监控任务继续轮询
                return {
                    "status": "success",
                    "message": f"查询到 {total_jobs} 条记录但更新数为0，可能是中间状态被跳过，需要继续轮询",
                    "total_jobs": total_jobs,
                    "total_updated": total_updated,
                    "total_pages": total_pages,
                    "failed_pages": failed_pages if failed_pages else None
                }
            
            # 处理完 call_status 后，检查是否需要创建跟进记录或同步 is_interested（只处理 is_interested IS NULL 的记录）
            # 重要：只处理 call_status 为最终状态（'Succeeded' 或 'Failed'）的记录
            follow_count_query = """
                SELECT COUNT(*) as total
                FROM leads_task_list 
                WHERE task_id = %s 
                  AND call_status IN ('Succeeded', 'Failed')
                  AND leads_follow_id IS NULL
                  AND is_interested IS NULL
            """
            follow_count_result = execute_query(follow_count_query, (task_id,))
            follow_total = follow_count_result[0]['total'] if follow_count_result and follow_count_result[0].get('total') else 0
            
            # 检查是否有跟进记录但 is_interested 为 NULL 的情况（需要同步）
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
            
            # 如果有需要同步 is_interested 的记录，设置为默认值 0（因为无法从跟进记录推断）
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
            
            if follow_total > 0:
                logger.info(f"任务 {task_id} 处理完 call_status 后，发现还有 {follow_total} 条记录缺少跟进记录，将触发跟进记录创建")
                # 触发跟进记录创建任务
                from celery_tasks.task_handlers import create_leads_follow, create_leads_follow_by_task_and_phone
                
                # 分批获取需要创建跟进记录的记录列表（每批1000条）
                batch_size = 1000
                total_triggered = 0
                
                for offset in range(0, follow_total, batch_size):
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
                            
                            if call_job_id:
                                try:
                                    create_leads_follow.delay(call_job_id)
                                    total_triggered += 1
                                except Exception as e:
                                    logger.warning(f"触发跟进记录创建任务失败: call_job_id={call_job_id}, error={str(e)}")
                            elif task_id_record and leads_phone:
                                try:
                                    create_leads_follow_by_task_and_phone.delay(task_id_record, leads_phone)
                                    total_triggered += 1
                                except Exception as e:
                                    logger.warning(f"触发跟进记录创建任务失败: task_id={task_id_record}, leads_phone={leads_phone}, error={str(e)}")
                    
                    # 如果这批记录数少于 batch_size，说明已经处理完所有记录
                    if len(follow_records) < batch_size:
                        break
                
                logger.info(f"已触发 {total_triggered} 个跟进记录创建任务（共 {follow_total} 条需要处理）")
                
                # 等待一小段时间，让跟进记录创建任务开始处理
                wait_time = min(5, follow_total / 100)  # 等待时间：最多5秒，或根据任务数量计算
                logger.info(f"等待 {wait_time:.1f} 秒，让跟进记录创建任务开始处理...")
                time.sleep(wait_time)
                
                # 检查跟进记录创建情况
                check_follow_query = """
                    SELECT COUNT(*) as total
                    FROM leads_task_list 
                    WHERE task_id = %s 
                      AND call_status IN ('Succeeded', 'Failed')
                      AND leads_follow_id IS NULL
                      AND is_interested IS NULL
                """
                check_follow_result = execute_query(check_follow_query, (task_id,))
                remaining_follow = check_follow_result[0]['total'] if check_follow_result and check_follow_result[0].get('total') else 0
                
                if remaining_follow > 0:
                    logger.info(f"等待后仍有 {remaining_follow} 条记录缺少跟进记录，不标记任务完成，等待监控任务下次继续检查")
                    # 不标记为完成，等待跟进记录创建完成，让监控任务下次继续检查
                    return {
                        "status": "success", 
                        "message": f"已处理 call_status，并触发 {total_triggered} 个跟进记录创建任务，仍有 {remaining_follow} 条待处理",
                        "result": all_results, 
                        "total_pages": total_pages, 
                        "total_updated": total_updated,
                        "triggered_follow_tasks": total_triggered,
                        "total_follow_needed": follow_total,
                        "remaining_follow": remaining_follow,
                        "failed_pages": failed_pages if failed_pages else None
                    }
                else:
                    logger.info(f"等待后所有跟进记录已创建完成，继续检查 is_interested")
            
            # 检查是否所有记录都有 is_interested（不为 NULL）
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
            
            if missing_interest > 0:
                logger.info(f"任务 {task_id} 还有 {missing_interest} 条记录的 is_interested 为 NULL，将处理这些记录")
                
                # 检查这些记录是否有跟进记录
                # 如果有跟进记录但 is_interested 为 NULL，设置为默认值 0
                sync_interest_query2 = """
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
                sync_interest_result2 = execute_query(sync_interest_query2, (task_id,))
                sync_interest_total2 = sync_interest_result2[0]['total'] if sync_interest_result2 and sync_interest_result2[0].get('total') else 0
                
                if sync_interest_total2 > 0:
                    logger.info(f"任务 {task_id} 发现 {sync_interest_total2} 条记录有跟进记录但 is_interested 为 NULL，将设置为默认值 0")
                    sync_update_query2 = """
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
                        execute_update(sync_update_query2, (task_id,))
                        logger.info(f"已更新 {sync_interest_total2} 条记录的 is_interested 为默认值 0")
                    except Exception as e:
                        logger.warning(f"更新 is_interested 失败: {str(e)}")
                
                # 检查是否还有缺少跟进记录的情况（这些记录的 is_interested 会在创建跟进记录时设置）
                missing_follow_with_null_interest_query = """
                    SELECT COUNT(*) as total
                    FROM leads_task_list 
                    WHERE task_id = %s 
                      AND call_job_id IS NOT NULL 
                      AND call_job_id != ''
                      AND call_status IN ('Succeeded', 'Failed')
                      AND leads_follow_id IS NULL
                      AND is_interested IS NULL
                """
                missing_follow_result = execute_query(missing_follow_with_null_interest_query, (task_id,))
                missing_follow_with_null = missing_follow_result[0]['total'] if missing_follow_result and missing_follow_result[0].get('total') else 0
                
                if missing_follow_with_null > 0:
                    logger.info(f"任务 {task_id} 还有 {missing_follow_with_null} 条记录缺少跟进记录且 is_interested 为 NULL，这些记录会在创建跟进记录时处理")
                
                # 重新检查是否还有 is_interested 为 NULL 的记录
                check_interest_result2 = execute_query(check_interest_query, (task_id,))
                remaining_missing_interest = check_interest_result2[0]['total'] if check_interest_result2 and check_interest_result2[0].get('total') else 0
                
                if remaining_missing_interest > 0:
                    logger.info(f"任务 {task_id} 处理后还有 {remaining_missing_interest} 条记录的 is_interested 为 NULL，不标记完成")
                    # 不标记为完成，让监控任务下次继续检查
                    return {
                        "status": "success", 
                        "message": f"还有 {remaining_missing_interest} 条记录的 is_interested 为 NULL",
                        "result": all_results, 
                        "total_pages": total_pages, 
                        "total_updated": total_updated,
                        "missing_interest": remaining_missing_interest,
                        "failed_pages": failed_pages if failed_pages else None
                    }
                else:
                    logger.info(f"任务 {task_id} 所有 is_interested 为 NULL 的记录已处理完成")
            
            # 所有记录都处理完（包括跟进记录和 is_interested），才标记任务完成
            logger.info(f"任务 {task_id} 所有记录都已处理完成（包括 call_status、跟进记录和 is_interested），标记任务完成")
            from api.auto_task_monitor import auto_task_monitor
            auto_task_monitor.mark_task_completed(task_id)
            
            # 更新返回结果中的统计信息
            if all_results and all_results.get('data'):
                all_results['data']['updated_count'] = total_updated
                all_results['data']['error_count'] = total_errors
                all_results['data']['total_jobs'] = total_jobs
            
            return {
                "status": "success", 
                "result": all_results, 
                "total_pages": total_pages, 
                "total_updated": total_updated,
                "failed_pages": failed_pages if failed_pages else None
            }
        except RuntimeError as e:
            # 捕获 signal 相关的错误，这通常不影响功能，只是警告
            if "signal only works in main thread" in str(e):
                logger.warning(f"task_id={task_id} 的 signal 错误（可忽略）: {str(e)}")
                return {"status": "success", "warning": "signal error ignored"}
            else:
                raise
        except Exception as e:
            # 捕获 HTTPException 和其他业务异常，避免重试无法 pickle 的异常
            error_type = type(e).__name__
            error_msg = str(e)
            
            # 如果是业务错误（如任务下没有已分配的外呼任务），直接返回失败，不重试
            if 'HTTPException' in error_type or '4008' in error_msg or '没有已分配的外呼任务' in error_msg:
                logger.warning(f"查询任务执行状态失败（业务错误，不重试）: task_id={task_id}, error={error_msg}")
                # 清除处理中状态，允许下次继续处理
                from api.auto_task_monitor import auto_task_monitor
                auto_task_monitor.mark_task_completed(task_id)
                return {"status": "failed", "message": error_msg, "task_id": task_id}
            
            # 其他错误才重试
            logger.error(f"查询任务执行状态失败: task_id={task_id}, error={error_msg}")
            raise self.retry(exc=e)
    
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # 如果是 HTTPException 或其他无法 pickle 的异常，直接返回失败
        if 'HTTPException' in error_type or 'UnpickleableExceptionWrapper' in error_type:
            logger.warning(f"查询任务执行状态失败（无法重试的异常）: task_id={task_id}, error={error_msg}")
            # 清除处理中状态，允许下次继续处理
            from api.auto_task_monitor import auto_task_monitor
            auto_task_monitor.mark_task_completed(task_id)
            return {"status": "failed", "message": error_msg, "task_id": task_id}
        
        logger.error(f"查询任务执行状态失败: task_id={task_id}, error={error_msg}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def create_leads_follow(self, call_job_id: str):
    """
    创建线索跟进记录
    """
    try:
        # 检查是否已存在跟进记录和 is_interested 状态
        check_query = """
            SELECT leads_follow_id, is_interested
            FROM leads_task_list 
            WHERE call_job_id = %s
        """
        follow_result = execute_query(check_query, (call_job_id,))
        
        if not follow_result:
            logger.warning(f"未找到call_job_id为{call_job_id}的记录")
            return {
                "status": "error",
                "code": 4001,
                "message": f"未找到call_job_id为{call_job_id}的记录"
            }
        
        # 检查 is_interested 是否已设置（不为 NULL）
        is_interested_value = follow_result[0].get('is_interested')
        if is_interested_value is not None:
            logger.info(f"任务 {call_job_id} 的 is_interested 已设置为 {is_interested_value}，跳过跟进记录创建")
            return {"status": "skipped", "message": f"is_interested 已设置（值为 {is_interested_value}），无需处理"}
        
        # 检查是否已存在跟进记录
        if follow_result[0].get('leads_follow_id') is not None:
            logger.info(f"任务 {call_job_id} 的leads_follow_id已存在，跳过跟进记录创建")
            return {"status": "skipped", "message": "跟进记录已存在"}
        
        # 1. 根据call_job_id查找leads_task_list中的call_conversation和leads_id
        query = """
            SELECT call_conversation, leads_id, leads_name, leads_phone, leads_follow_id, call_status, is_interested
            FROM leads_task_list 
            WHERE call_job_id = %s
        """
        
        result = execute_query(query, (call_job_id,))
        
        if not result:
            logger.warning(f"未找到call_job_id为{call_job_id}的记录")
            return {
                "status": "error",
                "code": 4001,
                "message": f"未找到call_job_id为{call_job_id}的记录"
            }
        
        task_data = result[0]
        call_conversation = task_data.get('call_conversation')
        leads_id = task_data.get('leads_id')
        leads_name = task_data.get('leads_name')
        leads_phone = task_data.get('leads_phone')
        leads_follow_id = task_data.get('leads_follow_id')
        call_status = task_data.get('call_status')
        is_interested_existing = task_data.get('is_interested')
        
        # 再次检查 is_interested（防止并发问题）
        if is_interested_existing is not None:
            logger.info(f"任务 {call_job_id} 的 is_interested 已设置为 {is_interested_existing}，跳过跟进记录创建")
            return {"status": "skipped", "message": f"is_interested 已设置（值为 {is_interested_existing}），无需处理"}
        
        # 检查leads_follow_id是否已存在
        if leads_follow_id is not None:
            return {
                "status": "error",
                "code": 4003,
                "message": f"call_job_id为{call_job_id}的记录已存在跟进记录，无需重复创建"
            }
        
        # 必须获取到 call_status 之后，才进行创建跟进记录
        if not call_status or call_status == '':
            logger.info(f"call_job_id={call_job_id} 没有 call_status，跳过跟进记录创建")
            return {
                "status": "error",
                "code": 4004,
                "message": f"call_job_id为{call_job_id}的记录尚未获取到call_status，暂不创建跟进记录"
            }
        
        # 重要：只有 call_status 为最终状态（'Succeeded' 或 'Failed'）时才创建跟进记录
        # 如果是中间状态（如 'Executing'），需要等待状态变为最终状态后再创建
        if call_status not in ('Succeeded', 'Failed'):
            logger.info(f"call_job_id={call_job_id} call_status={call_status} 不是最终状态，等待状态变为 Succeeded 或 Failed 后再创建跟进记录")
            return {
                "status": "success",
                "code": 200,
                "message": f"外呼状态为 {call_status}，等待状态变为最终状态（Succeeded 或 Failed）后再创建跟进记录",
                "data": {
                    "follow_id": None,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": None,
                    "is_interested": None,
                    "next_follow_time": None
                }
            }
        
        # 如果没有 call_conversation，根据 call_status 创建跟进记录
        if not call_conversation:
            # 情况B：call_conversation 为空但 call_status 有值（此时 call_status 必须是 Succeeded 或 Failed）
            # 重要：对于 call_status == 'Succeeded' 的情况，需要等待 call_conversation 获取到后再创建跟进记录
            # 因为 call_conversation 可能稍后才会从阿里云获取到
            if call_status == 'Succeeded':
                logger.info(f"call_job_id={call_job_id} call_status=Succeeded 但 call_conversation 为空，等待 call_conversation 获取到后再创建跟进记录")
                return {
                    "status": "success",
                    "code": 200,
                    "message": "外呼成功但通话记录尚未获取，等待通话记录获取后再创建跟进记录",
                    "data": {
                        "follow_id": None,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": None,
                        "is_interested": None,
                        "next_follow_time": None
                    }
                }
            elif call_status == 'Failed':
                leads_remark = "呼叫失败；"
                is_interested = 0
                next_follow_time = None
            else:
                # 理论上不应该到这里，因为前面已经检查了 call_status 必须是 Succeeded 或 Failed
                logger.warning(f"call_job_id={call_job_id} call_status={call_status} 不是预期的最终状态，跳过跟进记录创建")
                return {
                    "status": "success",
                    "code": 200,
                    "message": f"call_status={call_status} 不是预期的最终状态，跳过跟进记录创建",
                    "data": {
                        "follow_id": None,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": None,
                        "is_interested": None,
                        "next_follow_time": None
                    }
                }
            
            # 创建跟进记录（无 call_conversation 的情况，仅限 Failed 或其他非 Succeeded 状态）
            insert_query = """
                INSERT INTO dcc_leads_follow 
                (leads_id, follow_time, leads_remark, frist_follow_time, new_follow_time, next_follow_time)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            current_time = datetime.now()
            follow_id = execute_update(insert_query, (
                leads_id,
                current_time,
                leads_remark,
                current_time,
                current_time,
                next_follow_time
            ))
            
            # 更新 leads_task_list 表中的 leads_follow_id 和 is_interested（只更新 is_interested IS NULL 的记录）
            update_query = """
                UPDATE leads_task_list 
                SET leads_follow_id = %s, is_interested = %s
                WHERE call_job_id = %s
                  AND is_interested IS NULL
            """
            
            affected_rows = execute_update(update_query, (follow_id, is_interested, call_job_id))
            if affected_rows == 0:
                logger.warning(f"更新失败：call_job_id={call_job_id} 的 is_interested 可能已被其他任务设置，跳过")
                return {"status": "skipped", "message": "is_interested 已被其他任务设置"}
            
            logger.info(f"任务 {call_job_id} 的跟进记录创建成功（无通话内容，call_status={call_status}）")
            
            # 创建跟进记录成功后，触发任务状态检查，确保及时更新 task_type
            try:
                # 获取 task_id
                task_id_query = """
                    SELECT task_id FROM leads_task_list WHERE call_job_id = %s LIMIT 1
                """
                task_id_result = execute_query(task_id_query, (call_job_id,))
                if task_id_result:
                    task_id = task_id_result[0].get('task_id')
                    if task_id:
                        from api.auto_task_monitor import auto_task_monitor
                        status_result = auto_task_monitor.check_and_update_task_status(task_id)
                        logger.info(f"跟进记录创建后触发任务状态检查: task_id={task_id}, result={status_result}")
            except Exception as e:
                logger.warning(f"触发任务状态检查失败: {str(e)}")
            
            return {
                "status": "success",
                "code": 200,
                "message": "跟进记录创建成功",
                "data": {
                    "follow_id": follow_id,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": leads_remark,
                    "is_interested": is_interested,
                    "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                    "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
        
        # 有 call_conversation 时，调用AI分析并创建跟进记录
        # 优化：如果 call_status == 'Failed'，无论是否有 call_conversation，都不调用 AI，直接创建跟进记录
        if call_status == 'Failed':
            # 通话失败，直接创建跟进记录，不调用 AI
            leads_remark = "客户未接电话，未打通；"
            next_follow_time = None
            is_interested = 0
            logger.info(f"call_job_id={call_job_id} call_status=Failed，跳过 AI 调用，直接创建跟进记录")
        else:
            # call_status 不是 Failed，且有 call_conversation，调用 AI 分析
            # 2. 将call_conversation作为prompt调用AI接口
            try:
                # 如果call_conversation是JSON字符串，需要解析
                if isinstance(call_conversation, str):
                    conversation_data = json.loads(call_conversation)
                else:
                    conversation_data = call_conversation
                
                # 构建prompt（当前直接使用会话JSON）
                prompt = json.dumps(conversation_data, ensure_ascii=False, indent=2)
                logger.info(f"prompt for job_id={call_job_id}: {prompt}")
                ai_response = ali_bailian_api(prompt)
                logger.info(f"AI返回 for job_id={call_job_id}: {ai_response}")

                # 解析AI返回的JSON（含Markdown代码块清理）
                try:
                    ai_response_clean = ai_response.strip()
                    if ai_response_clean.startswith('```json'):
                        ai_response_clean = ai_response_clean[7:]
                    if ai_response_clean.endswith('```'):
                        ai_response_clean = ai_response_clean[:-3]
                    ai_response_clean = ai_response_clean.strip()

                    ai_result = json.loads(ai_response_clean)
                    leads_remark = ai_result.get('leads_remark', '')
                    next_follow_time_str = ai_result.get('next_follow_time', '')
                    raw_is_interested = ai_result.get('is_interested', 0)

                    def normalize_interest(value):
                        if isinstance(value, int):
                            return value if value in (0, 1, 2) else 0
                        if isinstance(value, bool):
                            return 1 if value else 2  # true=有意向(1), false=无意向(2)
                        if isinstance(value, str):
                            v = value.strip().lower()
                            if v in ('0', '未知', '不确定', '无法判断'):
                                return 0
                            if v in ('1', 'true', '有意', '有意向'):
                                return 1
                            if v in ('2', 'false', '无意', '无意向', '没意向', '没有意向'):
                                return 2
                        return 0

                    is_interested = normalize_interest(raw_is_interested)

                    next_follow_time = None
                    if next_follow_time_str:
                        try:
                            next_follow_time = datetime.strptime(next_follow_time_str, '%Y-%m-%d %H:%M:%S')
                        except:
                            next_follow_time = datetime.now()
                except json.JSONDecodeError:
                    leads_remark = "AI分析结果解析失败，需要人工跟进"
                    next_follow_time = datetime.now()
                    is_interested = 0
            
            except Exception as e:
                leads_remark = f"AI分析失败: {str(e)}，需要人工跟进"
                next_follow_time = datetime.now()
                is_interested = 0
        
        # 3. 将数据写入dcc_leads_follow表
        insert_query = """
            INSERT INTO dcc_leads_follow 
            (leads_id, follow_time, leads_remark, frist_follow_time, new_follow_time, next_follow_time)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        current_time = datetime.now()
        follow_id = execute_update(insert_query, (
            leads_id,
            current_time,
            leads_remark,
            current_time,
            current_time,
            next_follow_time
        ))
        
        # 4. 更新leads_task_list表中的leads_follow_id和is_interested（只更新 is_interested IS NULL 的记录）
        update_query = """
            UPDATE leads_task_list 
            SET leads_follow_id = %s, is_interested = %s
            WHERE call_job_id = %s
              AND is_interested IS NULL
        """
        
        affected_rows = execute_update(update_query, (follow_id, is_interested, call_job_id))
        if affected_rows == 0:
            logger.warning(f"更新失败：call_job_id={call_job_id} 的 is_interested 可能已被其他任务设置，跳过")
            return {"status": "skipped", "message": "is_interested 已被其他任务设置"}
        
        logger.info(f"任务 {call_job_id} 的跟进记录创建成功")
        
        # 创建跟进记录成功后，触发任务状态检查，确保及时更新 task_type
        try:
            # 获取 task_id
            task_id_query = """
                SELECT task_id FROM leads_task_list WHERE call_job_id = %s LIMIT 1
            """
            task_id_result = execute_query(task_id_query, (call_job_id,))
            if task_id_result:
                task_id = task_id_result[0].get('task_id')
                if task_id:
                    from api.auto_task_monitor import auto_task_monitor
                    status_result = auto_task_monitor.check_and_update_task_status(task_id)
                    logger.info(f"跟进记录创建后触发任务状态检查: task_id={task_id}, result={status_result}")
        except Exception as e:
            logger.warning(f"触发任务状态检查失败: {str(e)}")
        
        return {
            "status": "success",
            "code": 200,
            "message": "跟进记录创建成功",
            "data": {
                "follow_id": follow_id,
                "leads_id": leads_id,
                "leads_name": leads_name,
                "leads_phone": leads_phone,
                "leads_remark": leads_remark,
                "is_interested": is_interested,
                "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
            }
        }
        
    except Exception as e:
        logger.error(f"创建线索跟进记录时出错: {str(e)}")
        raise self.retry(exc=e)


@celery_app.task(base=CallbackTask, bind=True, max_retries=3, default_retry_delay=60)
def create_leads_follow_by_task_and_phone(self, task_id: int, leads_phone: str):
    """
    创建线索跟进记录（当 call_job_id 为空时使用）
    通过 task_id 和 leads_phone 查找记录
    """
    try:
        # 查询记录（只处理 is_interested IS NULL 的记录）
        query = """
            SELECT call_conversation, leads_id, leads_name, leads_phone, leads_follow_id, call_status, call_job_id, is_interested
            FROM leads_task_list 
            WHERE task_id = %s 
              AND leads_phone = %s
              AND (call_job_id IS NULL OR call_job_id = '')
              AND is_interested IS NULL
        """
        
        result = execute_query(query, (task_id, leads_phone))
        
        if not result:
            logger.warning(f"未找到 task_id={task_id}, leads_phone={leads_phone} 且 is_interested IS NULL 的记录")
            return {
                "status": "error",
                "code": 4001,
                "message": f"未找到 task_id={task_id}, leads_phone={leads_phone} 且 is_interested IS NULL 的记录"
            }
        
        task_data = result[0]
        call_conversation = task_data.get('call_conversation')
        leads_id = task_data.get('leads_id')
        leads_name = task_data.get('leads_name')
        leads_follow_id = task_data.get('leads_follow_id')
        call_status = task_data.get('call_status')
        is_interested_existing = task_data.get('is_interested')
        
        # 再次检查 is_interested（防止并发问题）
        if is_interested_existing is not None:
            logger.info(f"task_id={task_id}, leads_phone={leads_phone} 的 is_interested 已设置为 {is_interested_existing}，跳过跟进记录创建")
            return {"status": "skipped", "message": f"is_interested 已设置（值为 {is_interested_existing}），无需处理"}
        
        # 检查leads_follow_id是否已存在
        if leads_follow_id is not None:
            logger.info(f"task_id={task_id}, leads_phone={leads_phone} 的leads_follow_id已存在，跳过跟进记录创建")
            return {
                "status": "skipped",
                "message": "跟进记录已存在"
            }
        
        # 必须获取到 call_status 之后，才进行创建跟进记录
        if not call_status or call_status == '':
            logger.info(f"task_id={task_id}, leads_phone={leads_phone} 没有 call_status，跳过跟进记录创建")
            return {
                "status": "error",
                "code": 4004,
                "message": f"task_id={task_id}, leads_phone={leads_phone} 的记录尚未获取到call_status，暂不创建跟进记录"
            }
        
        # 重要：只有 call_status 为最终状态（'Succeeded' 或 'Failed'）时才创建跟进记录
        # 如果是中间状态（如 'Executing'），需要等待状态变为最终状态后再创建
        if call_status not in ('Succeeded', 'Failed'):
            logger.info(f"task_id={task_id}, leads_phone={leads_phone} call_status={call_status} 不是最终状态，等待状态变为 Succeeded 或 Failed 后再创建跟进记录")
            return {
                "status": "success",
                "code": 200,
                "message": f"外呼状态为 {call_status}，等待状态变为最终状态（Succeeded 或 Failed）后再创建跟进记录",
                "data": {
                    "follow_id": None,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": None,
                    "is_interested": None,
                    "next_follow_time": None
                }
            }
        
        # 如果 call_status = Failed，直接创建跟进记录，不调用 AI
        if call_status == 'Failed':
            leads_remark = "呼叫失败；"
            is_interested = 0
            next_follow_time = None
        elif not call_conversation:
            # call_conversation 为空，根据 call_status 创建跟进记录（此时 call_status 必须是 Succeeded 或 Failed）
            # 重要：对于 call_status == 'Succeeded' 的情况，需要等待 call_conversation 获取到后再创建跟进记录
            # 因为 call_conversation 可能稍后才会从阿里云获取到
            if call_status == 'Succeeded':
                logger.info(f"task_id={task_id}, leads_phone={leads_phone} call_status=Succeeded 但 call_conversation 为空，等待 call_conversation 获取到后再创建跟进记录")
                return {
                    "status": "success",
                    "code": 200,
                    "message": "外呼成功但通话记录尚未获取，等待通话记录获取后再创建跟进记录",
                    "data": {
                        "follow_id": None,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": None,
                        "is_interested": None,
                        "next_follow_time": None
                    }
                }
            else:
                # 理论上不应该到这里，因为前面已经检查了 call_status 必须是 Succeeded 或 Failed
                logger.warning(f"task_id={task_id}, leads_phone={leads_phone} call_status={call_status} 不是预期的最终状态，跳过跟进记录创建")
                return {
                    "status": "success",
                    "code": 200,
                    "message": f"call_status={call_status} 不是预期的最终状态，跳过跟进记录创建",
                    "data": {
                        "follow_id": None,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": None,
                        "is_interested": None,
                        "next_follow_time": None
                    }
                }
        else:
            # 有 call_conversation，调用 AI 分析
            try:
                if isinstance(call_conversation, str):
                    conversation_data = json.loads(call_conversation)
                else:
                    conversation_data = call_conversation
                
                prompt = json.dumps(conversation_data, ensure_ascii=False, indent=2)
                logger.info(f"prompt for task_id={task_id}, leads_phone={leads_phone}: {prompt}")
                ai_response = ali_bailian_api(prompt)
                logger.info(f"AI返回 for task_id={task_id}, leads_phone={leads_phone}: {ai_response}")

                try:
                    ai_response_clean = ai_response.strip()
                    if ai_response_clean.startswith('```json'):
                        ai_response_clean = ai_response_clean[7:]
                    if ai_response_clean.endswith('```'):
                        ai_response_clean = ai_response_clean[:-3]
                    ai_response_clean = ai_response_clean.strip()

                    ai_result = json.loads(ai_response_clean)
                    leads_remark = ai_result.get('leads_remark', '')
                    next_follow_time_str = ai_result.get('next_follow_time', '')
                    raw_is_interested = ai_result.get('is_interested', 0)

                    def normalize_interest(value):
                        if isinstance(value, int):
                            return value if value in (0, 1, 2) else 0
                        if isinstance(value, bool):
                            return 1 if value else 2
                        if isinstance(value, str):
                            v = value.strip().lower()
                            if v in ('0', '未知', '不确定', '无法判断'):
                                return 0
                            if v in ('1', 'true', '有意', '有意向'):
                                return 1
                            if v in ('2', 'false', '无意', '无意向', '没意向', '没有意向'):
                                return 2
                        return 0

                    is_interested = normalize_interest(raw_is_interested)

                    next_follow_time = None
                    if next_follow_time_str:
                        try:
                            next_follow_time = datetime.strptime(next_follow_time_str, '%Y-%m-%d %H:%M:%S')
                        except:
                            next_follow_time = datetime.now()
                except json.JSONDecodeError:
                    leads_remark = "AI分析结果解析失败，需要人工跟进"
                    next_follow_time = datetime.now()
                    is_interested = 0
            
            except Exception as e:
                leads_remark = f"AI分析失败: {str(e)}，需要人工跟进"
                next_follow_time = datetime.now()
                is_interested = 0
        
        # 创建跟进记录
        insert_query = """
            INSERT INTO dcc_leads_follow 
            (leads_id, follow_time, leads_remark, frist_follow_time, new_follow_time, next_follow_time)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        current_time = datetime.now()
        follow_id = execute_update(insert_query, (
            leads_id,
            current_time,
            leads_remark,
            current_time,
            current_time,
            next_follow_time
        ))
        
        # 更新 leads_task_list 表中的 leads_follow_id 和 is_interested（只更新 is_interested IS NULL 的记录）
        update_query = """
            UPDATE leads_task_list 
            SET leads_follow_id = %s, is_interested = %s
            WHERE task_id = %s 
              AND leads_phone = %s
              AND (call_job_id IS NULL OR call_job_id = '')
              AND is_interested IS NULL
        """
        
        affected_rows = execute_update(update_query, (follow_id, is_interested, task_id, leads_phone))
        if affected_rows == 0:
            logger.warning(f"更新失败：task_id={task_id}, leads_phone={leads_phone} 的 is_interested 可能已被其他任务设置，跳过")
            return {"status": "skipped", "message": "is_interested 已被其他任务设置"}
        
        logger.info(f"任务 task_id={task_id}, leads_phone={leads_phone} 的跟进记录创建成功")
        
        # 创建跟进记录成功后，触发任务状态检查，确保及时更新 task_type
        try:
            from api.auto_task_monitor import auto_task_monitor
            status_result = auto_task_monitor.check_and_update_task_status(task_id)
            logger.info(f"跟进记录创建后触发任务状态检查: task_id={task_id}, result={status_result}")
        except Exception as e:
            logger.warning(f"触发任务状态检查失败: {str(e)}")
        
        return {
            "status": "success",
            "code": 200,
            "message": "跟进记录创建成功",
            "data": {
                "follow_id": follow_id,
                "leads_id": leads_id,
                "leads_name": leads_name,
                "leads_phone": leads_phone,
                "leads_remark": leads_remark,
                "is_interested": is_interested,
                "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
            }
        }
        
    except Exception as e:
        logger.error(f"创建线索跟进记录时出错（通过 task_id 和 leads_phone）: {str(e)}")
        raise self.retry(exc=e)

