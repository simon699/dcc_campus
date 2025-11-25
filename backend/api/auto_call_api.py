from fastapi import APIRouter, HTTPException, Depends, Query, Body
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import threading
import asyncio
import os
from database.db import execute_query, execute_update
from .auth import verify_access_token
from openAPI.ali_bailian_api import ali_bailian_api
from openAPI.suspend_jobs import Sample as SuspendJobsSample
from openAPI.resumeJobs import Sample as ResumeJobsSample

auto_call_router = APIRouter(tags=["自动外呼任务"])

# 系统常量配置
CALL_STATUS_CONSTANTS = {
    "NOT_STARTED": os.getenv("CALL_STATUS_NOT_STARTED", "未开始"),
    "IN_PROGRESS": os.getenv("CALL_STATUS_IN_PROGRESS", "进行中"),
    "COMPLETED": os.getenv("CALL_STATUS_COMPLETED", "已完成"),
    "FAILED": os.getenv("CALL_STATUS_FAILED", "失败")
}

class SizeDesc(BaseModel):
    """筛选条件"""
    leads_type: List[str]  # 线索等级 - 支持多选
    leads_product: List[str]  # 线索产品 - 支持多选
    # 时间筛选条件 - 支持多区间，格式：开始时间,结束时间;开始时间,结束时间
    first_follow_start: Optional[str] = None  # 首次跟进开始时间
    first_follow_end: Optional[str] = None    # 首次跟进结束时间
    latest_follow_start: Optional[str] = None # 最近跟进开始时间
    latest_follow_end: Optional[str] = None   # 最近跟进结束时间
    next_follow_start: Optional[str] = None   # 下次跟进开始时间
    next_follow_end: Optional[str] = None     # 下次跟进结束时间
    is_arrive: Optional[List[int]] = None     # 是否到店 - 支持多选
    # 前端兼容字段 - 多时间区间数组
    first_follow_ranges: Optional[List[str]] = None  # 首次跟进时间区间数组
    latest_follow_ranges: Optional[List[str]] = None # 最近跟进时间区间数组
    next_follow_ranges: Optional[List[str]] = None   # 下次跟进时间区间数组

class CreateAutoCallTaskRequest(BaseModel):
    """创建自动外呼任务请求"""
    task_name: str  # 任务名称
    script_id: str = ""  # 脚本ID
    size_desc: SizeDesc  # 筛选条件

class CreateAutoCallTaskResponse(BaseModel):
    """创建自动外呼任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@auto_call_router.post("/create-autoCall-tasks", response_model=CreateAutoCallTaskResponse)
async def create_auto_call_task(
    request: CreateAutoCallTaskRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    创建自动外呼任务（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import create_auto_call_task_service
        result = create_auto_call_task_service(request=request, token=token)

        if result.get("status") != "success":
            raise HTTPException(status_code=400, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"创建自动外呼任务失败: {str(e)}"
            }
        )


class TaskTypeStats(BaseModel):
    """任务类型统计"""
    task_type: int  # 任务类型: 1-已创建；2-开始外呼；3-外呼完成；4-已删除
    count: int  # 该类型的任务数量
    leads_count: int  # 该类型的线索总数

class TaskStatsResponse(BaseModel):
    """任务统计响应"""
    status: str
    code: int
    message: str
    data: List[TaskTypeStats]

# 任务统计缓存（内存缓存，5分钟过期）
_task_stats_cache = {}
_cache_expiry = 300  # 5分钟

def _get_cached_task_stats(cache_key: str):
    """获取缓存的任务统计"""
    if cache_key in _task_stats_cache:
        data, timestamp = _task_stats_cache[cache_key]
        if datetime.now().timestamp() - timestamp < _cache_expiry:
            return data
        else:
            del _task_stats_cache[cache_key]
    return None

def _set_cached_task_stats(cache_key: str, data: any):
    """设置缓存的任务统计"""
    _task_stats_cache[cache_key] = (data, datetime.now().timestamp())
    # 清理过期缓存（每100次操作清理一次）
    if len(_task_stats_cache) > 1000:
        current_time = datetime.now().timestamp()
        expired_keys = [k for k, (_, t) in _task_stats_cache.items() if current_time - t >= _cache_expiry]
        for k in expired_keys:
            del _task_stats_cache[k]

@auto_call_router.get("/task-stats", response_model=TaskStatsResponse)
async def get_task_stats(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取任务统计信息（精简版）：控制器仅做基本校验与调用服务；保留缓存和状态检查逻辑。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        # 获取用户组织ID（用于缓存和状态检查）
        user_id = token.get("user_id")
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "用户未绑定组织或组织ID无效"}
            )
        organization_id = org_result[0]['dcc_user_org_id']

        # 状态检查逻辑（保留在 API 层，因为这是接口层的优化）
        active_task_check = "SELECT COUNT(*) as active_count FROM call_tasks WHERE organization_id = %s AND task_type IN (2, 3)"
        active_result = execute_query(active_task_check, (organization_id,))
        active_count = active_result[0]['active_count'] if active_result else 0


        # 检查缓存
        cache_key = f"task_stats_{organization_id}"
        cached_data = _get_cached_task_stats(cache_key)
        if cached_data:
            return cached_data

        # 调用服务层获取统计数据
        from .auto_call_service import get_task_stats_service
        result = get_task_stats_service(token=token)

        if result.get("status") != "success":
            raise HTTPException(status_code=400, detail=result)

        # 转换数据格式以匹配 TaskTypeStats
        stats_list = [
            TaskTypeStats(
                task_type=item['task_type'],
                count=item['count'],
                leads_count=item['leads_count']
            )
            for item in result['data']
        ]
        result['data'] = stats_list

        # 缓存结果
        _set_cached_task_stats(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"获取任务统计信息失败: {str(e)}"
            }
        )


class TaskLeadsInfo(BaseModel):
    """任务线索信息"""
    leads_name: str  # 线索名称
    leads_phone: str  # 线索手机号
    call_status: str  # 呼叫状态

class TaskInfo(BaseModel):
    """任务信息"""
    id: int  # 任务ID
    task_name: str  # 任务名称
    create_time: str  # 创建时间
    size_desc: Dict[str, Any]  # 筛选条件JSON格式
    leads_count: int  # 线索数量
    task_type: int  # 任务类型: 1-已创建；2-开始外呼；3-外呼完成；4-已删除
    organization_id: str  # 组织ID
    create_name: str  # 创建人名称
    script_id: Optional[str]  # 脚本ID
    leads_list: List[TaskLeadsInfo]  # 线索列表

class GetTasksResponse(BaseModel):
    """获取任务列表响应"""
    status: str
    code: int
    message: str
    data: List[TaskInfo]

@auto_call_router.get("/tasks", response_model=GetTasksResponse)
async def get_tasks(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取任务列表（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import get_tasks_service
        result = await get_tasks_service(token=token)

        if result.get("status") != "success":
            raise HTTPException(status_code=400, detail=result)

        # 转换数据格式以匹配 TaskInfo
        tasks_data = []
        for item in result['data']:
            tasks_data.append(TaskInfo(
                id=item['id'],
                task_name=item['task_name'],
                create_time=item['create_time'],
                size_desc=item['size_desc'],
                leads_count=item['leads_count'],
                task_type=item['task_type'],
                organization_id=item['organization_id'],
                create_name=item['create_name'],
                script_id=item['script_id'],
                leads_list=[
                    TaskLeadsInfo(
                        leads_name=lead['leads_name'],
                        leads_phone=lead['leads_phone'],
                        call_status=lead['call_status']
                    )
                    for lead in item['leads_list']
                ]
            ))

        return {
            "status": "success",
            "code": 200,
            "message": "获取任务信息成功",
            "data": tasks_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"获取任务信息失败: {str(e)}"
            }
        )


class UpdateScriptIdRequest(BaseModel):
    """更新脚本ID请求"""
    task_id: int  # 任务ID
    script_id: str  # 脚本ID

class UpdateScriptIdResponse(BaseModel):
    """更新脚本ID响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@auto_call_router.post("/update-script-id", response_model=UpdateScriptIdResponse)
