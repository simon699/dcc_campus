from fastapi import APIRouter, HTTPException, Depends
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
from .auto_task_monitor import auto_task_monitor, start_auto_check_after_creation
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
    创建自动外呼任务
    
    根据筛选条件从dcc_leads表中筛选线索，并创建外呼任务
    
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
        org_query = "SELECT dcc_user_org_id, username FROM users WHERE id = %s"
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
        create_name = org_result[0]['username']
        
        # 根据筛选条件查询dcc_leads表中的线索
        # 构建基础查询
        base_query = """
            SELECT DISTINCT l.leads_id, l.leads_user_name, l.leads_user_phone 
            FROM dcc_leads l
        """
        
        # 构建WHERE条件
        where_conditions = ["l.organization_id = %s"]
        query_params = [organization_id]
        
        # 添加产品筛选条件
        if request.size_desc.leads_product:
            leads_product_placeholders = ','.join(['%s'] * len(request.size_desc.leads_product))
            where_conditions.append(f"l.leads_product IN ({leads_product_placeholders})")
            query_params.extend(request.size_desc.leads_product)
        
        # 添加等级筛选条件
        if request.size_desc.leads_type:
            leads_type_placeholders = ','.join(['%s'] * len(request.size_desc.leads_type))
            where_conditions.append(f"l.leads_type IN ({leads_type_placeholders})")
            query_params.extend(request.size_desc.leads_type)
        
        # 添加时间筛选条件
        has_time_conditions = (request.size_desc.first_follow_start or request.size_desc.first_follow_end or 
                              request.size_desc.latest_follow_start or request.size_desc.latest_follow_end or
                              request.size_desc.next_follow_start or request.size_desc.next_follow_end or
                              request.size_desc.is_arrive is not None)
        
        if has_time_conditions:
            # 需要JOIN dcc_leads_follow表
            base_query = """
                SELECT DISTINCT l.leads_id, l.leads_user_name, l.leads_user_phone 
                FROM dcc_leads l
                LEFT JOIN dcc_leads_follow f ON l.leads_id = f.leads_id
            """
            
            # 解析多时间区间
            first_follow_ranges = _parse_time_ranges(request.size_desc.first_follow_start, request.size_desc.first_follow_end)
            latest_follow_ranges = _parse_time_ranges(request.size_desc.latest_follow_start, request.size_desc.latest_follow_end)
            next_follow_ranges = _parse_time_ranges(request.size_desc.next_follow_start, request.size_desc.next_follow_end)
            
            # 构建时间筛选条件
            time_condition_parts = []
            
            # 首次跟进时间筛选
            if first_follow_ranges:
                first_follow_conditions = []
                for start_time, end_time in first_follow_ranges:
                    if start_time and end_time:
                        first_follow_conditions.append("(f.frist_follow_time >= %s AND f.frist_follow_time <= %s)")
                        query_params.extend([start_time, end_time])
                    elif start_time:
                        first_follow_conditions.append("f.frist_follow_time >= %s")
                        query_params.append(start_time)
                    elif end_time:
                        first_follow_conditions.append("f.frist_follow_time <= %s")
                        query_params.append(end_time)
                if first_follow_conditions:
                    time_condition_parts.append(f"({' OR '.join(first_follow_conditions)})")
            
            # 最近跟进时间筛选
            if latest_follow_ranges:
                latest_follow_conditions = []
                for start_time, end_time in latest_follow_ranges:
                    if start_time and end_time:
                        latest_follow_conditions.append("(f.new_follow_time >= %s AND f.new_follow_time <= %s)")
                        query_params.extend([start_time, end_time])
                    elif start_time:
                        latest_follow_conditions.append("f.new_follow_time >= %s")
                        query_params.append(start_time)
                    elif end_time:
                        latest_follow_conditions.append("f.new_follow_time <= %s")
                        query_params.append(end_time)
                if latest_follow_conditions:
                    time_condition_parts.append(f"({' OR '.join(latest_follow_conditions)})")
            
            # 下次跟进时间筛选
            if next_follow_ranges:
                next_follow_conditions = []
                for start_time, end_time in next_follow_ranges:
                    if start_time and end_time:
                        next_follow_conditions.append("(f.next_follow_time >= %s AND f.next_follow_time <= %s)")
                        query_params.extend([start_time, end_time])
                    elif start_time:
                        next_follow_conditions.append("f.next_follow_time >= %s")
                        query_params.append(start_time)
                    elif end_time:
                        next_follow_conditions.append("f.next_follow_time <= %s")
                        query_params.append(end_time)
                if next_follow_conditions:
                    time_condition_parts.append(f"({' OR '.join(next_follow_conditions)})")
            
            # 是否到店筛选
            if request.size_desc.is_arrive:
                placeholders = ','.join(['%s'] * len(request.size_desc.is_arrive))
                time_condition_parts.append(f"f.is_arrive IN ({placeholders})")
                query_params.extend(request.size_desc.is_arrive)
            
            # 添加时间筛选条件到WHERE条件中
            if time_condition_parts:
                where_conditions.append(" AND ".join(time_condition_parts))
        
        # 构建完整的查询语句
        leads_query = f"{base_query} WHERE {' AND '.join(where_conditions)}"
        leads_params = tuple(query_params)
        
        leads_result = execute_query(leads_query, leads_params)
        
        if not leads_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4001,
                    "message": "未找到符合条件的线索数据"
                }
            )
        
        # 创建call_tasks记录
        task_query = """
            INSERT INTO call_tasks 
            (task_name, organization_id, create_name_id, create_name, create_time, leads_count, script_id, task_type, size_desc)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        current_time = datetime.now()
        size_desc_json = json.dumps(request.size_desc.dict())
        
        task_params = (
            request.task_name,
            organization_id,
            user_id,
            create_name,
            current_time,
            len(leads_result),
            request.script_id,
            1,  # task_type: 1-已创建
            size_desc_json
        )
        
        # 插入任务记录
        task_id = execute_update(task_query, task_params)
        
        # 批量插入leads_task_list记录
        if leads_result:
            list_query = """
                INSERT INTO leads_task_list 
                (task_id, leads_id, leads_name, leads_phone, call_time, call_job_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            for lead in leads_result:
                list_params = (
                    task_id,
                    lead['leads_id'],
                    lead['leads_user_name'],
                    lead['leads_user_phone'],
                    current_time,
                    ""  # call_job_id 暂时为空
                )
                execute_update(list_query, list_params)
        
        # 构建返回的size_desc，确保包含前端期望的字段
        size_desc_dict = request.size_desc.dict()
        
        # 如果前端提交了ranges字段，确保在返回时也包含这些字段
        if hasattr(request.size_desc, 'first_follow_ranges') and request.size_desc.first_follow_ranges:
            size_desc_dict['first_follow_ranges'] = request.size_desc.first_follow_ranges
        if hasattr(request.size_desc, 'latest_follow_ranges') and request.size_desc.latest_follow_ranges:
            size_desc_dict['latest_follow_ranges'] = request.size_desc.latest_follow_ranges
        if hasattr(request.size_desc, 'next_follow_ranges') and request.size_desc.next_follow_ranges:
            size_desc_dict['next_follow_ranges'] = request.size_desc.next_follow_ranges
        
        # 取消：创建后立即检查。首次检查改在 start-call-task 成功后触发
        
        return {
            "status": "success",
            "code": 200,
            "message": "自动外呼任务创建成功",
            "data": {
                "task_id": task_id,
                "task_name": request.task_name,
                "leads_count": len(leads_result),
                "create_time": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                "size_desc": size_desc_dict
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
    获取任务统计信息（带缓存优化）
    
    根据access-token获取用户组织信息，统计call_tasks表中不同任务类型的数量和线索数量
    使用内存缓存，5分钟过期，提升响应速度
    
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
        
        # 检查缓存
        cache_key = f"task_stats_{organization_id}"
        cached_data = _get_cached_task_stats(cache_key)
        if cached_data:
            return cached_data
        
        # 查询不同任务类型的统计信息（优化：使用索引）
        stats_query = """
            SELECT 
                task_type,
                COUNT(*) as count,
                COALESCE(SUM(leads_count), 0) as leads_count
            FROM call_tasks 
            WHERE organization_id = %s
            GROUP BY task_type
            ORDER BY task_type
        """
        
        stats_result = execute_query(stats_query, (organization_id,))
        
        # 创建完整的统计结果（包括数量为0的类型）
        task_types = [1, 2, 3, 4]  # 所有可能的任务类型
        stats_map = {row['task_type']: row for row in stats_result}
        
        stats_list = []
        for task_type in task_types:
            if task_type in stats_map:
                stats_list.append(TaskTypeStats(
                    task_type=task_type,
                    count=stats_map[task_type]['count'],
                    leads_count=stats_map[task_type]['leads_count'] or 0
                ))
            else:
                stats_list.append(TaskTypeStats(
                    task_type=task_type,
                    count=0,
                    leads_count=0
                ))
        
        result = {
            "status": "success",
            "code": 200,
            "message": "获取任务统计信息成功",
            "data": stats_list
        }
        
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
    根据access-token获取call_tasks表中的任务信息
    
    返回内容包括：id、task_name、create_time、size_desc、leads_count，
    以及关联的leads_task_list中的leads_name、leads_phone、call_status信息
    
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
        
        # 查询call_tasks表中的任务信息
        tasks_query = """
            SELECT 
                id,
                task_name,
                create_time,
                size_desc,
                leads_count,
                task_type,
                organization_id,
                create_name,
                script_id
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
        
        # 获取所有任务ID
        task_ids = [task['id'] for task in tasks_result]
        
        # 查询leads_task_list表中的线索信息
        leads_query = """
            SELECT 
                task_id,
                leads_name,
                leads_phone,
                call_status
            FROM leads_task_list 
            WHERE task_id IN ({})
            ORDER BY task_id, id
        """.format(','.join(['%s'] * len(task_ids)))
        
        leads_result = execute_query(leads_query, task_ids)
        
        # 将线索信息按task_id分组
        leads_by_task = {}
        for lead in leads_result:
            task_id = lead['task_id']
            if task_id not in leads_by_task:
                leads_by_task[task_id] = []
            
            # 如果call_status为空，则返回默认状态
            call_status = lead['call_status'] if lead['call_status'] else CALL_STATUS_CONSTANTS["NOT_STARTED"]
            
            leads_by_task[task_id].append(TaskLeadsInfo(
                leads_name=lead['leads_name'],
                leads_phone=lead['leads_phone'],
                call_status=call_status
            ))
        
        # 构建返回数据
        tasks_data = []
        for task in tasks_result:
            task_id = task['id']
            leads_list = leads_by_task.get(task_id, [])
            
            # 解析size_desc JSON数据
            size_desc = {}
            if task['size_desc']:
                try:
                    size_desc = json.loads(task['size_desc'])
                except:
                    size_desc = {}
            
            tasks_data.append(TaskInfo(
                id=task['id'],
                task_name=task['task_name'],
                create_time=task['create_time'].strftime("%Y-%m-%d %H:%M:%S") if hasattr(task['create_time'], 'strftime') else str(task['create_time']),
                size_desc=size_desc,
                leads_count=task['leads_count'],
                task_type=task['task_type'],
                organization_id=task['organization_id'],
                create_name=task['create_name'],
                script_id=task['script_id'],
                leads_list=leads_list
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
    更新call_tasks表的script_id
    
    根据task_id更新对应任务的script_id字段
    
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
            SELECT id, task_name, script_id 
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
    开始进行外呼任务
    
    根据task_id开始执行外呼任务，包括：
    1. 调用create_job_group获取job_group_id和子任务的call_job_id
    2. 更新call_tasks、leads_task_list两个表的数据
    3. 调用assign_jobs执行外呼任务
    4. 更新leads_task_list
    
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
            SELECT id, task_name, script_id, leads_count, size_desc, task_type
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
        
        # 检查任务状态
        if task_info['task_type'] != 1:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4005,
                    "message": "任务状态不正确，只有已创建状态的任务可以开始外呼"
                }
            )
        
        # 检查是否有脚本ID
        if not task_info['script_id']:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4006,
                    "message": "任务未配置脚本ID，请先配置脚本"
                }
            )
        
        # 获取任务下的所有线索
        leads_query = """
            SELECT id, leads_name, leads_phone, leads_id
            FROM leads_task_list 
            WHERE task_id = %s
            ORDER BY id
        """
        
        leads_result = execute_query(leads_query, (request.task_id,))
        
        if not leads_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4007,
                    "message": "任务下没有线索数据"
                }
            )
        
        # 导入create_job_group模块
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from create_job_group import Sample as CreateJobGroupSample
        
        # 1. 调用create_job_group获取job_group_id
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
            # 防御式校验，避免 None 访问属性
            if not job_group or not getattr(job_group, 'job_group_id', None):
                raise RuntimeError("创建任务组返回为空或缺少 job_group_id")
            job_group_id = job_group.job_group_id
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 5001,
                    "message": f"创建任务组失败: {str(e)}"
                }
            )
        
        # 2. 更新call_tasks表，设置job_group_id和task_type
        update_task_query = """
            UPDATE call_tasks 
            SET job_group_id = %s, task_type = %s 
            WHERE id = %s
        """
        
        execute_update(update_task_query, (job_group_id, 2, request.task_id))  # task_type: 2-开始外呼
        
        # 3. 准备assign_jobs的数据
        jobs_json = []
        for lead in leads_result:
            job_data = {
                "extras": [],
                "contacts": [
                    {
                        "phoneNumber": lead['leads_phone'],
                        "name": lead['leads_name'],
                        "referenceId": f"task_{request.task_id}_lead_{lead['leads_id']}"
                    }
                ]
            }
            jobs_json.append(job_data)
        
        # 导入assign_jobs模块
        from openAPI.assign_jobs import Sample as AssignJobsSample
        
        # 4. 调用assign_jobs执行外呼任务
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
            
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 5002,
                    "message": f"分配外呼任务失败: {str(e)}"
                }
            )
        
        # 5. 更新leads_task_list表，设置call_job_id
        # assign_jobs返回的jobs_id是一个列表，需要按顺序分配给每个线索
        if jobs_id:
            # 获取当前任务的所有线索记录，按ID排序确保顺序一致
            get_leads_query = """
                SELECT id, leads_id 
                FROM leads_task_list 
                WHERE task_id = %s 
                ORDER BY id
            """
            leads_records = execute_query(get_leads_query, (request.task_id,))
            
            # 按顺序更新每个线索记录的call_job_id
            for i, lead_record in enumerate(leads_records):
                if i < len(jobs_id):
                    job_id = str(jobs_id[i])  # 转换为字符串
                    update_leads_query = """
                        UPDATE leads_task_list 
                        SET call_job_id = %s 
                        WHERE id = %s
                    """
                    execute_update(update_leads_query, (job_id, lead_record['id']))
        
            return {
                "status": "success",
                "code": 200,
                "message": "外呼任务开始成功",
                "data": {
                    "task_id": request.task_id,
                    "task_name": task_info['task_name'],
                    "job_group_id": job_group_id,
                    "jobs_id": jobs_id,
                    "leads_count": len(leads_result),
                    "start_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            }
            
            # 注意：在成功返回前异步触发首次检查（含2秒延迟）
            asyncio.create_task(start_auto_check_after_creation(request.task_id))
        
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

class TaskExecutionResponse(BaseModel):
    """查询外呼任务执行情况响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@auto_call_router.post("/query-task-execution", response_model=TaskExecutionResponse)
async def query_task_execution(
    request: QueryTaskExecutionRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    查询外呼任务执行情况
    
    根据task_id查询外呼任务的执行情况，包括：
    1. 在leads_task_list中找到对应task_id的call_job_id
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
            SELECT id, task_name, task_type
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
        
        # 1. 优化：在数据库层面分页查询 call_job_id，而不是查询所有记录后再分页
        # 先查询总数
        count_query = """
            SELECT COUNT(*) as total
            FROM leads_task_list 
            WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
        """
        count_result = execute_query(count_query, (request.task_id,))
        total_jobs = count_result[0]['total'] if count_result and count_result[0].get('total') else 0
        
        if total_jobs == 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4008,
                    "message": "任务下没有已分配的外呼任务"
                }
            )
        
        # 计算分页信息
        page_size = max(1, request.page_size)  # 确保每页数量至少为1
        total_pages = (total_jobs + page_size - 1) // page_size  # 向上取整
        page = max(1, min(request.page, total_pages))  # 确保页码在有效范围内
        
        # 在数据库层面分页查询当前页的 call_job_id
        offset = (page - 1) * page_size
        leads_query = """
            SELECT call_job_id
            FROM leads_task_list 
            WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
            ORDER BY id
            LIMIT %s OFFSET %s
        """
        
        leads_result = execute_query(leads_query, (request.task_id, page_size, offset))
        
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
        
        # 2. 调用list_jobs接口获取任务执行状态（只查询当前页的数据）
        
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from list_jobs import Sample as ListJobsSample
        from download_recording import Sample as DownloadRecordingSample
        
        try:
            jobs_data = ListJobsSample.main(
                [],
                job_ids=paginated_call_job_ids
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 5003,
                    "message": f"获取外呼任务状态失败: {str(e)}"
                }
            )
        
        # 3. 解析返回数据并更新leads_task_list表
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
        job_ids = [job.get('JobId') for job in jobs_data if job.get('JobId')]
        
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
        all_tasks_succeeded = True
        task_statuses = []
        
        for job_data in jobs_data:
            job_id = job_data.get('JobId')
            tasks = job_data.get('Tasks', [])
             # 记录任务状态用于后续检查
            task_statuses.append(job_data.get('Status', ''))
            job_status = job_data.get('Status', '')
            
            if tasks:
                # 获取最后一个任务的信息
                last_task = tasks[-1]

                # 解析任务数据
                status = last_task.get('Status', '')
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
                current_data = current_data_map.get(job_id, {})
                current_status = current_data.get('call_status')
                current_plan_time = current_data.get('planed_time')
                current_call_task_id = current_data.get('call_task_id')
                current_conversation = current_data.get('call_conversation')
                current_calling_number = current_data.get('calling_number')
                current_recording_url = current_data.get('recording_url')
                
                # 获取录音URL - 如果skip_recording为True，跳过耗时操作
                recording_url = None
                if not request.skip_recording and job_status == 'Succeeded' and call_task_id:
                    # 使用批量查询的结果
                    current_recording_url = current_recording_url
                    
                    # 获取新的录音URL（这是最耗时的操作）
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
                    # 如果跳过录音获取，但已有录音URL，使用批量查询的结果
                    recording_url = current_recording_url
                
                # 检查是否有变化（使用批量查询的结果）
                try:
                    # 序列化conversation用于比较
                    new_conversation_str = json.dumps(conversation) if conversation else None
                    
                    # 比较时间（允许秒级差异）
                    plan_time_match = False
                    if current_plan_time and plan_time:
                        # 比较时间戳，允许1秒差异
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
                    
                    # 如果没有变化，跳过更新
                    if not has_changes:
                        continue  # 跳过这个任务，不执行更新
                    
                    # 有变化或数据不存在，执行更新
                    update_query = """
                        UPDATE leads_task_list 
                        SET call_status = %s,
                            planed_time = %s,
                            call_task_id = %s,
                            call_conversation = %s,
                            calling_number = %s,
                            recording_url = %s
                        WHERE task_id = %s AND call_job_id = %s
                    """
                    
                    # 使用job_status而不是status，确保Failed状态能正确更新到数据库
                    update_params = (
                        job_status,
                        plan_time,
                        call_task_id,
                        json.dumps(conversation) if conversation else None,
                        calling_number,
                        recording_url,
                        request.task_id,
                        job_id
                    )
                    
                    affected_rows = execute_update(update_query, update_params)
                    if affected_rows > 0:
                        updated_count += 1
                        
                        # 仅首次需要时触发AI：需满足有会话 且 is_interested 为 NULL 且 leads_follow_id 为 NULL
                        # 优化：使用批量查询的结果，而不是再次查询数据库
                        if conversation:
                            try:
                                current_is_interested = current_data.get('is_interested')
                                current_leads_follow_id = current_data.get('leads_follow_id')
                                needs_ai = (
                                    current_is_interested is None and
                                    current_leads_follow_id is None
                                )
                                if needs_ai:
                                    def run_ai_follow():
                                        try:
                                            print(f"[bg-ai] start job_id={job_id}")
                                            get_leads_follow_id(job_id)
                                            print(f"[bg-ai] done job_id={job_id}")
                                        except Exception as e:
                                            print(f"[bg-ai] failed job_id={job_id}, err={str(e)}")
                                    ai_thread = threading.Thread(target=run_ai_follow)
                                    ai_thread.daemon = True
                                    ai_thread.start()
                            except Exception:
                                pass
                            
                except Exception as e:
                    error_count += 1
                    print(f"更新任务 {job_id} 失败: {str(e)}")
            
            if job_status in ['Succeeded', 'Failed']:
                # 优化：使用批量查询的结果，而不是再次查询数据库
                current_job_data = current_data_map.get(job_id, {})
                current_leads_follow_id = current_job_data.get('leads_follow_id')
                
                if current_leads_follow_id is None:
                    # leads_follow_id为空，才创建跟进记录
                    def run_get_leads_follow():
                        try:
                            print(f"子线程开始处理任务 {job_id} 的跟进记录")
                            get_leads_follow_id(job_id)
                            print(f"子线程完成：任务 {job_id} 的跟进记录创建成功")
                        except Exception as e:
                            print(f"子线程异常：任务 {job_id} 的跟进记录创建失败: {str(e)}")
                    
                    # 启动子线程
                    follow_thread = threading.Thread(target=run_get_leads_follow)
                    follow_thread.daemon = True  # 设置为守护线程，主线程结束时自动结束
                    follow_thread.start()
                    print(f"主线程已启动子线程处理任务 {job_id}，继续执行主流程")
                else:
                    print(f"任务 {job_id} 的leads_follow_id已存在，跳过跟进记录创建")
        
        # 检查所有任务是否都完成
        if task_statuses and all(status in ['Succeeded', 'Failed'] for status in task_statuses):
            # 检查该任务下是否所有线索的leads_follow_id都不为空
            check_follow_query = """
                SELECT COUNT(*) as total_count,
                       SUM(CASE WHEN leads_follow_id IS NULL THEN 1 ELSE 0 END) as empty_count
                FROM leads_task_list 
                WHERE task_id = %s
            """
            follow_result = execute_query(check_follow_query, (request.task_id,))
            
            if follow_result:
                total_count = follow_result[0]['total_count']
                empty_count = follow_result[0]['empty_count']
                
                if empty_count == 0:
                    # 所有线索的跟进记录都已创建，更新为状态4（跟进完成）
                    try:
                        update_task_type_query = """
                            UPDATE call_tasks 
                            SET task_type = 4 
                            WHERE id = %s
                        """
                        execute_update(update_task_type_query, (request.task_id,))
                        print(f"任务 {request.task_id} 所有线索跟进完成，已更新task_type为4")
                    except Exception as e:
                        print(f"更新任务类型失败: {str(e)}")
                else:
                    # 还有线索的跟进记录未创建，更新为状态3（外呼完成）
                    try:
                        update_task_type_query = """
                            UPDATE call_tasks 
                            SET task_type = 3 
                            WHERE id = %s
                        """
                        execute_update(update_task_type_query, (request.task_id,))
                        print(f"任务 {request.task_id} 所有外呼任务已完成，已更新task_type为3（还有{empty_count}个线索待跟进）")
                    except Exception as e:
                        print(f"更新任务类型失败: {str(e)}")
        
        # 优化：在返回数据之前，为每个job_data添加is_interested和follow_data
        # 使用批量查询的结果，而不是循环中逐个查询
        for job_data in jobs_data:
            job_id = job_data.get('JobId')
            
            # 从批量查询的结果中获取is_interested和follow_data
            current_job_data = current_data_map.get(job_id, {})
            is_interested = current_job_data.get('is_interested')
            leads_follow_id = current_job_data.get('leads_follow_id')
            
            # 从批量查询的跟进数据字典中获取follow_data
            follow_data = follow_data_map.get(leads_follow_id) if leads_follow_id else None
            
            # 将is_interested和follow_data添加到job_data中
            job_data['is_interested'] = is_interested
            job_data['follow_data'] = follow_data
        
        return {
            "status": "success",
            "code": 200,
            "message": "查询外呼任务执行情况成功",
            "data": {
                "task_id": request.task_id,
                "task_name": task_info['task_name'],
                "task_type": task_info['task_type'],
                "total_jobs": total_jobs,  # 总任务数
                "updated_count": updated_count,
                "error_count": error_count,
                "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "jobs_data": jobs_data,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "total_count": total_jobs
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
    """创建一个后台运行并立即返回 run_id。"""
    # 鉴权+任务归属校验
    user_id = token.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail={"status":"error","code":1003,"message":"令牌中缺少用户ID信息"})

    task = execute_query("SELECT id FROM call_tasks WHERE id=%s", (request.task_id,))
    if not task:
        raise HTTPException(status_code=404, detail={"status":"error","code":4004,"message":"任务不存在"})

    _ensure_execution_runs_table()

    # 创建 run 记录
    params = {
        "batch_size": request.batch_size,
        "sleep_ms": request.sleep_ms,
        "skip_recording": request.skip_recording,
    }
    run_id = execute_update(
        """
        INSERT INTO call_task_execution_runs(task_id, params, status, total_jobs, processed_jobs, error, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (request.task_id, json.dumps(params), "pending", 0, 0, None, datetime.now(), datetime.now())
    )

    # 启动后台线程
    def _runner():
        _background_execute_run(run_id, request.task_id, request.batch_size, request.sleep_ms, request.skip_recording)

    t = threading.Thread(target=_runner)
    t.daemon = True
    t.start()

    return {
        "status": "success",
        "code": 200,
        "message": "运行已启动",
        "data": {"run_id": run_id}
    }


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
            # 无会话：若失败则固定备注，否则返回缺少会话
            if call_status == 'Failed':
                leads_remark = "客户未接电话，未打通；"
                next_follow_time = None
                is_interested = 0
                try:
                    print(f"[get_leads_follow_id] 无会话但通话失败：call_job_id={call_job_id}")
                except Exception:
                    pass
            else:
                # 无会话且非 Failed：改为创建“待人工”跟进，避免流程卡住
                leads_remark = "缺少通话记录，待人工判定；"
                next_follow_time = None
                is_interested = 0
        
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
    根据task_id查询任务统计信息
    
    返回该任务的：
    - 线索数量：该任务线索数量
    - 待跟进数量：leads_task_list中该任务is_interested为空的数据
    - 无法判断数量：leads_task_list中该任务is_interested=0的数量
    - 有意向数量：leads_task_list中该任务is_interested=1的数量
    - 无意向数量：leads_task_list中该任务is_interested=2的数量
    
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
            SELECT id, task_name, leads_count 
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
        
        # 查询任务统计信息
        stats_query = """
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN is_interested IS NULL THEN 1 ELSE 0 END) as pending_follow,
                SUM(CASE WHEN is_interested = 0 THEN 1 ELSE 0 END) as unable_to_judge,
                SUM(CASE WHEN is_interested = 1 THEN 1 ELSE 0 END) as interested,
                SUM(CASE WHEN is_interested = 2 THEN 1 ELSE 0 END) as not_interested
            FROM leads_task_list 
            WHERE task_id = %s
        """
        
        stats_result = execute_query(stats_query, (request.task_id,))
        
        if not stats_result:
            # 如果没有找到相关记录，返回默认值
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


# 自动化任务相关功能
import asyncio
import time
from datetime import datetime, timedelta

class AutoTaskMonitor:
    """自动化任务监控器"""
    
    def __init__(self):
        self.is_running = False
        self.monitor_thread = None
    
    async def start_monitoring(self):
        """开始监控任务"""
        if self.is_running:
            return
        
        self.is_running = True
        print("自动化任务监控器已启动")
        
        while self.is_running:
            try:
                await self.check_and_update_tasks()
                # 每5分钟检查一次
                await asyncio.sleep(300)
            except Exception as e:
                print(f"自动化任务监控出错: {str(e)}")
                await asyncio.sleep(60)  # 出错后等待1分钟再继续
    
    async def stop_monitoring(self):
        """停止监控任务"""
        self.is_running = False
        print("自动化任务监控器已停止")
    
    async def check_and_update_tasks(self):
        """检查并更新任务状态"""
        try:
            # 查询所有需要检查的任务 - 只有task_type=2（开始外呼）的任务才检查
            query = """
                SELECT DISTINCT ct.id, ct.task_name, ct.task_type
                FROM call_tasks ct
                INNER JOIN leads_task_list ltl ON ct.id = ltl.task_id
                WHERE ct.task_type = 2  -- 只有开始外呼状态的任务才检查
                AND EXISTS (
                    SELECT 1 FROM leads_task_list 
                    WHERE task_id = ct.id AND leads_follow_id IS NULL
                )
            """
            
            tasks = execute_query(query)
            
            for task in tasks:
                task_id = task['id']
                task_name = task['task_name']
                task_type = task['task_type']
                
                print(f"检查任务: {task_name} (ID: {task_id})")
                
                # 检查该任务下是否还有leads_follow_id为空的记录
                check_query = """
                    SELECT COUNT(*) as empty_count, COUNT(*) as total_count
                    FROM leads_task_list 
                    WHERE task_id = %s
                """
                
                count_result = execute_query(check_query, (task_id,))
                if count_result:
                    total_count = count_result[0]['total_count']
                    
                    # 查询leads_follow_id为空的记录数
                    empty_query = """
                        SELECT COUNT(*) as empty_count
                        FROM leads_task_list 
                        WHERE task_id = %s AND leads_follow_id IS NULL
                    """
                    empty_result = execute_query(empty_query, (task_id,))
                    empty_count = empty_result[0]['empty_count'] if empty_result else 0
                    
                    if empty_count == 0:
                        # 所有记录的leads_follow_id都不为空，更新任务状态为4
                        update_query = """
                            UPDATE call_tasks 
                            SET task_type = 4 
                            WHERE id = %s
                        """
                        execute_update(update_query, (task_id,))
                        print(f"任务 {task_name} (ID: {task_id}) 所有线索跟进完成，状态更新为4")
                    else:
                        # 还有leads_follow_id为空的记录，调用查询接口更新
                        await self.update_task_execution(task_id)
                        
        except Exception as e:
            print(f"检查任务状态时出错: {str(e)}")
    
    async def update_task_execution(self, task_id):
        """更新任务执行状态"""
        try:
            # 查询该任务下leads_follow_id为空的记录
            query = """
                SELECT call_job_id, leads_name, leads_phone
                FROM leads_task_list 
                WHERE task_id = %s AND leads_follow_id IS NULL
                AND call_job_id IS NOT NULL AND call_job_id != ''
            """
            
            leads_result = execute_query(query, (task_id,))
            
            if not leads_result:
                return
            
            # 提取所有call_job_id
            call_job_ids = [lead['call_job_id'] for lead in leads_result if lead['call_job_id']]
            
            if not call_job_ids:
                return
            
            # 调用list_jobs接口获取任务执行状态
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
            from list_jobs import Sample as ListJobsSample
            from download_recording import Sample as DownloadRecordingSample
            
            try:
                jobs_data = ListJobsSample.main([], job_ids=call_job_ids)
                
                if not jobs_data:
                    return
                
                # 处理每个任务的结果
                for job_data in jobs_data:
                    job_id = job_data.get('JobId')
                    tasks = job_data.get('Tasks', [])
                    job_status = job_data.get('Status', '')
                    
                    if tasks and job_status == 'Succeeded':
                        # 获取最后一个任务的信息
                        last_task = tasks[-1]
                        status = last_task.get('Status', '')
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
                        
                        # 检查当前recording_url状态
                        current_recording_url = None
                        try:
                            check_recording_query = """
                                SELECT recording_url 
                                FROM leads_task_list 
                                WHERE task_id = %s AND call_job_id = %s
                            """
                            recording_result = execute_query(check_recording_query, (task_id, job_id))
                            if recording_result:
                                current_recording_url = recording_result[0].get('recording_url')
                        except Exception as e:
                            print(f"检查当前recording_url失败 - job_id: {job_id}, 错误: {str(e)}")
                        
                        # 获取录音URL
                        recording_url = None
                        if call_task_id and (current_recording_url is None or current_recording_url == ''):
                            try:
                                recording_url = DownloadRecordingSample.main([], task_id=call_task_id)
                                print(f"获取录音URL成功 - call_task_id: {call_task_id}, recording_url: {recording_url}")
                            except Exception as e:
                                print(f"获取录音URL失败 - call_task_id: {call_task_id}, 错误: {str(e)}")
                        elif current_recording_url:
                            recording_url = current_recording_url
                        
                        # 更新leads_task_list表
                        update_query = """
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
                            execute_update(update_query, (
                                status,
                                plan_time,
                                call_task_id,
                                json.dumps(conversation) if conversation else None,
                                calling_number,
                                recording_url,
                                task_id,
                                job_id
                            ))
                            
                            # 若包含会话，立即同步AI分析以更新 is_interested（仅回写 is_interested，不创建/更新跟进）
                            if conversation:
                                try:
                                    ai_result = get_leads_follow_id(job_id, force=True, dry_run=True)
                                    if isinstance(ai_result, dict) and ai_result.get('status') == 'success':
                                        ai_data = ai_result.get('data') or {}
                                        interest_value = ai_data.get('is_interested')
                                        if interest_value is not None:
                                            try:
                                                execute_update(
                                                    """
                                                    UPDATE leads_task_list
                                                    SET is_interested = %s
                                                    WHERE task_id = %s AND call_job_id = %s
                                                    """,
                                                    (interest_value, task_id, job_id)
                                                )
                                                print(f"[monitor] 已同步更新 is_interested={interest_value} - job_id: {job_id}")
                                            except Exception as e:
                                                print(f"[monitor] 更新 is_interested 失败 - job_id: {job_id}, 错误: {str(e)}")
                                except Exception as e:
                                    print(f"[monitor] AI 同步分析失败 - job_id: {job_id}, 错误: {str(e)}")

                            # 创建跟进记录
                            await self.create_leads_follow(job_id)
                            
                        except Exception as e:
                            print(f"更新任务 {job_id} 失败: {str(e)}")
                
            except Exception as e:
                print(f"获取外呼任务状态失败: {str(e)}")
                
        except Exception as e:
            print(f"更新任务执行状态时出错: {str(e)}")
    
    async def create_leads_follow(self, call_job_id):
        """创建线索跟进记录"""
        try:
            # 检查是否已存在跟进记录
            check_query = """
                SELECT leads_follow_id 
                FROM leads_task_list 
                WHERE call_job_id = %s
            """
            follow_result = execute_query(check_query, (call_job_id,))
            
            if follow_result and follow_result[0].get('leads_follow_id') is not None:
                print(f"任务 {call_job_id} 的leads_follow_id已存在，跳过跟进记录创建")
                return
            
            # 调用get_leads_follow_id函数创建跟进记录
            result = get_leads_follow_id(call_job_id)
            
            if result.get('status') == 'success':
                print(f"任务 {call_job_id} 的跟进记录创建成功")
            else:
                print(f"任务 {call_job_id} 的跟进记录创建失败: {result.get('message')}")
                
        except Exception as e:
            print(f"创建线索跟进记录时出错: {str(e)}")

# 全局监控器实例
auto_task_monitor = AutoTaskMonitor()

class AutoTaskRequest(BaseModel):
    """自动化任务请求"""
    action: str  # start, stop, check

class AutoTaskResponse(BaseModel):
    """自动化任务响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@auto_call_router.post("/auto-task", response_model=AutoTaskResponse)
async def control_auto_task(
    request: AutoTaskRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    控制自动化任务
    
    支持的操作：
    - start: 启动自动化任务监控
    - stop: 停止自动化任务监控
    - check: 立即执行一次任务检查
    
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
        
        if request.action == "start":
            # 启动监控
            if not auto_task_monitor.is_running:
                asyncio.create_task(auto_task_monitor.start_monitoring())
                message = "自动化任务监控已启动"
            else:
                message = "自动化任务监控已在运行中"
            
            return {
                "status": "success",
                "code": 200,
                "message": message,
                "data": {
                    "is_running": auto_task_monitor.is_running,
                    "action": request.action
                }
            }
            
        elif request.action == "stop":
            # 停止监控
            await auto_task_monitor.stop_monitoring()
            return {
                "status": "success",
                "code": 200,
                "message": "自动化任务监控已停止",
                "data": {
                    "is_running": auto_task_monitor.is_running,
                    "action": request.action
                }
            }
            
        elif request.action == "check":
            # 立即执行一次检查
            await auto_task_monitor.check_and_update_tasks()
            return {
                "status": "success",
                "code": 200,
                "message": "任务检查已完成",
                "data": {
                    "is_running": auto_task_monitor.is_running,
                    "action": request.action
                }
            }
            
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4001,
                    "message": "不支持的操作类型"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"控制自动化任务失败: {str(e)}"
            }
        )

# 修改创建任务函数，在创建成功后自动启动检查
async def start_auto_check_after_creation(task_id: int):
    """在创建任务后启动自动检查"""
    try:
        # 等待2秒后开始检查
        await asyncio.sleep(2)
        await auto_task_monitor.update_task_execution(task_id)
    except Exception as e:
        print(f"创建任务后自动检查失败: {str(e)}")


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
    暂停/重启任务
    
    暂停任务：检测该task_id对应的task_type是否等于2，等于2才可以进行暂停，暂停后，将状态修改为task_type=5
    重启任务：检测该task_id对应的task_type是否等于5，等于5才可以进行重启，重启后，task_type=2
    
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
        
        # 验证action参数
        if request.action not in ["suspend", "resume"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4001,
                    "message": "无效的操作类型"
                }
            )
        
        # 验证task_id参数
        if not request.task_id or request.task_id <= 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4005,
                    "message": "参数错误"
                }
            )
        
        # 查询任务信息
        task_query = """
            SELECT id, task_name, task_type, job_group_id 
            FROM call_tasks 
            WHERE id = %s
        """
        task_result = execute_query(task_query, (request.task_id,))
        
        if not task_result:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "code": 4004,
                    "message": "未找到对应的任务"
                }
            )
        
        task_info = task_result[0]
        current_task_type = task_info['task_type']
        job_group_id = task_info['job_group_id']
        
        print(f"执行任务操作: {request.action}, task_id: {request.task_id}, job_group_id: {job_group_id}, 当前task_type: {current_task_type}")
        
        if request.action == "suspend":
            # 暂停任务
            if current_task_type != 2:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "code": 4002,
                        "message": "任务状态不允许暂停"
                    }
                )
            
            # 调用阿里云API暂停任务
            suspend_result = SuspendJobsSample.suspend_jobs(job_group_id)
            
            # 检查阿里云API响应
            if not suspend_result.get("Success", False):
                error_message = suspend_result.get('Message', '未知错误')
                raise HTTPException(
                    status_code=suspend_result.get("HttpStatusCode", 500),
                    detail={
                        "status": "error",
                        "code": 5001,
                        "message": f"暂停任务失败: {error_message}"
                    }
                )
            
            # 更新数据库状态
            update_query = "UPDATE call_tasks SET task_type = 5 WHERE id = %s"
            execute_update(update_query, (request.task_id,))
            
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
            # 重启任务
            if current_task_type != 5:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "code": 4003,
                        "message": "任务状态不允许重启"
                    }
                )
            
            # 调用阿里云API重启任务
            resume_result = ResumeJobsSample.resume_jobs(job_group_id)
            
            # 检查阿里云API响应
            if not resume_result.get("Success", False):
                error_message = resume_result.get('Message', '未知错误')
                raise HTTPException(
                    status_code=resume_result.get("HttpStatusCode", 500),
                    detail={
                        "status": "error",
                        "code": 5002,
                        "message": f"重启任务失败: {error_message}"
                    }
                )
            
            # 更新数据库状态
            update_query = "UPDATE call_tasks SET task_type = 2 WHERE id = %s"
            execute_update(update_query, (request.task_id,))
            
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