from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import threading
import asyncio
from database.db import execute_query, execute_update
from .auth import verify_access_token
from openAPI.ali_bailian_api import ali_bailian_api
from .auto_task_monitor import auto_task_monitor, start_auto_check_after_creation
from openAPI.suspend_jobs import Sample as SuspendJobsSample
from openAPI.resumeJobs import Sample as ResumeJobsSample

auto_call_router = APIRouter(tags=["自动外呼任务"])

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
        
        # 启动自动检查任务
        asyncio.create_task(start_auto_check_after_creation(task_id))
        
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

@auto_call_router.get("/task-stats", response_model=TaskStatsResponse)
async def get_task_stats(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取任务统计信息
    
    根据access-token获取用户组织信息，统计call_tasks表中不同任务类型的数量和线索数量
    
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
        
        # 查询不同任务类型的统计信息
        stats_query = """
            SELECT 
                task_type,
                COUNT(*) as count,
                SUM(leads_count) as leads_count
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
        
        return {
            "status": "success",
            "code": 200,
            "message": "获取任务统计信息成功",
            "data": stats_list
        }
        
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
            
            # 如果call_status为空，则返回"未开始"
            call_status = lead['call_status'] if lead['call_status'] else "未开始"
            
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
        
        # 1. 在leads_task_list中找到对应task_id的call_job_id
        leads_query = """
            SELECT id, call_job_id, leads_name, leads_phone
            FROM leads_task_list 
            WHERE task_id = %s AND call_job_id IS NOT NULL AND call_job_id != ''
        """
        
        leads_result = execute_query(leads_query, (request.task_id,))
        
        if not leads_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4008,
                    "message": "任务下没有已分配的外呼任务"
                }
            )
        
        # 提取所有call_job_id
        call_job_ids = [lead['call_job_id'] for lead in leads_result if lead['call_job_id']]
        
        if not call_job_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4009,
                    "message": "没有有效的call_job_id"
                }
            )
        
        # 2. 调用list_jobs接口获取任务执行状态
        
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
        from list_jobs import Sample as ListJobsSample
        from download_recording import Sample as DownloadRecordingSample
        
        try:
            jobs_data = ListJobsSample.main(
                [],
                job_ids=call_job_ids
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
        
        if not jobs_data:
            return {
                "status": "success",
                "code": 200,
                "message": "未获取到外呼任务数据",
                "data": {
                    "task_id": request.task_id,
                    "task_name": task_info['task_name'],
                    "task_type": task_info['task_type'],
                    "total_jobs": len(call_job_ids),
                    "updated_count": 0,
                    "error_count": 0,
                    "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            }
        
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
                
                # 检查当前recording_url状态
                current_recording_url = None
                if job_status == 'Succeeded':
                    try:
                        check_recording_query = """
                            SELECT recording_url 
                            FROM leads_task_list 
                            WHERE task_id = %s AND call_job_id = %s
                        """
                        recording_result = execute_query(check_recording_query, (request.task_id, job_id))
                        if recording_result:
                            current_recording_url = recording_result[0].get('recording_url')
                            print(f"检查当前recording_url - job_id: {job_id}, current_recording_url: {current_recording_url}")
                        else:
                            print(f"未找到记录 - job_id: {job_id}, task_id: {request.task_id}")
                    except Exception as e:
                        print(f"检查当前recording_url失败 - job_id: {job_id}, 错误: {str(e)}")
                
                # 获取录音URL - 优先获取新的录音URL
                recording_url = None
                print(f"录音URL获取逻辑 - job_status: {job_status}, call_task_id: {call_task_id}, current_recording_url: {current_recording_url}")
                if call_task_id and job_status == 'Succeeded':
                    try:
                        new_recording_url = DownloadRecordingSample.main([], task_id=call_task_id)
                        if new_recording_url:
                            recording_url = new_recording_url
                            print(f"获取录音URL成功 - call_task_id: {call_task_id}, recording_url: {recording_url}")
                        else:
                            print(f"获取录音URL失败 - call_task_id: {call_task_id}, 返回值为None")
                            # 如果获取失败但有旧的URL，保持旧值
                            if current_recording_url:
                                recording_url = current_recording_url
                                print(f"保持原有录音URL: {recording_url}")
                    except Exception as e:
                        print(f"获取录音URL失败 - call_task_id: {call_task_id}, 错误: {str(e)}")
                        # 如果获取失败但有旧的URL，保持旧值
                        if current_recording_url:
                            recording_url = current_recording_url
                            print(f"保持原有录音URL: {recording_url}")
                elif job_status == 'Failed':
                    # 如果任务状态为Failed，不获取录音文件
                    print(f"任务状态为Failed，跳过录音文件获取 - job_status: {job_status}, call_task_id: {call_task_id}")
                    recording_url = None
                else:
                    print(f"不满足录音URL获取条件 - job_status: {job_status}, call_task_id: {call_task_id}")
                
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
                    print(f"准备更新数据库 - job_id: {job_id}, recording_url: {recording_url}, calling_number: {calling_number}")
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
                    print(f"更新参数: {update_params}")
                    affected_rows = execute_update(update_query, update_params)
                    print(f"数据库更新成功 - job_id: {job_id}, 影响行数: {affected_rows}")
                    updated_count += 1
                    
                except Exception as e:
                    error_count += 1
                    print(f"更新任务 {job_id} 失败: {str(e)}")
                    print(f"更新查询: {update_query}")
                    try:
                        print(f"更新参数: {update_params}")
                    except NameError:
                        print("更新参数未定义")
            
            if job_status in ['Succeeded', 'Failed']:
                # 检查leads_task_list中对应的leads_follow_id是否为空
                check_follow_query = """
                    SELECT leads_follow_id 
                    FROM leads_task_list 
                    WHERE call_job_id = %s
                """
                follow_result = execute_query(check_follow_query, (job_id,))
                
                if follow_result and follow_result[0].get('leads_follow_id') is None:
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
        
        # 在返回数据之前，为每个job_data添加is_interested和follow_data
        for job_data in jobs_data:
            job_id = job_data.get('JobId')
            
            # 获取is_interested和follow_data
            is_interested = None
            follow_data = None
            
            # 从leads_task_list中查询is_interested
            try:
                leads_query = """
                    SELECT is_interested, leads_follow_id
                    FROM leads_task_list 
                    WHERE call_job_id = %s
                """
                leads_result = execute_query(leads_query, (job_id,))
                if leads_result:
                    is_interested = leads_result[0].get('is_interested')
                    leads_follow_id = leads_result[0].get('leads_follow_id')
                    
                    # 如果leads_follow_id有值，查询dcc_leads_follow表
                    if leads_follow_id:
                        follow_query = """
                            SELECT id, leads_id, follow_time, leads_remark, 
                                   frist_follow_time, new_follow_time, next_follow_time,
                                   is_arrive, frist_arrive_time
                            FROM dcc_leads_follow 
                            WHERE id = %s
                        """
                        follow_result = execute_query(follow_query, (leads_follow_id,))
                        if follow_result:
                            follow_data = follow_result[0]
            except Exception as e:
                print(f"查询is_interested和follow_data失败 - job_id: {job_id}, 错误: {str(e)}")
            
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
                "total_jobs": len(call_job_ids),
                "updated_count": updated_count,
                "error_count": error_count,
                "query_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "jobs_data": jobs_data
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




def get_leads_follow_id(call_job_id):
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
        
        # 检查leads_follow_id是否已存在
        if leads_follow_id is not None:
            return {
                "status": "error",
                "code": 4003,
                "message": f"call_job_id为{call_job_id}的记录已存在跟进记录，无需重复创建"
            }
        
        # 检查任务状态，如果 Status = Failed，使用固定跟进内容
        if call_status == 'Failed':
            # 使用固定的跟进内容
            leads_remark = "客户未接电话，未打通；"
            next_follow_time = None
            is_interested = 0
        else:
            # 检查是否有通话记录
            if not call_conversation:
                return {
                    "status": "error", 
                    "code": 4002,
                    "message": f"call_job_id为{call_job_id}的记录中没有通话记录"
                }
            
            # 2. 将call_conversation作为prompt调用AI接口
            try:
                # 如果call_conversation是JSON字符串，需要解析
                if isinstance(call_conversation, str):
                    conversation_data = json.loads(call_conversation)
                else:
                    conversation_data = call_conversation
                
                # 构建prompt
                prompt = f"""
                请分析以下汽车销售通话记录，并返回JSON格式的分析结果：
                
                通话记录：
                {json.dumps(conversation_data, ensure_ascii=False, indent=2)}
                
                请分析客户意向并返回以下格式的JSON：
                {{
                    "leads_remark": "客户意向分析结果",
                    "next_follow_time": "建议下次跟进时间（格式：YYYY-MM-DD HH:MM:SS）",
                    "is_interested": 意向判断结果
                }}
                
                意向判断规则：
                - 如果无法判断客户意向，返回0
                - 如果客户有意向，返回1
                - 如果客户无意向，返回2
                """
                
                # 调用AI接口
                ai_response = ali_bailian_api(prompt)
                
                # 解析AI返回的JSON
                try:
                    # 处理AI返回的Markdown代码块格式
                    ai_response_clean = ai_response.strip()
                    if ai_response_clean.startswith('```json'):
                        # 移除开头的 ```json
                        ai_response_clean = ai_response_clean[7:]
                    if ai_response_clean.endswith('```'):
                        # 移除结尾的 ```
                        ai_response_clean = ai_response_clean[:-3]
                    
                    # 清理可能的换行符和多余空格
                    ai_response_clean = ai_response_clean.strip()
                    
                    ai_result = json.loads(ai_response_clean)
                    leads_remark = ai_result.get('leads_remark', '')
                    next_follow_time_str = ai_result.get('next_follow_time', '')
                    is_interested = ai_result.get('is_interested', 0)
                    
                    
                    # 解析下次跟进时间
                    next_follow_time = None
                    if next_follow_time_str:
                        try:
                            next_follow_time = datetime.strptime(next_follow_time_str, '%Y-%m-%d %H:%M:%S')
                        except:
                            # 如果时间格式不正确，设置为当前时间加1天
                            next_follow_time = datetime.now()
                    
                except json.JSONDecodeError:
                    # 如果AI返回的不是标准JSON，使用默认值
                    leads_remark = "AI分析结果解析失败，需要人工跟进"
                    next_follow_time = datetime.now()
                    is_interested = 0
                    
            except Exception as e:
                # AI调用失败，使用默认值
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
        
        # 4. 更新leads_task_list表中的leads_follow_id和is_interested
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