async def update_script_id(
    request: UpdateScriptIdRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    更新call_tasks表的script_id（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import update_script_id_service
        result = update_script_id_service(request=request, token=token)

        if result.get("status") != "success":
            status_code = 404 if result.get("code") == 4004 else 400
            raise HTTPException(status_code=status_code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"更新脚本ID失败: {str(e)}"
            }
        )


class StartCallTaskRequest(BaseModel):
    """开始外呼任务请求"""
    task_id: int  # 任务ID

class StartCallTaskResponse(BaseModel):
    """开始外呼任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@auto_call_router.post("/start-call-task", response_model=StartCallTaskResponse)
async def start_call_task(
    request: StartCallTaskRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    开始进行外呼任务（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import start_call_task_service
        result = start_call_task_service(request=request, token=token)

        if result.get("status") != "success":
            status_code = 500 if result.get("code", 0) >= 5000 else 400
            raise HTTPException(status_code=status_code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"开始外呼任务失败: {str(e)}"
            }
        )


class QueryTaskExecutionRequest(BaseModel):
    """查询外呼任务执行情况请求"""
    task_id: int  # 任务ID
    page: int = 1  # 页码，从1开始
    page_size: int = 20  # 每页数量，默认20
    skip_recording: bool = True  # 是否跳过录音URL获取（默认跳过以提升性能）
    only_followed: bool = False  # 是否只查询已跟进的记录（默认False，查询所有记录）
    interest: Optional[int] = None  # 按意向筛选：0=无法判断,1=有意向,2=无意向；None=不限
    apply_update: bool = False  # 是否将查询结果回写数据库、触发AI与状态推进（默认仅查询缓存）

class TaskExecutionResponse(BaseModel):
    """查询外呼任务执行情况响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


