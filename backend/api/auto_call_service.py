from typing import Any, Dict, List, Tuple, Optional
from datetime import datetime
import json
import asyncio
import sys
import os

from database.db import execute_query, execute_update
from .auto_call_utils import (
    validate_user_token_with_username,
    validate_user_token,
    build_leads_query,
    safe_getattr,
)


def create_auto_call_task_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建自动外呼任务（业务逻辑层）。

    入参：
    - request: Pydantic 实例，含 task_name, script_id, size_desc
    - token: 解码后的 token 字典

    返回：与原接口一致的 dict 结构
    """
    # 1) 获取用户与组织信息
    user_id, organization_id, create_name = validate_user_token_with_username(token)

    # 2) 根据筛选条件查询线索
    leads_query, leads_params = build_leads_query(request.size_desc, organization_id)
    leads_result = execute_query(leads_query, tuple(leads_params))

    if not leads_result:
        return {
            "status": "error",
            "code": 4001,
            "message": "未找到符合条件的线索数据"
        }

    # 3) 创建 call_tasks 记录
    current_time = datetime.now()
    size_desc_json = json.dumps(request.size_desc.dict())

    task_query = (
        """
        INSERT INTO call_tasks 
        (task_name, organization_id, create_name_id, create_name, create_time, leads_count, script_id, task_type, size_desc)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
    )
    task_params = (
        request.task_name,
        organization_id,
        user_id,
        create_name,
        current_time,
        len(leads_result),
        request.script_id,
        1,  # 已创建
        size_desc_json,
    )
    task_id = execute_update(task_query, task_params)

    # 4) 批量写 leads_task_list
    if leads_result:
        values_placeholder = ",".join(["(%s, %s, %s, %s, %s, %s, %s)"] * len(leads_result))
        batch_insert_sql = f"""
            INSERT INTO leads_task_list 
            (task_id, leads_id, leads_name, leads_phone, call_time, call_job_id, reference_id)
            VALUES {values_placeholder}
        """
        params: List[Any] = []
        for lead in leads_result:
            # 生成 reference_id: task_id + organization_id + leads_id
            reference_id = f"{task_id}{organization_id}{lead['leads_id']}"
            params.extend([
                task_id,
                lead['leads_id'],
                lead['leads_user_name'],
                lead['leads_user_phone'],
                current_time,
                "",
                reference_id,
            ])
        execute_update(batch_insert_sql, tuple(params))

    # 5) 组装返回 size_desc，保留 ranges 字段
    size_desc_dict = request.size_desc.dict()
    if hasattr(request.size_desc, 'first_follow_ranges') and request.size_desc.first_follow_ranges:
        size_desc_dict['first_follow_ranges'] = request.size_desc.first_follow_ranges
    if hasattr(request.size_desc, 'latest_follow_ranges') and request.size_desc.latest_follow_ranges:
        size_desc_dict['latest_follow_ranges'] = request.size_desc.latest_follow_ranges
    if hasattr(request.size_desc, 'next_follow_ranges') and request.size_desc.next_follow_ranges:
        size_desc_dict['next_follow_ranges'] = request.size_desc.next_follow_ranges

    return {
        "status": "success",
        "code": 200,
        "message": "自动外呼任务创建成功",
        "data": {
            "task_id": task_id,
            "task_name": request.task_name,
            "leads_count": len(leads_result),
            "create_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
            "size_desc": size_desc_dict,
        },
    }