def _query_task_execution_core(
    *,
    request: "QueryTaskExecutionRequest",
    task_info: Dict[str, Any],
    job_group_status: Optional[str]
) -> Dict[str, Any]:
    """查询外呼任务执行核心逻辑。

    仅负责：
    - 读取当前页关联的 call_job_id
    - 调用外部 list_jobs 获取任务执行数据
    - 组装返回数据（含统计与补充字段）
    - 基于 request.apply_update 决定是否执行数据库更新与衍生操作
    """
    # 1. 直接查询已有的 call_job_id（按分页），不再通过 list_jobs_by_group 获取
    page_size = max(1, request.page_size)
    page = max(1, request.page)

    # 先查询总数
    count_condition = "task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''"
    count_params = [request.task_id]

    # 如果 apply_update=True（自动化任务），处理 call_status 为空或 call_conversation 为空的记录
    # 确保能获取到完整的通话数据（call_status 和 call_conversation）
    if request.apply_update:
        count_condition += " AND ((call_status IS NULL OR call_status = '') OR (call_conversation IS NULL OR call_conversation = ''))"

    if request.only_followed:
        count_condition += " AND leads_follow_id IS NOT NULL"

    # 按意向筛选
    if request.interest is not None and request.interest in (0, 1, 2):
        count_condition += " AND is_interested = %s"
        count_params.append(request.interest)

    count_query = f"""
        SELECT COUNT(*) as total
        FROM leads_task_list 
        WHERE {count_condition}
    """
    count_result = execute_query(count_query, tuple(count_params))
    total_jobs = count_result[0]['total'] if count_result and count_result[0].get('total') else 0

    if total_jobs == 0:
        error_message = "任务下没有已分配的外呼任务" if not request.only_followed else "任务下没有已跟进的记录"
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": 4008,
                "message": error_message
            }
        )

    # 计算分页信息
    total_pages = (total_jobs + page_size - 1) // page_size  # 向上取整
    page = max(1, min(request.page, total_pages))  # 确保页码在有效范围内

    # 在数据库层面分页查询当前页的 call_job_id
    offset = (page - 1) * page_size
    leads_query_params = count_params + [page_size, offset]
    leads_query = f"""
        SELECT call_job_id, reference_id, leads_phone
        FROM leads_task_list 
        WHERE {count_condition}
        ORDER BY id
        LIMIT %s OFFSET %s
    """

    leads_result = execute_query(leads_query, tuple(leads_query_params))

    if not leads_result:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": 4009,
                "message": "没有有效的call_job_id"
            }
        )

    # 提取当前页的call_job_id
    paginated_call_job_ids = [lead['call_job_id'] for lead in leads_result if lead.get('call_job_id')]

    if not paginated_call_job_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": 4009,
                "message": "没有有效的call_job_id"
            }
        )
    
    # 构建 reference_id 和 phone_number 的映射
    db_ref_id_map = {}  # reference_id -> call_job_id
    db_phone_map = {}   # phone -> call_job_id
    db_job_id_set = set(paginated_call_job_ids)
    
    for lead in leads_result:
        call_job_id = lead['call_job_id']
        reference_id = lead.get('reference_id')
        leads_phone = lead.get('leads_phone')
        
        if reference_id and str(reference_id).strip():
            db_ref_id_map[str(reference_id).strip()] = call_job_id
        if leads_phone:
            db_phone_map[str(leads_phone)] = call_job_id

    # 2. 调用list_jobs接口获取任务执行状态（只查询当前页的数据）
    # 注意：阿里云 API 可能限制单次请求的 job_id 数量（通常为 100），需要分批处理
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
    from list_jobs import Sample as ListJobsSample
    from download_recording import Sample as DownloadRecordingSample

    # 分批处理，每批最多 100 个 job_id（避免 API 限制）
    batch_size = 100
    all_jobs_data = []
    batch_errors = []
    
    try:
        # 调试日志：记录调用阿里云接口
        print(f"[query-task-execution] 准备调用阿里云接口，task_id={request.task_id}, page={page}, job_ids数量={len(paginated_call_job_ids)}")
        print(f"[query-task-execution] job_ids示例: {paginated_call_job_ids[:3]}...")  # 只打印前3个
        
        # 分批调用 API
        for i in range(0, len(paginated_call_job_ids), batch_size):
            batch = paginated_call_job_ids[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(paginated_call_job_ids) + batch_size - 1) // batch_size
            
            try:
                print(f"[query-task-execution] 调用第 {batch_num}/{total_batches} 批，job_ids数量={len(batch)}")
                batch_jobs_data = ListJobsSample.main([], job_ids=batch)
                
                if batch_jobs_data:
                    if isinstance(batch_jobs_data, list):
                        all_jobs_data.extend(batch_jobs_data)
                    else:
                        all_jobs_data.append(batch_jobs_data)
                    
                    print(f"[query-task-execution] 第 {batch_num} 批调用成功，返回数据数量={len(batch_jobs_data) if isinstance(batch_jobs_data, list) else 1}")
                else:
                    print(f"[query-task-execution] 第 {batch_num} 批返回空数据")
                    
            except Exception as batch_e:
                error_msg = f"第 {batch_num} 批调用失败: {str(batch_e)}"
                print(f"[query-task-execution] {error_msg}")
                batch_errors.append(error_msg)
                # 继续处理下一批，不中断整个流程
        
        # 如果所有批次都失败，抛出异常
        if not all_jobs_data and batch_errors:
            raise Exception(f"所有批次调用都失败: {'; '.join(batch_errors)}")
        
        # 调试日志：记录最终结果
        print(f"[query-task-execution] 所有批次调用完成，总返回数据数量={len(all_jobs_data)}")
        if batch_errors:
            print(f"[query-task-execution] 警告：有 {len(batch_errors)} 个批次调用失败: {'; '.join(batch_errors)}")

    except Exception as e:
        # 调试日志：记录调用失败
        print(f"[query-task-execution] 阿里云接口调用失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5003,
                "message": f"获取外呼任务状态失败: {str(e)}"
            }
        )
    
    # 使用合并后的数据
    jobs_data = all_jobs_data

    # 3. 解析返回数据并更新leads_task_list表（聚合变更，批量更新）
    updated_count = 0
    error_count = 0

    # 如果没有获取到job数据，直接返回空结果（total_jobs已在前面计算）
    if not jobs_data:
        return {
            "status": "success",
            "code": 200,
            "message": "未获取到外呼任务数据",
            "data": {
                "task_id": request.task_id,
                "task_name": task_info['task_name'],
                "task_type": task_info['task_type'],
                "total_jobs": total_jobs,
                "updated_count": 0,
                "error_count": 0,
                "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "jobs_data": [],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "total_count": total_jobs
                }
            }
        }

    # 优化：批量查询所有job的当前状态，避免N+1查询问题
    # 通过 reference_id 和 phone_number 匹配，找出实际匹配到的 call_job_id
    from .auto_call_utils import safe_getattr
    
    matched_job_ids = set()
    job_id_to_call_job_id_map = {}  # JobId -> call_job_id 映射
    
    for job_data in jobs_data:
        job_id = job_data.get('JobId')
        contacts = job_data.get('Contacts', [])
        
        # 优先使用 reference_id 匹配
        matched = False
        matched_call_job_id = None
        
        if contacts:
            for contact in contacts:
                if isinstance(contact, dict):
                    reference_id = safe_getattr(contact, 'ReferenceId', 'referenceId', 'reference_id', default=None)
                    phone_number = safe_getattr(contact, 'PhoneNumber', 'phoneNumber', 'phone_number', default=None)
                    
                    # 优先使用 reference_id 匹配
                    if reference_id and str(reference_id).strip():
                        ref_id_str = str(reference_id).strip()
                        if ref_id_str in db_ref_id_map:
                            matched_call_job_id = db_ref_id_map[ref_id_str]
                            matched_job_ids.add(matched_call_job_id)
                            matched = True
                            if job_id:
                                job_id_to_call_job_id_map[job_id] = matched_call_job_id
                            break
                    
                    # 如果没有 reference_id，使用 phone_number 匹配
                    if not matched and phone_number:
                        phone_str = str(phone_number)
                        if phone_str in db_phone_map:
                            matched_call_job_id = db_phone_map[phone_str]
                            matched_job_ids.add(matched_call_job_id)
                            matched = True
                            if job_id:
                                job_id_to_call_job_id_map[job_id] = matched_call_job_id
                            break
        
        # 如果通过 reference_id 和 phone_number 都没匹配到，但 JobId 在请求列表中，也算匹配
        if not matched and job_id and job_id in db_job_id_set:
            matched_job_ids.add(job_id)
            matched_call_job_id = job_id
            job_id_to_call_job_id_map[job_id] = job_id
    
    # 找出未匹配到的 call_job_id（在请求中但不在返回结果中）
    unmatched_job_ids = [job_id for job_id in paginated_call_job_ids if job_id not in matched_job_ids]
    
    # 使用匹配到的 call_job_id 进行查询
    job_ids = list(matched_job_ids)

    # 批量查询所有job的当前数据状态
    current_data_map = {}
    follow_data_map = {}

    if job_ids:
        # 一次性查询所有job的当前状态
        placeholders = ','.join(['%s'] * len(job_ids))
        batch_query = f"""
            SELECT call_job_id, call_status, planed_time, call_task_id, 
                   call_conversation, calling_number, recording_url,
                   is_interested, leads_follow_id
            FROM leads_task_list 
            WHERE task_id = %s AND call_job_id IN ({placeholders})
        """
        batch_result = execute_query(batch_query, (request.task_id, *job_ids))

        # 构建字典，O(1) 查找
        current_data_map = {row['call_job_id']: row for row in batch_result} if batch_result else {}

        # 批量查询跟进数据
        follow_ids = [row['leads_follow_id'] for row in batch_result if row.get('leads_follow_id')]
        if follow_ids:
            follow_placeholders = ','.join(['%s'] * len(follow_ids))
            follow_batch_query = f"""
                SELECT id, leads_id, follow_time, leads_remark, 
                       frist_follow_time, new_follow_time, next_follow_time,
                       is_arrive, frist_arrive_time
                FROM dcc_leads_follow 
                WHERE id IN ({follow_placeholders})
            """
            follow_batch_result = execute_query(follow_batch_query, follow_ids)
            follow_data_map = {row['id']: row for row in follow_batch_result} if follow_batch_result else {}

    # 用于检查所有任务是否都完成
    task_statuses = []

    updates_batch: list[tuple] = []
    for job_data in jobs_data:
        job_id = job_data.get('JobId')
        # 通过映射找到对应的 call_job_id
        call_job_id = job_id_to_call_job_id_map.get(job_id, job_id)
        tasks = job_data.get('Tasks', [])
        # 记录任务状态用于后续检查
        task_statuses.append(job_data.get('Status', ''))
        job_status = job_data.get('Status', '')

        if tasks:
            # 获取最后一个任务的信息
            last_task = tasks[-1]

            # 解析任务数据
            planned_time = last_task.get('PlanedTime', None)
            call_task_id = last_task.get('TaskId', '')
            conversation = last_task.get('Conversation', '')
            actual_time = last_task.get('ActualTime', None)
            calling_number = last_task.get('CallingNumber', '')

            # 转换时间戳
            plan_time = None
            call_time = None

            if planned_time:
                try:
                    plan_time = datetime.fromtimestamp(int(planned_time) / 1000)
                except:
                    plan_time = None

            if actual_time:
                try:
                    call_time = datetime.fromtimestamp(int(actual_time) / 1000)
                except:
                    call_time = None

            # 优化：从批量查询的结果中获取当前数据，而不是单独查询
            # 使用 call_job_id 而不是 job_id 来查找
            current_data = current_data_map.get(call_job_id, {})
            current_status = current_data.get('call_status')
            current_plan_time = current_data.get('planed_time')
            current_call_task_id = current_data.get('call_task_id')
            current_conversation = current_data.get('call_conversation')
            current_calling_number = current_data.get('calling_number')
            current_recording_url = current_data.get('recording_url')

            # 获取录音URL - 如果skip_recording为True，跳过耗时操作
            recording_url = None
            if (not request.skip_recording) and job_status == 'Succeeded' and call_task_id:
                current_recording_url = current_recording_url
                try:
                    new_recording_url = DownloadRecordingSample.main([], task_id=call_task_id)
                    if new_recording_url:
                        recording_url = new_recording_url
                    elif current_recording_url:
                        recording_url = current_recording_url
                except Exception as e:
                    print(f"获取录音URL失败 - call_task_id: {call_task_id}, 错误: {str(e)}")
                    if current_recording_url:
                        recording_url = current_recording_url
            elif job_status == 'Succeeded' and call_task_id:
                recording_url = current_recording_url

            # 检查是否有变化（使用批量查询的结果）
            try:
                # 序列化conversation用于比较
                new_conversation_str = json.dumps(conversation) if conversation else None

                # 比较时间（允许秒级差异）
                plan_time_match = False
                if current_plan_time and plan_time:
                    time_diff = abs((current_plan_time - plan_time).total_seconds())
                    plan_time_match = time_diff < 1
                elif not current_plan_time and not plan_time:
                    plan_time_match = True

                # 检查是否有变化
                has_changes = (
                    current_status != job_status or
                    not plan_time_match or
                    current_call_task_id != call_task_id or
                    current_conversation != new_conversation_str or
                    current_calling_number != calling_number or
                    current_recording_url != recording_url
                )

                if not has_changes:
                    if updated_count == 0 and error_count == 0:
                        print(f"[query-task-execution] job_id={job_id} 数据无变化，跳过数据库更新（这是正常的性能优化）")
                    continue

                # 重要：只有 call_status 为最终状态（'Succeeded' 或 'Failed'）时才保存到数据库
                # 中间状态（如 'Executing'）不保存，继续轮询获取
                if job_status not in ('Succeeded', 'Failed'):
                    print(f"[query-task-execution] job_id={job_id} call_status={job_status} 不是最终状态，跳过数据库更新，继续轮询")
                    continue

                # 收集变更（是否执行更新由 apply_update 决定）
                # 使用 call_job_id 而不是 job_id
                update_params = (
                    job_status,
                    plan_time,
                    call_task_id,
                    json.dumps(conversation) if conversation else None,
                    calling_number,
                    recording_url,
                    request.task_id,
                    call_job_id
                )
                updates_batch.append(update_params)

            except Exception as e:
                error_count += 1
                print(f"更新任务 {job_id} 失败: {str(e)}")

    # 执行批量更新（如果 apply_update=True 且有变更）
    if request.apply_update and updates_batch:
        update_sql = """
            UPDATE leads_task_list
            SET call_status = %s,
                planed_time = %s,
                call_task_id = %s,
                call_conversation = %s,
                calling_number = %s,
                recording_url = %s
            WHERE task_id = %s AND call_job_id = %s
        """
        try:
            # 批量执行更新
            for update_params in updates_batch:
                try:
                    execute_update(update_sql, update_params)
                    updated_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"[query-task-execution] 批量更新失败: {str(e)}, params={update_params[:2]}...")
            
            print(f"[query-task-execution] 批量更新完成: 成功 {updated_count} 条，失败 {error_count} 条")
        except Exception as e:
            print(f"[query-task-execution] 批量更新执行失败: {str(e)}")
            error_count += len(updates_batch)

    # 返回前将 is_interested 与 follow_data 注入到每条 job_data
    for job_data in jobs_data:
        job_id = job_data.get('JobId')
        current_job_data = current_data_map.get(job_id, {})
        is_interested = current_job_data.get('is_interested')
        leads_follow_id = current_job_data.get('leads_follow_id')
        follow_data = follow_data_map.get(leads_follow_id) if leads_follow_id else None
        job_data['is_interested'] = is_interested
        job_data['follow_data'] = follow_data

    # 任务统计
    stats_query = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN call_status = 'Succeeded' THEN 1 ELSE 0 END) as connected_calls,
            SUM(CASE WHEN call_status != 'Succeeded' AND call_status IS NOT NULL AND call_status != '' THEN 1 ELSE 0 END) as not_connected_calls
        FROM leads_task_list 
        WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
    """
    stats_result = execute_query(stats_query, (request.task_id,))

    is_completed = task_info['task_type'] >= 3
    if job_group_status and job_group_status in ['Completed', 'Finished', 'Stopped']:
        is_completed = True

    task_stats = {
        "total_calls": total_jobs,
        "connected_calls": 0,
        "not_connected_calls": 0,
        "is_completed": is_completed
    }

    if stats_result and stats_result[0]:
        task_stats["connected_calls"] = stats_result[0].get('connected_calls', 0) or 0
        task_stats["not_connected_calls"] = stats_result[0].get('not_connected_calls', 0) or 0

    return {
        "status": "success",
        "code": 200,
        "message": "查询外呼任务执行情况成功",
        "data": {
            "task_id": request.task_id,
            "task_name": task_info['task_name'],
            "task_type": task_info['task_type'],
            "total_jobs": total_jobs,
            "updated_count": updated_count,
            "error_count": error_count,
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

@auto_call_router.post("/query-task-execution", response_model=TaskExecutionResponse)
async def query_task_execution(
    request: QueryTaskExecutionRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    查询外呼任务执行情况
    
    根据task_id查询外呼任务的执行情况，包括：
    1. 在leads_task_list中找到对应task_id的call_job_idh
    2. 调用list_jobs接口获取任务执行状态
    3. 解析返回数据并更新leads_task_list表
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 获取用户信息
        user_id = token.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "令牌中缺少用户ID信息"
                }
            )
        
        # 获取用户组织ID
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "用户未绑定组织或组织ID无效"
                }
            )
        
        organization_id = org_result[0]['dcc_user_org_id']
        
        # 验证任务是否存在且属于该组织
        task_query = """
            SELECT id, task_name, task_type, job_group_id
            FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        
        task_result = execute_query(task_query, (request.task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "code": 4004,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        task_info = task_result[0]
        
        from .auto_call_service import query_task_execution_core_service
        return query_task_execution_core_service(
            request=request,
            task_info=task_info
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"查询外呼任务执行情况失败: {str(e)}"
            }
        )




# ---- 后台运行：分批查询执行（run_id 模式） ----
class StartExecutionRunRequest(BaseModel):
    """启动后台执行运行"""
    task_id: int
    batch_size: int = 100  # 每批处理 job 数量
    sleep_ms: int = 200    # 批间 sleep 毫秒
    skip_recording: bool = True  # 后台是否下载录音（默认否）


class StartExecutionRunResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Dict[str, Any]


class GetExecutionRunRequest(BaseModel):
    run_id: int


class GetExecutionRunResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Dict[str, Any]


def _ensure_execution_runs_table():
    """确保运行记录表存在。"""
    create_sql = """
    CREATE TABLE IF NOT EXISTS call_task_execution_runs (
        id SERIAL PRIMARY KEY,
        task_id INT NOT NULL,
        params JSON NULL,
        status VARCHAR(32) NOT NULL,
        total_jobs INT DEFAULT 0,
        processed_jobs INT DEFAULT 0,
        error TEXT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
    )
    """
    try:
        execute_update(create_sql)
    except Exception:
        pass


def _update_run_progress(run_id: int, *, processed: int = None, status: str = None, error: str = None, total: int = None):
    sets = []
    params: list[Any] = []
    if processed is not None:
        sets.append("processed_jobs = %s")
        params.append(processed)
    if status is not None:
        sets.append("status = %s")
        params.append(status)
    if error is not None:
        sets.append("error = %s")
        params.append(error)
    if total is not None:
        sets.append("total_jobs = %s")
        params.append(total)
    sets.append("updated_at = %s")
    params.append(datetime.now())
    if not sets:
        return
    sql = f"UPDATE call_task_execution_runs SET {', '.join(sets)} WHERE id = %s"
    params.append(run_id)
    execute_update(sql, tuple(params))


def _background_execute_run(run_id: int, task_id: int, batch_size: int, sleep_ms: int, skip_recording: bool):
    """后台线程：分批 list_jobs 并入库更新。"""
    try:
        # 取得该任务的待处理 job_ids
        job_rows = execute_query(
            """
            SELECT call_job_id
            FROM leads_task_list
            WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
            ORDER BY id
            """,
            (task_id,)
        )
        job_ids = [r['call_job_id'] for r in job_rows]
        _update_run_progress(run_id, total=len(job_ids), status="running", processed=0)

        # 动态导入 OpenAPI
        import sys as _sys, os as _os
        _sys.path.append(_os.path.join(_os.path.dirname(__file__), '..', 'openAPI'))
        from list_jobs import Sample as ListJobsSample  # type: ignore
        from download_recording import Sample as DownloadRecordingSample  # type: ignore

        processed = 0
        for i in range(0, len(job_ids), max(1, batch_size)):
            batch = job_ids[i:i + batch_size]
            try:
                jobs_data = ListJobsSample.main([], job_ids=batch)
            except Exception as e:
                _update_run_progress(run_id, status="running", error=f"list_jobs失败: {str(e)}")
                jobs_data = []

            # 入库更新（与 query_task_execution 的写法一致，精简录音下载）
            for job_data in jobs_data or []:
                job_id = job_data.get('JobId')
                tasks = job_data.get('Tasks', [])
                job_status = job_data.get('Status', '')
                if not tasks:
                    continue
                last_task = tasks[-1]
                planned_time = last_task.get('PlanedTime')
                call_task_id = last_task.get('TaskId', '')
                conversation = last_task.get('Conversation', '')
                calling_number = last_task.get('CallingNumber', '')

                plan_time = None
                if planned_time:
                    try:
                        plan_time = datetime.fromtimestamp(int(planned_time) / 1000)
                    except:
                        plan_time = None

                current_recording_url = None
                if job_status == 'Succeeded':
                    try:
                        rec = execute_query(
                            """
                            SELECT recording_url FROM leads_task_list
                            WHERE task_id = %s AND call_job_id = %s
                            """,
                            (task_id, job_id)
                        )
                        if rec:
                            current_recording_url = rec[0].get('recording_url')
                    except Exception:
                        pass

                recording_url = None
                if (not skip_recording) and call_task_id and job_status == 'Succeeded':
                    try:
                        new_url = DownloadRecordingSample.main([], task_id=call_task_id)
                        if new_url:
                            recording_url = new_url
                        elif current_recording_url:
                            recording_url = current_recording_url
                    except Exception:
                        if current_recording_url:
                            recording_url = current_recording_url
                else:
                    recording_url = current_recording_url

                # 重要：只有 call_status 为最终状态（'Succeeded' 或 'Failed'）时才保存到数据库
                # 中间状态（如 'Executing'）不保存，继续轮询获取
                if job_status in ('Succeeded', 'Failed'):
                    try:
                        execute_update(
                            """
                            UPDATE leads_task_list
                            SET call_status = %s,
                                planed_time = %s,
                                call_task_id = %s,
                                call_conversation = %s,
                                calling_number = %s,
                                recording_url = %s
                            WHERE task_id = %s AND call_job_id = %s
                            """,
                            (
                                job_status,
                                plan_time,
                                call_task_id,
                                json.dumps(conversation) if conversation else None,
                                calling_number,
                                recording_url,
                                task_id,
                                job_id,
                            )
                        )
                    except Exception:
                        pass
                else:
                    print(f"[_background_execute_run] job_id={job_id} call_status={job_status} 不是最终状态，跳过数据库更新，继续轮询")

                # 后台批处理也不在此处直接触发AI；AI在首次生成跟进时机由异步线程负责

            processed += len(batch)
            _update_run_progress(run_id, processed=processed)

            # 批间 sleep
            try:
                import time as _time
                _time.sleep(max(0, sleep_ms) / 1000.0)
            except Exception:
                pass

        _update_run_progress(run_id, status="done")
    except Exception as e:
        _update_run_progress(run_id, status="failed", error=str(e))


@auto_call_router.post("/start-query-execution-run", response_model=StartExecutionRunResponse)
async def start_query_execution_run(
    request: StartExecutionRunRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """后台执行运行功能已禁用 - 仅保留查询数据库能力"""
    raise HTTPException(
        status_code=403,
        detail={
            "status": "error",
            "code": 4003,
            "message": "后台执行运行功能已禁用，仅支持查询数据库"
        }
    )


@auto_call_router.get("/get-query-execution-run", response_model=GetExecutionRunResponse)
async def get_query_execution_run(
    run_id: int,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """查询运行进度。"""
    _ensure_execution_runs_table()
    rows = execute_query("SELECT * FROM call_task_execution_runs WHERE id=%s", (run_id,))
    if not rows:
        raise HTTPException(status_code=404, detail={"status":"error","code":4004,"message":"run_id不存在"})
    row = rows[0]
    return {
        "status": "success",
        "code": 200,
        "message": "ok",
        "data": row
    }

def get_leads_follow_id(call_job_id, *, force: bool = False, dry_run: bool = False):
    """
    根据call_job_id获取通话记录，调用AI接口分析，并保存跟进记录
    
    Args:
        call_job_id: 通话任务ID
        
    Returns:
        dict: 包含状态和跟进记录ID的响应
    """
    try:
        # 1. 根据call_job_id查找leads_task_list中的call_conversation和leads_id
        query = """
            SELECT call_conversation, leads_id, leads_name, leads_phone, leads_follow_id, call_status
            FROM leads_task_list 
            WHERE call_job_id = %s
        """
        
        result = execute_query(query, (call_job_id,))
        
        if not result:
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
        has_conversation = bool(call_conversation)
        try:
            # 额外调试信息，方便定位为何没有打印 prompt
            print(f"[get_leads_follow_id] call_job_id={call_job_id}, leads_id={leads_id}, call_status={call_status}, has_conversation={has_conversation}, leads_follow_id={leads_follow_id}")
        except Exception:
            pass
        
        # 必须获取到 call_status 之后，才进行创建跟进记录
        if not call_status or call_status == '':
            logging.info(f"[get_leads_follow_id] call_job_id={call_job_id} 没有 call_status，跳过跟进记录创建")
            return {
                "status": "error",
                "code": 4004,
                "message": f"call_job_id为{call_job_id}的记录尚未获取到call_status，暂不创建跟进记录",
                "data": {
                    "follow_id": None,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": None,
                    "is_interested": None,
                    "next_follow_time": None,
                    "create_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                }
            }
        
        # 不再直接返回：若已有跟进但存在会话，将允许走AI并更新原有跟进
        
        # 检查任务状态，如果 Status = Failed，使用固定跟进内容
        # 优先使用会话：若存在 call_conversation，无论 call_status，都走AI分析；否则按失败/无会话规则
        if call_conversation:
            try:
                if isinstance(call_conversation, str):
                    conversation_data = json.loads(call_conversation)
                else:
                    conversation_data = call_conversation
                
                prompt = {json.dumps(conversation_data, ensure_ascii=False, indent=2)}
                
                logging.info(f"prompt: {prompt}")
                ai_response = ali_bailian_api(prompt)
                logging.info(f"AI返回: {ai_response}")
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
        else:
            # 无会话：如果 call_status = Failed 或为空（未匹配到），则创建跟进记录
            if call_status == 'Failed':
                leads_remark = "呼叫失败；"
                is_interested = 0  # 0=无法判断
                next_follow_time = None
            elif not call_status or call_status == '':
                # call_status 为空，说明 call_job_id 在请求中没有匹配到，创建"未执行外呼"的跟进记录
                leads_remark = "未执行外呼；"
                is_interested = 0  # 0=无法判断
                next_follow_time = None
            else:
                # 其他状态且无会话：不创建/更新跟进记录，直接返回提示
                try:
                    print(f"[get_leads_follow_id] 无会话内容且状态不是Failed或空，跳过AI与跟进创建，call_job_id={call_job_id}, call_status={call_status}")
                except Exception:
                    pass
                return {
                    "status": "success",
                    "code": 200,
                    "message": "暂无通话内容，未创建跟进记录",
                    "data": {
                        "follow_id": None,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": None,
                        "is_interested": None,
                        "next_follow_time": None,
                        "create_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    }
                }
        
        # 3. dry_run 时仅返回不入库；否则按原逻辑入库
        current_time = datetime.now()
        if dry_run:
            try:
                print(f"[force-analyze] dry_run call_job_id={call_job_id}, leads_id={leads_id}, is_interested={is_interested}, leads_remark={leads_remark}, next_follow_time={next_follow_time}")
            except Exception:
                pass
            return {
                "status": "success",
                "code": 200,
                "message": "分析成功（未入库）",
                "data": {
                    "follow_id": None,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": leads_remark,
                    "is_interested": is_interested,
                    "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                    "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
        else:
            # 若已有跟进记录则更新，否则插入
            if leads_follow_id:
                update_follow_query = """
                    UPDATE dcc_leads_follow
                    SET leads_remark = %s,
                        new_follow_time = %s,
                        next_follow_time = %s
                    WHERE id = %s
                """
                execute_update(update_follow_query, (
                    leads_remark,
                    current_time,
                    next_follow_time,
                    leads_follow_id
                ))
                # 同步更新任务表意向
                update_list_query = """
                    UPDATE leads_task_list
                    SET is_interested = %s
                    WHERE call_job_id = %s
                """
                execute_update(update_list_query, (is_interested, call_job_id))
                return {
                    "status": "success",
                    "code": 200,
                    "message": "跟进记录更新成功",
                    "data": {
                        "follow_id": leads_follow_id,
                        "leads_id": leads_id,
                        "leads_name": leads_name,
                        "leads_phone": leads_phone,
                        "leads_remark": leads_remark,
                        "is_interested": is_interested,
                        "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                        "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
                    }
                }

            # 将数据写入dcc_leads_follow表（首次）
            insert_query = """
                INSERT INTO dcc_leads_follow 
                (leads_id, follow_time, leads_remark, frist_follow_time, new_follow_time, next_follow_time)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            follow_id = execute_update(insert_query, (
                leads_id,
                current_time,
                leads_remark,
                current_time,
                current_time,
                next_follow_time
            ))
            
            # 更新leads_task_list表中的leads_follow_id和is_interested
            update_query = """
                UPDATE leads_task_list 
                SET leads_follow_id = %s, is_interested = %s
                WHERE call_job_id = %s
            """
            execute_update(update_query, (follow_id, is_interested, call_job_id))
            
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
        return {
            "status": "error",
            "code": 5000,
            "message": f"创建跟进记录失败: {str(e)}"
        }


class GetLeadsFollowRequest(BaseModel):
    """获取线索跟进记录请求"""
    call_job_id: str  # 通话任务ID

class GetLeadsFollowResponse(BaseModel):
    """获取线索跟进记录响应"""
    status: str
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None

@auto_call_router.post("/get-leads-follow", response_model=GetLeadsFollowResponse)
async def get_leads_follow_endpoint(
    request: GetLeadsFollowRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    根据call_job_id获取通话记录，调用AI接口分析，并保存跟进记录
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        result = get_leads_follow_id(request.call_job_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"获取线索跟进记录失败: {str(e)}"
            }
        )


class ForceAnalyzeRequest(BaseModel):
    """强制分析（打印 prompt/AI返回），可选择 dry_run 不入库"""
    call_job_id: str
    force: bool = True
    dry_run: bool = True


class ForceAnalyzeResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None


@auto_call_router.post("/force-analyze", response_model=ForceAnalyzeResponse)
async def force_analyze_endpoint(
    request: ForceAnalyzeRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """对指定 call_job_id 强制执行 AI 分析，默认仅打印不入库。"""
    try:
        print(f"[force-analyze] start: call_job_id={request.call_job_id}, force={request.force}, dry_run={request.dry_run}")
        result = get_leads_follow_id(request.call_job_id, force=request.force, dry_run=request.dry_run)
        print(f"[force-analyze] result: {result}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"强制分析失败: {str(e)}"
            }
        )


def _parse_time_ranges(start_str: Optional[str], end_str: Optional[str]) -> List[tuple]:
    """解析多时间区间参数"""
    if not start_str and not end_str:
        return []
    
    # 如果只有一个参数，按原来的逻辑处理
    if start_str and not end_str:
        return [(start_str, None)]
    elif end_str and not start_str:
        return [(None, end_str)]
    
    # 解析多个区间
    start_ranges = start_str.split(';') if start_str else [None]
    end_ranges = end_str.split(';') if end_str else [None]
    
    # 确保两个列表长度一致
    max_len = max(len(start_ranges), len(end_ranges))
    start_ranges.extend([None] * (max_len - len(start_ranges)))
    end_ranges.extend([None] * (max_len - len(end_ranges)))
    
    time_ranges = []
    for start_range, end_range in zip(start_ranges, end_ranges):
        if start_range or end_range:
            # 处理单个区间内的开始和结束时间
            if start_range and ',' in start_range:
                start_parts = start_range.split(',')
                start_time = start_parts[0].strip() if start_parts[0].strip() else None
            else:
                start_time = start_range.strip() if start_range else None
            
            if end_range and ',' in end_range:
                end_parts = end_range.split(',')
                end_time = end_parts[1].strip() if len(end_parts) > 1 and end_parts[1].strip() else None
            else:
                end_time = end_range.strip() if end_range else None
            
            if start_time or end_time:
                time_ranges.append((start_time, end_time))
    
    return time_ranges


class TaskStatisticsRequest(BaseModel):
    """查询任务统计信息请求"""
    task_id: int  # 任务ID

class TaskStatisticsData(BaseModel):
    """任务统计信息数据"""
    total_leads: int  # 线索数量
    pending_follow: int  # 待跟进数量（is_interested为空）
    unable_to_judge: int  # 无法判断数量（is_interested=0）
    interested: int  # 有意向数量（is_interested=1）
    not_interested: int  # 无意向数量（is_interested=2）

class TaskStatisticsResponse(BaseModel):
    """查询任务统计信息响应"""
    status: str
    code: int
    message: str
    data: TaskStatisticsData

@auto_call_router.post("/task-statistics", response_model=TaskStatisticsResponse)
async def get_task_statistics(
    request: TaskStatisticsRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    根据task_id查询任务统计信息（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import get_task_statistics_service
        result = get_task_statistics_service(request=request, token=token)

        if result.get("status") != "success":
            status_code = 404 if result.get("code") == 4004 else 400
            raise HTTPException(status_code=status_code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"查询任务统计信息失败: {str(e)}"
            }
        )


# sync_call_job_ids_from_group 已移至 auto_call_service.py


class SuspendResumeTaskRequest(BaseModel):
    """暂停/重启任务请求"""
    action: str  # "suspend" 或 "resume"
    task_id: int  # 任务ID


class SuspendResumeTaskResponse(BaseModel):
    """暂停/重启任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


@auto_call_router.post("/suspend-resume-task", response_model=SuspendResumeTaskResponse)
async def suspend_resume_task(
    request: SuspendResumeTaskRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    暂停/重启任务（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import suspend_resume_task_service
        result = suspend_resume_task_service(request=request, token=token)

        if result.get("status") != "success":
            status_code = 500 if result.get("code", 0) >= 5000 else (404 if result.get("code") == 4004 else 400)
            raise HTTPException(status_code=status_code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"操作失败: {str(e)}"
            }
        )


class DescribeJobGroupRequest(BaseModel):
    """查询任务组详情请求"""
    job_group_id: Optional[str] = None  # 任务组ID
    task_id: Optional[int] = None  # 任务ID（可选，如果提供task_id则根据task_id查询job_group_id）


class JobGroupProgress(BaseModel):
    """任务组进度信息"""
    scheduling: int = 0  # 调度中
    total_completed: int = 0  # 已完成总数
    executing: int = 0  # 执行中
    total_jobs: int = 0  # 总任务数


class DescribeJobGroupResponse(BaseModel):
    """查询任务组详情响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


@auto_call_router.post("/describe-job-group", response_model=DescribeJobGroupResponse)
async def describe_job_group(
    request: DescribeJobGroupRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    查询任务组详情（精简版）：控制器仅做基本校验与调用服务。
    """
    try:
        if not token or not token.get("user_id"):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        from .auto_call_service import describe_job_group_service
        result = await describe_job_group_service(request=request, token=token)  # type: ignore

        if result.get("status") != "success":
            status_code = 500 if result.get("code", 0) >= 5000 else (404 if result.get("code") == 4004 else 400)
            raise HTTPException(status_code=status_code, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"查询任务组详情失败: {str(e)}"
            }
        )

class TaskListItem(BaseModel):
    """任务列表项（精简字段）"""
    id: int
    task_name: str
    task_type: int
    create_time: str
    leads_count: int


class TaskListResponse(BaseModel):
    """任务列表响应（分页）"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


@auto_call_router.get("/task_list", response_model=TaskListResponse)
async def get_task_list(
    page: int = 1,
    page_size: int = 20,
    task_types: Optional[str] = Query(None, description="任务类型过滤，逗号分隔，如 2,3,5"),
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    分页查询任务列表：根据 user_id 查询数据库获取任务列表
    """
    try:
        # 获取用户ID
        user_id = token.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "令牌中缺少用户ID信息"}
            )

        # 根据 user_id 获取 organization_id
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={"status": "error", "code": 1003, "message": "用户未绑定组织或组织ID无效"}
            )
        organization_id = org_result[0]['dcc_user_org_id']

        # 解析任务类型过滤
        task_type_list: Optional[List[int]] = None
        if task_types:
            parsed_types: List[int] = []
            for raw in task_types.split(','):
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    parsed_types.append(int(raw))
                except ValueError:
                    continue
            if parsed_types:
                task_type_list = parsed_types

        # 构建查询条件
        base_condition = "organization_id = %s"
        base_params: List[Any] = [organization_id]
        if task_type_list:
            placeholders = ','.join(['%s'] * len(task_type_list))
            base_condition += f" AND task_type IN ({placeholders})"
            base_params.extend(task_type_list)

        # 统计总数
        count_sql = f"SELECT COUNT(*) AS total FROM call_tasks WHERE {base_condition}"
        count_res = execute_query(count_sql, tuple(base_params))
        total = count_res[0]['total'] if count_res and count_res[0].get('total') else 0

        # 如果没有数据，直接返回
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

        # 查询任务列表数据
        list_sql = f"""
            SELECT id, task_name, task_type, create_time, leads_count
            FROM call_tasks
            WHERE {base_condition}
            ORDER BY create_time DESC
            LIMIT %s OFFSET %s
        """
        list_params = base_params + [page_size, offset]
        rows = execute_query(list_sql, tuple(list_params))

        # 构建返回数据
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"获取任务列表失败: {str(e)}"
            }
        )


class DiagnoseTaskRequest(BaseModel):
    """诊断任务请求"""
    task_id: int


class DiagnoseTaskResponse(BaseModel):
    """诊断任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


@auto_call_router.post("/diagnose-task", response_model=DiagnoseTaskResponse)
async def diagnose_task(
    request: DiagnoseTaskRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    诊断任务为什么没有被自动化处理
    
    返回任务的处理状态、是否符合条件、不符合的原因等信息
    """
    try:
        from api.auto_task_monitor import auto_task_monitor
        
        result = auto_task_monitor.diagnose_task(request.task_id)
        
        if result["status"] == "error":
            return DiagnoseTaskResponse(
                status="error",
                code=1002,
                message=result.get("message", "诊断失败"),
                data=result
            )
        
        return DiagnoseTaskResponse(
            status="success",
            code=1000,
            message="诊断完成",
            data=result
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"诊断任务失败: {str(e)}"
            }
        )


class TriggerMonitorResponse(BaseModel):
    """触发监控任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]


@auto_call_router.post("/trigger-monitor", response_model=TriggerMonitorResponse)
async def trigger_monitor(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    手动触发自动化任务监控
    
    立即执行一次监控任务，检查并处理待处理的任务
    """
    try:
        from celery_tasks.task_monitor import monitor_pending_tasks
        
        # 异步触发监控任务
        result = monitor_pending_tasks.delay()
        
        return TriggerMonitorResponse(
            status="success",
            code=1000,
            message="监控任务已触发",
            data={
                "task_id": result.id,
                "message": "监控任务已在后台执行，请稍后查看日志或任务状态"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"触发监控任务失败: {str(e)}"
            }
        )