def start_call_task_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """
    开始外呼任务（业务逻辑层）。
    """
    # 1) 验证用户和组织
    user_id, organization_id = validate_user_token(token)

    # 2) 验证任务是否存在且属于该组织
    task_query = """
        SELECT id, task_name, script_id, leads_count, size_desc, task_type
        FROM call_tasks 
        WHERE id = %s AND organization_id = %s
    """
    task_result = execute_query(task_query, (request.task_id, organization_id))

    if not task_result:
        return {
            "status": "error",
            "code": 4004,
            "message": "任务不存在或无权限访问"
        }

    task_info = task_result[0]

    # 3) 检查任务状态
    if task_info['task_type'] != 1:
        return {
            "status": "error",
            "code": 4005,
            "message": "任务状态不正确，只有已创建状态的任务可以开始外呼"
        }

    # 4) 检查是否有脚本ID
    if not task_info['script_id']:
        return {
            "status": "error",
            "code": 4006,
            "message": "任务未配置脚本ID，请先配置脚本"
        }

    # 5) 获取任务下的所有线索
    leads_query = """
        SELECT id, leads_name, leads_phone, leads_id, reference_id
        FROM leads_task_list 
        WHERE task_id = %s
        ORDER BY id
    """
    leads_result = execute_query(leads_query, (request.task_id,))

    if not leads_result:
        return {
            "status": "error",
            "code": 4007,
            "message": "任务下没有线索数据"
        }

    # 6) 调用create_job_group获取job_group_id
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
    from create_job_group import Sample as CreateJobGroupSample

    job_group_name = f"任务_{request.task_id}_{task_info['task_name']}"
    job_group_description = f"自动外呼任务_{request.task_id}"

    try:
        job_group = CreateJobGroupSample.main(
            CreateJobGroupSample(),
            [],
            job_group_name,
            job_group_description,
            None,
            task_info['script_id']
        )
        if not job_group or not getattr(job_group, 'job_group_id', None):
            return {
                "status": "error",
                "code": 5001,
                "message": "创建任务组返回为空或缺少 job_group_id"
            }
        job_group_id = job_group.job_group_id
    except Exception as e:
        return {
            "status": "error",
            "code": 5001,
            "message": f"创建任务组失败: {str(e)}"
        }

    # 7) 更新call_tasks表，设置job_group_id和task_type
    update_task_query = """
        UPDATE call_tasks 
        SET job_group_id = %s, task_type = %s 
        WHERE id = %s
    """
    execute_update(update_task_query, (job_group_id, 2, request.task_id))  # task_type: 2-开始外呼

    # 8) 准备assign_jobs的数据
    jobs_json = []
    for lead in leads_result:
        job_data = {
            "extras": [],
            "contacts": [
                {
                    "phoneNumber": lead['leads_phone'],
                    "name": lead['leads_name'],
                    "referenceId": lead['reference_id']
                }
            ]
        }
        jobs_json.append(job_data)

    # 9) 调用assign_jobs执行外呼任务
    from openAPI.assign_jobs import Sample as AssignJobsSample

    total_leads = len(leads_result)
    jobs_id = []
    try:
        jobs_id = AssignJobsSample.main(
            job_group_id,
            jobs_json
        )
    except Exception as e:
        # 如果assign_jobs失败，回滚任务状态
        rollback_query = """
            UPDATE call_tasks 
            SET task_type = %s, job_group_id = NULL 
            WHERE id = %s
        """
        execute_update(rollback_query, (1, request.task_id))
        return {
            "status": "error",
            "code": 5002,
            "message": f"分配外呼任务失败: {str(e)}"
        }
    
    # 验证返回的 jobs_id 数量
    received_count = len(jobs_id) if jobs_id else 0
    if received_count != total_leads:
        error_msg = f"分配外呼任务不完整：期望{total_leads}个任务，实际返回{received_count}个jobs_id，可能有遗漏"
        print(f"[start_call_task] {error_msg}")
        # 即使有遗漏，也继续执行，但记录警告
        # 可以考虑返回警告信息，或者根据业务需求决定是否回滚

    # 10) 异步触发同步 call_job_id（完成后会自动触发获取 call_conversation）
    # 注意：sync_call_job_ids_from_group 完成后会自动触发 update_task_execution
    # 所以这里只需要启动同步任务即可
    asyncio.create_task(sync_call_job_ids_from_group(request.task_id, job_group_id))
    
    # 11) 触发自动化任务监控器，立即开始处理任务
    try:
        from celery_tasks.task_monitor import process_task_after_creation
        process_task_after_creation.delay(request.task_id)
    except Exception as e:
        # 监控任务触发失败不影响主流程
        print(f"[start_call_task] 触发监控任务失败: {str(e)}")

    # 构建返回消息
    message = "外呼任务开始成功"
    if received_count != total_leads:
        message = f"外呼任务开始成功，但存在遗漏：期望{total_leads}个任务，实际返回{received_count}个jobs_id"
    
    return {
        "status": "success",
        "code": 200,
        "message": message,
        "data": {
            "task_id": request.task_id,
            "task_name": task_info['task_name'],
            "job_group_id": job_group_id,
            "jobs_id": jobs_id,
            "leads_count": len(leads_result),
            "received_jobs_count": received_count,
            "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    }


async def sync_call_job_ids_from_group(task_id: int, job_group_id: str):
    """异步获取并更新 call_job_id：遍历所有页，根据 reference_id 匹配写回"""
    try:
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from query_jobs_with_result import Sample as QueryJobsWithResultSample

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
            print(f"[sync_call_job_ids] 调用 list_jobs_by_group 第{page}页失败: {str(e)}")
            return

        jobs_list = safe_getattr(jobs_group_data, 'list', 'List', default=None)
        total_jobs = safe_getattr(jobs_group_data, 'row_count', 'TotalCount', default=0) or 0
        total_pages = (total_jobs + page_size - 1) // page_size if page_size > 0 else 0

        def collect_updates_from_jobs(jobs_page_list):
            updates_by_ref_id = []
            updates_by_phone = []
            for job in (jobs_page_list or []):
                job_id = safe_getattr(job, "id", default=None)
                latest_task = safe_getattr(job, 'latest_task', default=None)
                contacts = safe_getattr(latest_task, 'contact', default=None)
                reference_id = None
                phone_number = None
                if contacts:
                    # 尝试获取 ReferenceId（可能的大小写变体）
                    reference_id = safe_getattr(contacts, 'ReferenceId', 'referenceId', 'reference_id', default=None)
                    # 尝试获取 phone_number（可能的大小写变体）
                    phone_number = safe_getattr(contacts, 'phone_number', 'phoneNumber', 'PhoneNumber', default=None)
                
                if job_id:
                    # 检查 reference_id 是否有效（非空且非空字符串）
                    if reference_id and str(reference_id).strip():
                        # 优先使用 reference_id
                        updates_by_ref_id.append((job_id, str(reference_id).strip(), phone_number))
                    elif phone_number:
                        # reference_id 为空时，使用 phone_number
                        updates_by_phone.append((job_id, str(phone_number)))
            return updates_by_ref_id, updates_by_phone

        # 处理第一页
        updates_by_ref_id, updates_by_phone = collect_updates_from_jobs(jobs_list)
        updated_count = 0
        
        # 优先使用 reference_id 匹配
        ref_id_matched_count = 0
        if updates_by_ref_id:
            select_rows = []
            flat_params: list = []
            for job_id, ref_id, phone_number in updates_by_ref_id:
                select_rows.append("SELECT %s AS reference_id, %s AS job_id, %s AS task_id")
                flat_params.extend([ref_id, str(job_id), task_id])
            derived_sql = " UNION ALL ".join(select_rows)
            update_sql = (
                "UPDATE leads_task_list AS l "
                "JOIN (" + derived_sql + ") AS d "
                "ON l.task_id = d.task_id AND l.reference_id = d.reference_id "
                "SET l.call_job_id = d.job_id "
                "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
            )
            ref_id_matched_count = execute_update(update_sql, tuple(flat_params))
            updated_count += ref_id_matched_count
            print(f"[sync_call_job_ids] task_id={task_id} 第{page}页通过reference_id更新了 {ref_id_matched_count} 条记录")
            
            # 如果 reference_id 匹配失败（0条），回退到 phone_number 匹配
            if ref_id_matched_count == 0:
                fallback_updates = []
                for job_id, ref_id, phone_number in updates_by_ref_id:
                    if phone_number:
                        fallback_updates.append((job_id, str(phone_number)))
                
                if fallback_updates:
                    select_rows = []
                    flat_params: list = []
                    for job_id, phone in fallback_updates:
                        select_rows.append("SELECT %s AS phone, %s AS job_id, %s AS task_id")
                        flat_params.extend([phone, str(job_id), task_id])
                    derived_sql = " UNION ALL ".join(select_rows)
                    update_sql = (
                        "UPDATE leads_task_list AS l "
                        "JOIN (" + derived_sql + ") AS d "
                        "ON l.task_id = d.task_id AND l.leads_phone = d.phone "
                        "SET l.call_job_id = d.job_id "
                        "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
                    )
                    fallback_count = execute_update(update_sql, tuple(flat_params))
                    updated_count += fallback_count
                    print(f"[sync_call_job_ids] task_id={task_id} 第{page}页reference_id匹配失败，通过phone_number回退更新了 {fallback_count} 条记录")
        
        # reference_id 为空时，使用 phone_number 匹配
        if updates_by_phone:
            select_rows = []
            flat_params: list = []
            for job_id, phone in updates_by_phone:
                select_rows.append("SELECT %s AS phone, %s AS job_id, %s AS task_id")
                flat_params.extend([phone, str(job_id), task_id])
            derived_sql = " UNION ALL ".join(select_rows)
            update_sql = (
                "UPDATE leads_task_list AS l "
                "JOIN (" + derived_sql + ") AS d "
                "ON l.task_id = d.task_id AND l.leads_phone = d.phone "
                "SET l.call_job_id = d.job_id "
                "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
            )
            affected_rows = execute_update(update_sql, tuple(flat_params))
            updated_count += affected_rows
            print(f"[sync_call_job_ids] task_id={task_id} 第{page}页通过phone_number更新了 {affected_rows} 条记录")
        
        if updated_count > 0:
            print(f"[sync_call_job_ids] task_id={task_id} 第{page}页总共更新了 {updated_count} 条记录")

        # 遍历剩余页
        if total_pages > 1:
            for pn in range(2, total_pages + 1):
                try:
                    await asyncio.sleep(0.1)
                    page_data = QueryJobsWithResultSample.main(
                        [],
                        job_group_id=job_group_id,
                        page_number=pn,
                        page_size=page_size
                    )
                    page_jobs_list = safe_getattr(page_data, 'list', 'List', default=None)
                    updates_by_ref_id_p, updates_by_phone_p = collect_updates_from_jobs(page_jobs_list)
                    updated_count_p = 0
                    
                    # 优先使用 reference_id 匹配
                    ref_id_matched_count_p = 0
                    if updates_by_ref_id_p:
                        select_rows = []
                        flat_params: list = []
                        for job_id, ref_id, phone_number in updates_by_ref_id_p:
                            select_rows.append("SELECT %s AS reference_id, %s AS job_id, %s AS task_id")
                            flat_params.extend([ref_id, str(job_id), task_id])
                        derived_sql = " UNION ALL ".join(select_rows)
                        update_sql = (
                            "UPDATE leads_task_list AS l "
                            "JOIN (" + derived_sql + ") AS d "
                            "ON l.task_id = d.task_id AND l.reference_id = d.reference_id "
                            "SET l.call_job_id = d.job_id "
                            "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
                        )
                        ref_id_matched_count_p = execute_update(update_sql, tuple(flat_params))
                        updated_count_p += ref_id_matched_count_p
                        print(f"[sync_call_job_ids] task_id={task_id} 第{pn}页通过reference_id更新了 {ref_id_matched_count_p} 条记录")
                        
                        # 如果 reference_id 匹配失败（0条），回退到 phone_number 匹配
                        if ref_id_matched_count_p == 0:
                            fallback_updates_p = []
                            for job_id, ref_id, phone_number in updates_by_ref_id_p:
                                if phone_number:
                                    fallback_updates_p.append((job_id, str(phone_number)))
                            
                            if fallback_updates_p:
                                select_rows = []
                                flat_params: list = []
                                for job_id, phone in fallback_updates_p:
                                    select_rows.append("SELECT %s AS phone, %s AS job_id, %s AS task_id")
                                    flat_params.extend([phone, str(job_id), task_id])
                                derived_sql = " UNION ALL ".join(select_rows)
                                update_sql = (
                                    "UPDATE leads_task_list AS l "
                                    "JOIN (" + derived_sql + ") AS d "
                                    "ON l.task_id = d.task_id AND l.leads_phone = d.phone "
                                    "SET l.call_job_id = d.job_id "
                                    "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
                                )
                                fallback_count_p = execute_update(update_sql, tuple(flat_params))
                                updated_count_p += fallback_count_p
                                print(f"[sync_call_job_ids] task_id={task_id} 第{pn}页reference_id匹配失败，通过phone_number回退更新了 {fallback_count_p} 条记录")
                    
                    # reference_id 为空时，使用 phone_number 匹配
                    if updates_by_phone_p:
                        select_rows = []
                        flat_params: list = []
                        for job_id, phone in updates_by_phone_p:
                            select_rows.append("SELECT %s AS phone, %s AS job_id, %s AS task_id")
                            flat_params.extend([phone, str(job_id), task_id])
                        derived_sql = " UNION ALL ".join(select_rows)
                        update_sql = (
                            "UPDATE leads_task_list AS l "
                            "JOIN (" + derived_sql + ") AS d "
                            "ON l.task_id = d.task_id AND l.leads_phone = d.phone "
                            "SET l.call_job_id = d.job_id "
                            "WHERE (l.call_job_id IS NULL OR l.call_job_id = '')"
                        )
                        affected_rows = execute_update(update_sql, tuple(flat_params))
                        updated_count_p += affected_rows
                        print(f"[sync_call_job_ids] task_id={task_id} 第{pn}页通过phone_number更新了 {affected_rows} 条记录")
                    
                    if updated_count_p > 0:
                        print(f"[sync_call_job_ids] task_id={task_id} 第{pn}页总共更新了 {updated_count_p} 条记录")
                except Exception as e:
                    print(f"[sync_call_job_ids] 拉取第{pn}页失败: {str(e)}")
                    continue

        print(f"[sync_call_job_ids] task_id={task_id} 同步完成，共 {total_pages} 页")
    except Exception as e:
        print(f"[sync_call_job_ids] task_id={task_id} 同步 call_job_id 失败: {str(e)}")


def update_script_id_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """更新脚本ID（业务逻辑层）"""
    user_id, organization_id = validate_user_token(token)

    # 验证任务是否存在且属于该组织
    task_query = """
        SELECT id, task_name, script_id 
        FROM call_tasks 
        WHERE id = %s AND organization_id = %s
    """
    task_result = execute_query(task_query, (request.task_id, organization_id))

    if not task_result:
        return {
            "status": "error",
            "code": 4004,
            "message": "任务不存在或无权限访问"
        }

    # 更新script_id
    update_query = """
        UPDATE call_tasks 
        SET script_id = %s 
        WHERE id = %s AND organization_id = %s
    """
    execute_update(update_query, (request.script_id, request.task_id, organization_id))

    return {
        "status": "success",
        "code": 200,
        "message": "脚本ID更新成功",
        "data": {
            "task_id": request.task_id,
            "script_id": request.script_id,
            "task_name": task_result[0]['task_name']
        }
    }


def get_task_statistics_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """查询任务统计信息（业务逻辑层）"""
    user_id, organization_id = validate_user_token(token)

    # 验证任务是否存在且属于该组织
    task_query = """
        SELECT id, task_name, leads_count 
        FROM call_tasks 
        WHERE id = %s AND organization_id = %s
    """
    task_result = execute_query(task_query, (request.task_id, organization_id))

    if not task_result:
        return {
            "status": "error",
            "code": 4004,
            "message": "任务不存在或无权限访问"
        }

    # 查询任务统计信息
    # 1. 有意向：is_interested = 1
    # 2. 无意向：is_interested = 2
    # 3. 无法判断：is_interested = 0 且 leads_follow_id 不为空
    # 4. 待跟进：is_interested 为空 或（is_interested = 0 且 leads_follow_id 为空）
    stats_query = """
        SELECT 
            COUNT(*) as total_leads,
            SUM(CASE WHEN (is_interested IS NULL OR (is_interested = 0 AND (leads_follow_id IS NULL OR leads_follow_id = ''))) THEN 1 ELSE 0 END) as pending_follow,
            SUM(CASE WHEN is_interested = 0 AND (leads_follow_id IS NOT NULL AND leads_follow_id != '') THEN 1 ELSE 0 END) as unable_to_judge,
            SUM(CASE WHEN is_interested = 1 THEN 1 ELSE 0 END) as interested,
            SUM(CASE WHEN is_interested = 2 THEN 1 ELSE 0 END) as not_interested
        FROM leads_task_list 
        WHERE task_id = %s
    """
    stats_result = execute_query(stats_query, (request.task_id,))

    if not stats_result:
        stats_data = {
            "total_leads": 0,
            "pending_follow": 0,
            "unable_to_judge": 0,
            "interested": 0,
            "not_interested": 0
        }
    else:
        stats_data = stats_result[0]

    return {
        "status": "success",
        "code": 200,
        "message": "查询任务统计信息成功",
        "data": {
            "total_leads": stats_data["total_leads"],
            "pending_follow": stats_data["pending_follow"],
            "unable_to_judge": stats_data["unable_to_judge"],
            "interested": stats_data["interested"],
            "not_interested": stats_data["not_interested"]
        }
    }


def get_task_list_service(*, page: int, page_size: int, token: Dict[str, Any], task_types: Optional[List[int]] = None) -> Dict[str, Any]:
    """分页查询任务列表（业务逻辑层）"""
    user_id, organization_id = validate_user_token(token)

    base_condition = "organization_id = %s"
    base_params: List[Any] = [organization_id]
    if task_types:
        placeholders = ','.join(['%s'] * len(task_types))
        base_condition += f" AND task_type IN ({placeholders})"
        base_params.extend(task_types)

    # 统计总数
    count_sql = f"SELECT COUNT(*) AS total FROM call_tasks WHERE {base_condition}"
    count_res = execute_query(count_sql, tuple(base_params))
    total = count_res[0]['total'] if count_res and count_res[0].get('total') else 0

    if total == 0:
        return {
            "status": "success",
            "code": 200,
            "message": "暂无任务数据",
            "data": {
                "items": [],
                "pagination": {
                    "page": max(1, page),
                    "page_size": max(1, page_size),
                    "total": 0,
                    "total_pages": 0
                }
            }
        }

    # 计算分页
    page_size = max(1, page_size)
    total_pages = (total + page_size - 1) // page_size
    page = max(1, min(page, total_pages))
    offset = (page - 1) * page_size

    # 查询页面数据
    list_sql = f"""
        SELECT id, task_name, task_type, create_time, leads_count
        FROM call_tasks
        WHERE {base_condition}
        ORDER BY create_time DESC
        LIMIT %s OFFSET %s
    """
    list_params = base_params + [page_size, offset]
    rows = execute_query(list_sql, tuple(list_params))

    items: List[Dict[str, Any]] = []
    for r in rows or []:
        create_time_val = r['create_time']
        create_time_str = create_time_val.strftime("%Y-%m-%d %H:%M:%S") if hasattr(create_time_val, 'strftime') else str(create_time_val)
        items.append({
            "id": r['id'],
            "task_name": r['task_name'],
            "task_type": r['task_type'],
            "create_time": create_time_str,
            "leads_count": r['leads_count']
        })

    return {
        "status": "success",
        "code": 200,
        "message": "获取任务列表成功",
        "data": {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages
            }
        }
    }


def suspend_resume_task_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """暂停/重启任务（业务逻辑层）"""
    if request.action not in ["suspend", "resume"]:
        return {"status": "error", "code": 4001, "message": "无效的操作类型"}

    if not request.task_id or request.task_id <= 0:
        return {"status": "error", "code": 4005, "message": "参数错误"}

    # 查询任务信息
    task_query = "SELECT id, task_name, task_type, job_group_id FROM call_tasks WHERE id = %s"
    task_result = execute_query(task_query, (request.task_id,))

    if not task_result:
        return {"status": "error", "code": 4004, "message": "未找到对应的任务"}

    task_info = task_result[0]
    current_task_type = task_info['task_type']
    job_group_id = task_info['job_group_id']

    if request.action == "suspend":
        if current_task_type != 2:
            return {"status": "error", "code": 4002, "message": "任务状态不允许暂停"}

        from openAPI.suspend_jobs import Sample as SuspendJobsSample
        suspend_result = SuspendJobsSample.suspend_jobs(job_group_id)

        if not suspend_result.get("Success", False):
            return {
                "status": "error",
                "code": 5001,
                "message": f"暂停任务失败: {suspend_result.get('Message', '未知错误')}"
            }

        execute_update("UPDATE call_tasks SET task_type = 5 WHERE id = %s", (request.task_id,))
        print(f"任务暂停成功: task_id={request.task_id}, job_group_id={job_group_id}, task_type: {current_task_type} -> 5")

        return {
            "status": "success",
            "code": 200,
            "message": "任务暂停成功",
            "data": {
                "task_id": request.task_id,
                "job_group_id": job_group_id,
                "task_type": 5
            }
        }

    elif request.action == "resume":
        if current_task_type != 5:
            return {"status": "error", "code": 4003, "message": "任务状态不允许重启"}

        from openAPI.resumeJobs import Sample as ResumeJobsSample
        resume_result = ResumeJobsSample.resume_jobs(job_group_id)

        if not resume_result.get("Success", False):
            return {
                "status": "error",
                "code": 5002,
                "message": f"重启任务失败: {resume_result.get('Message', '未知错误')}"
            }

        execute_update("UPDATE call_tasks SET task_type = 2 WHERE id = %s", (request.task_id,))
        print(f"任务重启成功: task_id={request.task_id}, job_group_id={job_group_id}, task_type: {current_task_type} -> 2")

        return {
            "status": "success",
            "code": 200,
            "message": "任务重启成功",
            "data": {
                "task_id": request.task_id,
                "job_group_id": job_group_id,
                "task_type": 2
            }
        }

    return {"status": "error", "code": 4001, "message": "无效的操作类型"}


async def describe_job_group_service(*, request: Any, token: Dict[str, Any]) -> Dict[str, Any]:
    """查询任务组详情（业务逻辑层）- 从数据库统计数据"""
    user_id, organization_id = validate_user_token(token)

    # 确定 job_group_id：优先使用 request.job_group_id，否则从 task_id 推导
    job_group_id = getattr(request, 'job_group_id', None)
    task_id = getattr(request, 'task_id', None)
    
    if task_id:
        task_query = (
            "SELECT id, task_name, organization_id, job_group_id, updated_time, task_type FROM call_tasks WHERE id = %s AND organization_id = %s"
        )
        task_result = execute_query(task_query, (task_id, organization_id))
        if not task_result:
            return {"status": "error", "code": 4004, "message": "任务不存在或无权限访问"}
        job_group_id = task_result[0].get('job_group_id')
        if not job_group_id:
            return {"status": "error", "code": 4005, "message": "该任务尚未开始外呼，没有job_group_id"}
    elif not job_group_id:
        return {"status": "error", "code": 4001, "message": "必须提供job_group_id或task_id"}
    else:
        # 验证该 job_group_id 是否属于该组织
        check_sql = (
            "SELECT id FROM call_tasks WHERE job_group_id = %s AND organization_id = %s LIMIT 1"
        )
        ok = execute_query(check_sql, (job_group_id, organization_id))
        if not ok:
            return {"status": "error", "code": 4003, "message": "无权限访问该任务组"}

    # 获取该 job_group_id 下的所有任务ID
    tasks_query = (
        "SELECT id, updated_time, task_type FROM call_tasks WHERE job_group_id = %s AND organization_id = %s"
    )
    tasks_result = execute_query(tasks_query, (job_group_id, organization_id))
    
    if not tasks_result:
        return {"status": "error", "code": 4004, "message": "未找到对应的任务组"}
    
    task_ids = [task['id'] for task in tasks_result]
    # 获取最新的更新时间
    latest_updated_time = max(
        (task.get('updated_time') or datetime.now() for task in tasks_result),
        default=datetime.now()
    )
    
    # 根据任务类型判断任务组状态
    task_types = [task.get('task_type', 0) for task in tasks_result]
    if all(t >= 3 for t in task_types):
        job_group_status = 'Completed'
    elif any(t == 5 for t in task_types):
        job_group_status = 'Stopped'
    elif any(t == 2 for t in task_types):
        job_group_status = 'Running'
    else:
        job_group_status = 'Created'

    # 从数据库统计任务组进度
    # 根据 call_status 进行精确分类统计：
    # - Scheduling、Executing：进行中 → executing
    # - Succeeded：已接通 → total_completed
    # - Paused：未开始 → scheduling
    # - Failed、Cancelled：未接通 → failed
    if task_ids:
        task_ids_placeholder = ','.join(['%s'] * len(task_ids))
        stats_query = f"""
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN call_status IS NULL OR call_status = '' THEN 1 ELSE 0 END) as scheduling,
                SUM(CASE WHEN call_status IN ('Scheduling', 'Executing') THEN 1 ELSE 0 END) as executing,
                SUM(CASE WHEN call_status = 'Succeeded' THEN 1 ELSE 0 END) as total_completed,
                SUM(CASE WHEN call_status IN ('Failed', 'Cancelled') THEN 1 ELSE 0 END) as failed
            FROM leads_task_list 
            WHERE task_id IN ({task_ids_placeholder})
        """
        stats_result = execute_query(stats_query, tuple(task_ids))
    else:
        stats_result = None
    
    progress_data = {
        "scheduling": 0,
        "total_completed": 0,
        "executing": 0,
        "failed": 0,
        "total_jobs": 0
    }
    
    if stats_result and stats_result[0]:
        stats = stats_result[0]
        # 确保所有值都转换为整数，避免类型问题（如 Decimal、字符串等）
        def safe_int(value, default=0):
            if value is None:
                return default
            try:
                return int(float(str(value)))
            except (ValueError, TypeError):
                return default
        
        progress_data["total_jobs"] = safe_int(stats.get('total_jobs'))
        progress_data["scheduling"] = safe_int(stats.get('scheduling'))
        progress_data["executing"] = safe_int(stats.get('executing'))
        progress_data["total_completed"] = safe_int(stats.get('total_completed'))
        progress_data["failed"] = safe_int(stats.get('failed'))

    # 格式化更新时间
    modify_time_str = None
    modify_timestamp = None
    if latest_updated_time:
        try:
            if isinstance(latest_updated_time, datetime):
                modify_time_str = latest_updated_time.strftime("%Y-%m-%d %H:%M:%S")
                modify_timestamp = int(latest_updated_time.timestamp() * 1000)
            elif isinstance(latest_updated_time, str):
                modify_time_str = latest_updated_time
        except Exception:
            modify_time_str = str(latest_updated_time)

    return {
        "status": "success",
        "code": 200,
        "message": "查询任务组详情成功",
        "data": {
            "job_group_id": job_group_id,
            "task_id": task_id,
            "status": job_group_status,
            "modify_time": modify_time_str,
            "modify_timestamp": modify_timestamp,
            "progress": progress_data
        }
    }


def get_task_stats_service(*, token: Dict[str, Any]) -> Dict[str, Any]:
    """获取任务统计（带缓存逻辑在 API 层或此处由调用方控制刷新）。"""
    user_id, organization_id = validate_user_token(token)

    stats_query = (
        "SELECT task_type, COUNT(*) as count, COALESCE(SUM(leads_count), 0) as leads_count "
        "FROM call_tasks WHERE organization_id = %s GROUP BY task_type ORDER BY task_type"
    )
    stats_result = execute_query(stats_query, (organization_id,))

    task_types = [1, 2, 3, 4]
    stats_map = {row['task_type']: row for row in stats_result}
    stats_list: List[Dict[str, Any]] = []
    for t in task_types:
        if t in stats_map:
            stats_list.append({
                "task_type": t,
                "count": stats_map[t]['count'],
                "leads_count": stats_map[t]['leads_count'] or 0
            })
        else:
            stats_list.append({"task_type": t, "count": 0, "leads_count": 0})

    return {
        "status": "success",
        "code": 200,
        "message": "获取任务统计信息成功",
        "data": stats_list
    }


async def get_tasks_service(*, token: Dict[str, Any]) -> Dict[str, Any]:
    """获取任务列表（业务逻辑层，包含状态检查和线索信息）"""
    user_id, organization_id = validate_user_token(token)

    # 查询call_tasks表中的任务信息
    tasks_query = """
        SELECT 
            id, task_name, create_time, size_desc, leads_count,
            task_type, organization_id, create_name, script_id, job_group_id
        FROM call_tasks 
        WHERE organization_id = %s
        ORDER BY create_time DESC
    """
    tasks_result = execute_query(tasks_query, (organization_id,))

    if not tasks_result:
        return {
            "status": "success",
            "code": 200,
            "message": "暂无任务数据",
            "data": []
        }

    # 状态检查逻辑（与 task-stats 类似，但更新内存中的任务状态）
    checking_tasks_query = """
        SELECT id, job_group_id, task_name, task_type
        FROM call_tasks 
        WHERE organization_id = %s AND task_type = 2 AND job_group_id IS NOT NULL AND job_group_id != ''
    """
    checking_tasks = execute_query(checking_tasks_query, (organization_id,))

    if checking_tasks:
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from describe_job_group import Sample as DescribeJobGroupSample  # type: ignore
        from .auto_call_utils import get_attr_value

        async def check_task_status(task_id, job_group_id, task_name):
            try:
                job_group_data = await DescribeJobGroupSample.main_async([], job_group_id)  # type: ignore
                if job_group_data:
                    job_group_status = get_attr_value(job_group_data, 'Status', 'status', default='')
                    progress = get_attr_value(job_group_data, 'Progress', 'progress', default=None)
                    is_really_completed = False
                    if progress:
                        total_jobs = get_attr_value(progress, 'TotalJobs', 'total_jobs', default=0) or 0
                        total_completed = get_attr_value(progress, 'TotalCompleted', 'total_completed', default=0) or 0
                        failed = get_attr_value(progress, 'Failed', 'failed', default=0) or 0
                        executing = get_attr_value(progress, 'Executing', 'executing', default=0) or 0
                        scheduling = get_attr_value(progress, 'Scheduling', 'scheduling', default=0) or 0
                        # 判断任务是否真正完成：
                        # 1. 所有任务已完成（包括成功和失败）：total_completed + failed >= total_jobs
                        # 2. 或者任务组状态为Completed/Finished/Stopped且没有正在执行的任务
                        if total_jobs > 0:
                            if (total_completed + failed) >= total_jobs and executing == 0 and scheduling == 0:
                                is_really_completed = True
                            elif job_group_status in ['Completed', 'Finished', 'Stopped'] and executing == 0 and scheduling == 0:
                                # 如果任务组状态已经是完成状态，且没有正在执行的任务，也认为已完成
                                is_really_completed = True

                    current_task_query = "SELECT task_type FROM call_tasks WHERE id = %s"
                    current_task_result = execute_query(current_task_query, (task_id,))
                    current_task_type = current_task_result[0]['task_type'] if current_task_result else None

                    if job_group_status in ['Completed', 'Finished', 'Stopped'] and is_really_completed and current_task_type and current_task_type < 3:
                        execute_update("UPDATE call_tasks SET task_type = 3 WHERE id = %s", (task_id,))
                        for task in tasks_result:
                            if task['id'] == task_id:
                                task['task_type'] = 3
                                break
                    elif job_group_status in ['Completed', 'Finished', 'Stopped'] and not is_really_completed and current_task_type == 3:
                        execute_update("UPDATE call_tasks SET task_type = 2 WHERE id = %s", (task_id,))
                        for task in tasks_result:
                            if task['id'] == task_id:
                                task['task_type'] = 2
                                break
            except Exception as e:
                print(f"检查任务 {task_id} 状态失败: {str(e)}")

        semaphore = asyncio.Semaphore(5)
        async def check_with_semaphore(task_id, job_group_id, task_name):
            async with semaphore:
                await check_task_status(task_id, job_group_id, task_name)

        await asyncio.gather(*[
            check_with_semaphore(task['id'], task['job_group_id'], task['task_name'])
            for task in checking_tasks
        ], return_exceptions=True)

    # 获取所有任务ID并查询线索信息
    task_ids = [task['id'] for task in tasks_result]
    if not task_ids:
        return {
            "status": "success",
            "code": 200,
            "message": "获取任务信息成功",
            "data": []
        }

    leads_query = """
        SELECT task_id, leads_name, leads_phone, call_status
        FROM leads_task_list 
        WHERE task_id IN ({})
        ORDER BY task_id, id
    """.format(','.join(['%s'] * len(task_ids)))
    leads_result = execute_query(leads_query, task_ids)

    # 将线索信息按task_id分组
    leads_by_task: Dict[int, List[Dict[str, Any]]] = {}
    for lead in leads_result:
        task_id = lead['task_id']
        if task_id not in leads_by_task:
            leads_by_task[task_id] = []
        call_status = lead['call_status'] if lead['call_status'] else "未开始"
        leads_by_task[task_id].append({
            "leads_name": lead['leads_name'],
            "leads_phone": lead['leads_phone'],
            "call_status": call_status
        })

    # 构建返回数据
    tasks_data: List[Dict[str, Any]] = []
    for task in tasks_result:
        task_id = task['id']
        leads_list = leads_by_task.get(task_id, [])
        size_desc = {}
        if task['size_desc']:
            try:
                size_desc = json.loads(task['size_desc'])
            except:
                size_desc = {}

        create_time_str = task['create_time'].strftime("%Y-%m-%d %H:%M:%S") if hasattr(task['create_time'], 'strftime') else str(task['create_time'])

        tasks_data.append({
            "id": task['id'],
            "task_name": task['task_name'],
            "create_time": create_time_str,
            "size_desc": size_desc,
            "leads_count": task['leads_count'],
            "task_type": task['task_type'],
            "organization_id": task['organization_id'],
            "create_name": task['create_name'],
            "script_id": task['script_id'],
            "leads_list": leads_list
        })

    return {
        "status": "success",
        "code": 200,
        "message": "获取任务信息成功",
        "data": tasks_data
    }

def query_task_execution_core_service(
    *,
    request: Any,
    task_info: Dict[str, Any]
) -> Dict[str, Any]:
    """查询外呼任务执行情况（仅读取数据库缓存的数据）。"""
    try:
        page_size = max(1, request.page_size)
        page = max(1, request.page)

        # 允许返回所有记录，包括 call_status 为空（未开始）的记录
        # 如果 call_job_id 为空，call_status 也为空，则视为未开始状态
        base_condition = "task_id = %s"
        condition_params: List[Any] = [request.task_id]
        if getattr(request, "only_followed", False):
            base_condition += " AND leads_follow_id IS NOT NULL"
        if getattr(request, "interest", None) in (0, 1, 2):
            base_condition += " AND is_interested = %s"
            condition_params.append(request.interest)

        count_query = f"""
            SELECT COUNT(*) as total
            FROM leads_task_list
            WHERE {base_condition}
        """
        count_result = execute_query(count_query, tuple(condition_params))
        total_jobs = count_result[0]['total'] if count_result and count_result[0].get('total') else 0
        if total_jobs == 0:
            error_message = "任务下没有已分配的外呼任务" if not getattr(request, "only_followed", False) else "任务下没有已跟进的记录"
            return {
                "status": "error",
                "code": 4008,
                "message": error_message,
                "data": {
                    "task_id": request.task_id,
                    "task_name": task_info.get('task_name', ''),
                    "task_type": task_info.get('task_type', 0),
                    "total_jobs": 0,
                    "updated_count": 0,
                    "error_count": 0,
                    "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "jobs_data": [],
                    "task_stats": {
                        "total_calls": 0,
                        "connected_calls": 0,
                        "not_connected_calls": 0,
                        "not_started_calls": 0,
                        "is_completed": task_info.get('task_type', 0) >= 3
                    },
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_pages": 0,
                        "total_count": 0
                    }
                }
            }

        total_pages = (total_jobs + page_size - 1) // page_size
        page = max(1, min(page, total_pages))
        offset = (page - 1) * page_size

        page_params = condition_params + [page_size, offset]
        page_query = f"""
            SELECT id,
                   leads_name,
                   leads_phone,
                   call_job_id,
                   call_status,
                   planed_time,
                   call_task_id,
                   call_conversation,
                   calling_number,
                   recording_url,
                   is_interested,
                   leads_follow_id
            FROM leads_task_list
            WHERE {base_condition}
            ORDER BY id
            LIMIT %s OFFSET %s
        """
        page_rows = execute_query(page_query, tuple(page_params))
        if not page_rows:
            return {
                "status": "error",
                "code": 4009,
                "message": "没有有效的call_job_id",
                "data": {
                    "task_id": request.task_id,
                    "task_name": task_info.get('task_name', ''),
                    "task_type": task_info.get('task_type', 0),
                    "total_jobs": total_jobs,
                    "updated_count": 0,
                    "error_count": 0,
                    "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "jobs_data": [],
                    "task_stats": {
                        "total_calls": total_jobs,
                        "connected_calls": 0,
                        "not_connected_calls": 0,
                        "is_completed": task_info.get('task_type', 0) >= 3
                    },
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_pages": total_pages,
                        "total_count": total_jobs
                    }
                }
            }

        follow_data_map: Dict[Any, Any] = {}
        follow_ids = [row['leads_follow_id'] for row in page_rows if row.get('leads_follow_id')]
        if follow_ids:
            follow_placeholders = ','.join(['%s'] * len(follow_ids))
            follow_query = f"""
                SELECT id, leads_id, follow_time, leads_remark,
                       frist_follow_time, new_follow_time, next_follow_time,
                       is_arrive, frist_arrive_time
                FROM dcc_leads_follow
                WHERE id IN ({follow_placeholders})
            """
            follow_result = execute_query(follow_query, follow_ids)
            follow_data_map = {row['id']: row for row in follow_result} if follow_result else {}

        def datetime_to_millis(dt: Optional[datetime]) -> Optional[int]:
            if not dt:
                return None
            return int(dt.timestamp() * 1000)

        def calculate_duration_from_conversation(conversation: Any) -> Optional[int]:
            """从 conversation 数据中计算通话时长（毫秒）"""
            if not conversation:
                return None
            
            # 如果 conversation 是列表，计算第一个和最后一个时间戳的差值
            if isinstance(conversation, list) and len(conversation) > 0:
                timestamps = []
                for item in conversation:
                    if isinstance(item, dict):
                        timestamp = item.get('Timestamp') or item.get('timestamp')
                        if timestamp:
                            try:
                                timestamps.append(int(timestamp))
                            except (ValueError, TypeError):
                                pass
                
                if len(timestamps) >= 2:
                    # 计算第一个和最后一个时间戳的差值（毫秒）
                    duration = max(timestamps) - min(timestamps)
                    return duration if duration > 0 else None
            
            return None

        jobs_data: List[Dict[str, Any]] = []
        for row in page_rows:
            # MySQL JSON类型字段返回时已经是字典/列表，不需要再次解析
            raw_conversation = row.get('call_conversation')
            conversation_data: Any = None
            if raw_conversation:
                # 如果已经是字典或列表类型，直接使用；否则尝试解析字符串
                if isinstance(raw_conversation, (dict, list)):
                    conversation_data = raw_conversation
                elif isinstance(raw_conversation, str):
                    try:
                        conversation_data = json.loads(raw_conversation)
                    except Exception:
                        conversation_data = raw_conversation
                else:
                    conversation_data = raw_conversation

            # 计算通话时长
            call_duration = calculate_duration_from_conversation(conversation_data)

            task_payload = {
                "TaskId": row.get('call_task_id'),
                "PlanedTime": datetime_to_millis(row.get('planed_time')),
                "Conversation": conversation_data,
                "CallingNumber": row.get('calling_number'),
                "Duration": call_duration  # 添加通话时长（毫秒）
            }
            job_entry = {
                "JobId": row.get('call_job_id'),
                "Status": row.get('call_status') or "",
                "Tasks": [task_payload] if any(task_payload.values()) else [],
                "RecordingUrl": row.get('recording_url'),
                "LeadsName": row.get('leads_name'),
                "LeadsPhone": row.get('leads_phone'),
                "calling_number": row.get('calling_number'),
                "is_interested": row.get('is_interested'),
                "follow_data": follow_data_map.get(row.get('leads_follow_id'))
            }
            jobs_data.append(job_entry)

        # 统计查询：使用与count_query相同的条件，避免重复查询
        # call_status 为空视为未开始
        stats_query = f"""
            SELECT 
                SUM(CASE WHEN call_status = 'Succeeded' THEN 1 ELSE 0 END) as connected_calls,
                SUM(CASE WHEN call_status != 'Succeeded' AND call_status IS NOT NULL AND call_status != '' THEN 1 ELSE 0 END) as not_connected_calls,
                SUM(CASE WHEN call_status IS NULL OR call_status = '' THEN 1 ELSE 0 END) as not_started_calls
            FROM leads_task_list 
            WHERE {base_condition}
        """
        stats_result = execute_query(stats_query, tuple(condition_params))

        task_stats = {
            "total_calls": total_jobs,
            "connected_calls": 0,
            "not_connected_calls": 0,
            "not_started_calls": 0,  # 未开始（call_status 为空）
            "is_completed": task_info.get('task_type', 0) >= 3
        }
        if stats_result and stats_result[0]:
            task_stats["connected_calls"] = int(stats_result[0].get('connected_calls', 0) or 0)
            task_stats["not_connected_calls"] = int(stats_result[0].get('not_connected_calls', 0) or 0)
            task_stats["not_started_calls"] = int(stats_result[0].get('not_started_calls', 0) or 0)

        return {
            "status": "success",
            "code": 200,
            "message": "查询外呼任务执行情况成功",
            "data": {
                "task_id": request.task_id,
                "task_name": task_info.get('task_name', ''),
                "task_type": task_info.get('task_type', 0),
                "total_jobs": total_jobs,
                "updated_count": 0,
                "error_count": 0,
                "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "jobs_data": jobs_data,
                "task_stats": task_stats,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "total_count": total_jobs
                }
            }
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[query_task_execution_core_service] 错误: {str(e)}")
        print(f"[query_task_execution_core_service] 错误堆栈: {error_trace}")
        return {
            "status": "error",
            "code": 5000,
            "message": f"查询外呼任务执行情况失败: {str(e)}",
            "data": {
                "task_id": getattr(request, 'task_id', 0),
                "task_name": task_info.get('task_name', '') if task_info else '',
                "task_type": task_info.get('task_type', 0) if task_info else 0,
                "total_jobs": 0,
                "updated_count": 0,
                "error_count": 0,
                "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "jobs_data": [],
                "task_stats": {
                    "total_calls": 0,
                    "connected_calls": 0,
                    "not_connected_calls": 0,
                    "is_completed": False
                },
                "pagination": {
                    "page": 1,
                    "page_size": 20,
                    "total_pages": 0,
                    "total_count": 0
                }
            }
        }

