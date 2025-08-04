from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import json
from database.db import execute_query, execute_update, execute_many
from .auth import verify_access_token

call_tasks_router = APIRouter(tags=["外呼任务管理"])

# 数据模型
class TaskCreateRequest(BaseModel):
    """创建任务请求模型"""
    task_name: str = Field(..., description="任务名称")
    script_id: Optional[str] = Field(None, description="场景ID（脚本ID）")
    size_desc: Dict[str, Any] = Field(..., description="筛选条件")

class TaskDeleteRequest(BaseModel):
    """删除任务请求模型"""
    task_id: int = Field(..., description="任务ID")

class TaskUpdateStatusRequest(BaseModel):
    """更新任务状态请求模型"""
    task_id: int = Field(..., description="任务ID")
    task_type: int = Field(..., description="任务状态：1=已创建；2=开始外呼；3=外呼完成；4=已删除")

class LeadJobIdUpdateRequest(BaseModel):
    """更新线索job_id请求模型"""
    task_id: int = Field(..., description="任务ID")
    leads_id: int = Field(..., description="线索ID")
    call_job_id: str = Field(..., description="外呼任务ID")

class TaskListItem(BaseModel):
    """任务列表项"""
    id: int
    task_name: str
    organization_id: str
    create_name_id: str
    create_name: str
    create_time: datetime
    leads_count: int
    script_id: Optional[str]
    task_type: int
    size_desc: Optional[Dict[str, Any]]

class TaskDetailItem(BaseModel):
    """任务详情项"""
    id: int
    task_id: int
    leads_id: str
    leads_name: str
    leads_phone: str
    call_type: int
    call_time: datetime
    call_job_id: str
    call_id: str
    call_user_id: str
    call_conversation: Optional[Dict[str, Any]]

class TaskResponse(BaseModel):
    """任务响应模型"""
    status: str
    code: int
    message: str
    data: Optional[Any] = None

def get_user_org_id(user_id: int) -> str:
    """根据用户ID获取组织ID"""
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
    
    return org_result[0]['dcc_user_org_id']

def get_user_info(user_id: int) -> Dict[str, Any]:
    """根据用户ID获取用户信息"""
    user_query = "SELECT username FROM users WHERE id = %s"
    user_result = execute_query(user_query, (user_id,))
    
    if not user_result:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "code": 1003,
                "message": "用户信息不存在"
            }
        )
    
    return {
        "user_id": user_id,
        "username": user_result[0]['username']
    }

def build_leads_query(size_desc: Dict[str, Any], organization_id: str) -> tuple:
    """根据筛选条件构建线索查询SQL"""
    base_query = """
        SELECT DISTINCT l.leads_id, l.leads_user_name, l.leads_user_phone
        FROM dcc_leads l
        LEFT JOIN dcc_leads_follow f ON l.leads_id = f.leads_id
        WHERE l.organization_id = %s
    """
    params = [organization_id]
    
    # 添加筛选条件
    if size_desc.get('leads_product'):
        base_query += " AND l.leads_product = %s"
        params.append(size_desc['leads_product'])
    
    if size_desc.get('leads_type'):
        base_query += " AND l.leads_type = %s"
        params.append(size_desc['leads_type'])
    
    if size_desc.get('first_follow_start'):
        base_query += " AND f.frist_follow_time >= %s"
        params.append(size_desc['first_follow_start'])
    
    if size_desc.get('first_follow_end'):
        base_query += " AND f.frist_follow_time <= %s"
        params.append(size_desc['first_follow_end'])
    
    if size_desc.get('latest_follow_start'):
        base_query += " AND f.new_follow_time >= %s"
        params.append(size_desc['latest_follow_start'])
    
    if size_desc.get('latest_follow_end'):
        base_query += " AND f.new_follow_time <= %s"
        params.append(size_desc['latest_follow_end'])
    
    if size_desc.get('next_follow_start'):
        base_query += " AND f.next_follow_time >= %s"
        params.append(size_desc['next_follow_start'])
    
    if size_desc.get('next_follow_end'):
        base_query += " AND f.next_follow_time <= %s"
        params.append(size_desc['next_follow_end'])
    
    if size_desc.get('first_arrive_start'):
        base_query += " AND f.frist_arrive_time >= %s"
        params.append(size_desc['first_arrive_start'])
    
    if size_desc.get('first_arrive_end'):
        base_query += " AND f.frist_arrive_time <= %s"
        params.append(size_desc['first_arrive_end'])
    
    if size_desc.get('is_arrive') is not None:
        base_query += " AND f.is_arrive = %s"
        params.append(size_desc['is_arrive'])
    
    return base_query, params

@call_tasks_router.post("/call-tasks/create", response_model=TaskResponse)
async def create_call_task(
    request: TaskCreateRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    创建外呼任务
    
    - **task_name**: 任务名称
    - **script_id**: 场景ID（脚本ID）（可选）
    - **size_desc**: 筛选条件（JSON格式）
    
    返回数据包含：
    - **task_id**: 任务ID
    - **leads_count**: 符合条件的线索数量
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
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 获取用户信息
        user_info = get_user_info(user_id)
        
        # 根据筛选条件查询符合条件的线索
        leads_query, leads_params = build_leads_query(request.size_desc, organization_id)
        leads_result = execute_query(leads_query, leads_params)
        
        if not leads_result:
            return TaskResponse(
                status="error",
                code=2001,
                message="根据筛选条件未找到符合条件的线索",
                data={"leads_count": 0}
            )
        
        leads_count = len(leads_result)
        
        # 创建任务记录
        task_insert_query = """
            INSERT INTO call_tasks (
                task_name, organization_id, create_name_id, create_name, 
                create_time, leads_count, script_id, task_type, size_desc
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        task_params = (
            request.task_name,
            organization_id,
            user_id,
            user_info['username'],
            datetime.now(),
            leads_count,
            request.script_id,
            1,  # 任务类型：1-已创建
            json.dumps(request.size_desc, ensure_ascii=False)
        )
        
        execute_update(task_insert_query, task_params)
        
        # 获取新创建的任务ID
        task_id_query = "SELECT id FROM call_tasks WHERE task_name = %s AND create_name_id = %s ORDER BY create_time DESC LIMIT 1"
        task_id_result = execute_query(task_id_query, (request.task_name, user_id))
        
        if not task_id_result:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 2002,
                    "message": "创建任务失败"
                }
            )
        
        task_id = task_id_result[0]['id']
        
        # 批量插入任务明细
        if leads_result:
            detail_insert_query = """
                INSERT INTO leads_task_list (
                    task_id, leads_id, leads_name, leads_phone, 
                    call_type, call_time, call_job_id, call_id, call_user_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            detail_params = []
            for lead in leads_result:
                detail_params.append((
                    task_id,
                    lead['leads_id'],
                    lead['leads_user_name'],
                    lead['leads_user_phone'],
                    0,  # 电话状态：0-未开始
                    datetime.now(),
                    '',  # 电话任务ID（初始为空）
                    '',  # 通话ID（初始为空）
                    user_id  # 通话用户ID
                ))
            
            execute_many(detail_insert_query, detail_params)
        
        return TaskResponse(
            status="success",
            code=200,
            message="外呼任务创建成功",
            data={
                "task_id": task_id,
                "task_name": request.task_name,
                "leads_count": leads_count,
                "organization_id": organization_id,
                "create_name": user_info['username']
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2003,
                "message": f"创建外呼任务失败：{str(e)}"
            }
        )

@call_tasks_router.post("/call-tasks/delete", response_model=TaskResponse)
async def delete_call_task(
    request: TaskDeleteRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    删除外呼任务
    
    - **task_id**: 任务ID
    
    返回数据包含：
    - **task_id**: 被删除的任务ID
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
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id, task_name, task_type 
            FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (request.task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2006,
                    "message": "任务不存在或无权限删除"
                }
            )
        
        task_info = task_result[0]
        
        # 检查任务是否已经被删除
        if task_info['task_type'] == 4:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2007,
                    "message": "任务已经被删除"
                }
            )
        
        # 软删除任务（将task_type设置为4）
        delete_query = """
            UPDATE call_tasks 
            SET task_type = 4 
            WHERE id = %s AND organization_id = %s
        """
        execute_update(delete_query, (request.task_id, organization_id))
        
        return TaskResponse(
            status="success",
            code=200,
            message="外呼任务删除成功",
            data={
                "task_id": request.task_id,
                "task_name": task_info['task_name']
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2008,
                "message": f"删除外呼任务失败：{str(e)}"
            }
        )

@call_tasks_router.get("/call-tasks/list", response_model=TaskResponse)
async def get_call_tasks_list(
    task_id: Optional[int] = Query(None, description="任务ID（可选，用于查询特定任务）"),
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取外呼任务列表或任务详情
    
    - **task_id**: 任务ID（可选，如果不提供则返回所有任务列表）
    
    返回数据包含：
    - 任务列表或任务详情（已过滤掉删除的任务）
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
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        if task_id:
            # 查询特定任务详情（过滤掉已删除的任务）
            task_query = """
                SELECT ct.*, ltl.*
                FROM call_tasks ct
                LEFT JOIN leads_task_list ltl ON ct.id = ltl.task_id
                WHERE ct.id = %s AND ct.organization_id = %s AND ct.task_type != 4
            """
            task_result = execute_query(task_query, (task_id, organization_id))
            
            if not task_result:
                return TaskResponse(
                    status="error",
                    code=2004,
                    message="任务不存在或无权限访问",
                    data=None
                )
            
            # 构建任务详情数据
            task_info = None
            task_details = []
            
            for row in task_result:
                if task_info is None:
                    task_info = {
                        "id": row['id'],
                        "task_name": row['task_name'],
                        "organization_id": row['organization_id'],
                        "create_name_id": row['create_name_id'],
                        "create_name": row['create_name'],
                        "create_time": row['create_time'],
                        "leads_count": row['leads_count'],
                        "script_id": row['script_id'],
                        "task_type": row['task_type'],
                        "size_desc": json.loads(row['size_desc']) if row['size_desc'] else None
                    }
                
                if row.get('leads_id'):
                    task_details.append({
                        "id": row.get('id_1'),  # leads_task_list的id
                        "task_id": row['task_id'],
                        "leads_id": row['leads_id'],
                        "leads_name": row['leads_name'],
                        "leads_phone": row['leads_phone'],
                        "call_type": row['call_type'],
                        "call_time": row['call_time'],
                        "call_job_id": row['call_job_id'],
                        "call_id": row['call_id'],
                        "call_user_id": row['call_user_id'],
                        "call_conversation": json.loads(row['call_conversation']) if row['call_conversation'] else None
                    })
            
            return TaskResponse(
                status="success",
                code=200,
                message="获取任务详情成功",
                data={
                    "task_info": task_info,
                    "task_details": task_details
                }
            )
        else:
            # 查询任务列表（过滤掉已删除的任务）
            tasks_query = """
                SELECT id, task_name, organization_id, create_name_id, create_name,
                       create_time, leads_count, script_id, task_type, size_desc
                FROM call_tasks 
                WHERE organization_id = %s AND task_type != 4
                ORDER BY create_time DESC
            """
            tasks_result = execute_query(tasks_query, (organization_id,))
            
            task_list = []
            for task in tasks_result:
                task_list.append({
                    "id": task['id'],
                    "task_name": task['task_name'],
                    "organization_id": task['organization_id'],
                    "create_name_id": task['create_name_id'],
                    "create_name": task['create_name'],
                    "create_time": task['create_time'],
                    "leads_count": task['leads_count'],
                    "script_id": task['script_id'],
                    "task_type": task['task_type'],
                    "size_desc": json.loads(task['size_desc']) if task['size_desc'] else None
                })
            
            return TaskResponse(
                status="success",
                code=200,
                message="获取任务列表成功",
                data={
                    "tasks": task_list,
                    "total": len(task_list)
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2005,
                "message": f"获取任务信息失败：{str(e)}"
            }
        ) 

@call_tasks_router.post("/update_task_status", response_model=TaskResponse)
async def update_task_status(
    request: TaskUpdateStatusRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    更新任务状态
    
    - **task_id**: 任务ID（必填）
    - **task_type**: 任务状态（必填）：1=已创建；2=开始外呼；3=外呼完成；4=已删除
    """
    try:
        user_id = token.get('user_id')
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "用户信息无效"
                }
            )
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 验证任务状态值
        if request.task_type not in [1, 2, 3, 4]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2006,
                    "message": "无效的任务状态值"
                }
            )
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (request.task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2007,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        # 更新任务状态
        update_query = """
            UPDATE call_tasks 
            SET task_type = %s 
            WHERE id = %s AND organization_id = %s
        """
        execute_update(update_query, (request.task_type, request.task_id, organization_id))
        
        return TaskResponse(
            status="success",
            code=200,
            message="任务状态更新成功",
            data={
                "task_id": request.task_id,
                "task_type": request.task_type
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2008,
                "message": f"更新任务状态失败：{str(e)}"
            }
        )

@call_tasks_router.post("/update_lead_job_id", response_model=TaskResponse)
async def update_lead_job_id(
    request: LeadJobIdUpdateRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    更新线索的call_job_id
    
    - **task_id**: 任务ID（必填）
    - **leads_id**: 线索ID（必填）
    - **call_job_id**: 外呼任务ID（必填）
    """
    try:
        user_id = token.get('user_id')
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "用户信息无效"
                }
            )
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (request.task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2009,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        # 更新线索的call_job_id
        update_query = """
            UPDATE leads_task_list 
            SET call_job_id = %s 
            WHERE task_id = %s AND leads_id = %s
        """
        execute_update(update_query, (request.call_job_id, request.task_id, request.leads_id))
        
        return TaskResponse(
            status="success",
            code=200,
            message="线索job_id更新成功",
            data={
                "task_id": request.task_id,
                "leads_id": request.leads_id,
                "call_job_id": request.call_job_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2010,
                "message": f"更新线索job_id失败：{str(e)}"
            }
        ) 

@call_tasks_router.get("/call-tasks/statistics", response_model=TaskResponse)
async def get_call_tasks_statistics(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取任务统计数据
    
    返回数据包含：
    - **task_agent**: 任务Agent统计（总数，已创建总数）
    - **script_agent**: 话术生成Agent统计（总数，已创建总数）
    - **calling_agent**: 外呼Agent统计（开始执行中的任务数量，待拨打的电话数量）
    - **followup_agent**: 跟进记录Agent统计（已完成的任务，已拨打完成的电话数）
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
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 查询任务统计数据
        # 1. 任务Agent统计：总数，已创建总数
        task_stats_query = """
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN task_type = 1 THEN 1 ELSE 0 END) as created_tasks
            FROM call_tasks 
            WHERE organization_id = %s AND task_type != 4
        """
        task_stats_result = execute_query(task_stats_query, (organization_id,))
        task_stats = task_stats_result[0] if task_stats_result else {"total_tasks": 0, "created_tasks": 0}
        
        # 2. 话术生成Agent统计：总数，已创建总数（与任务Agent相同）
        script_stats = {
            "total_tasks": task_stats["total_tasks"],
            "created_tasks": task_stats["created_tasks"]
        }
        
        # 3. 外呼Agent统计：开始执行中的任务数量，待拨打的电话数量
        calling_stats_query = """
            SELECT 
                SUM(CASE WHEN task_type = 2 THEN 1 ELSE 0 END) as executing_tasks,
                SUM(CASE WHEN task_type = 2 THEN leads_count ELSE 0 END) as pending_calls
            FROM call_tasks 
            WHERE organization_id = %s AND task_type != 4
        """
        calling_stats_result = execute_query(calling_stats_query, (organization_id,))
        calling_stats = calling_stats_result[0] if calling_stats_result else {"executing_tasks": 0, "pending_calls": 0}
        
        # 4. 跟进记录Agent统计：已完成的任务，已拨打完成的电话数
        followup_stats_query = """
            SELECT 
                SUM(CASE WHEN task_type = 3 THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN ltl.call_type = 2 THEN 1 ELSE 0 END) as completed_calls
            FROM call_tasks ct
            LEFT JOIN leads_task_list ltl ON ct.id = ltl.task_id
            WHERE ct.organization_id = %s AND ct.task_type != 4
        """
        followup_stats_result = execute_query(followup_stats_query, (organization_id,))
        followup_stats = followup_stats_result[0] if followup_stats_result else {"completed_tasks": 0, "completed_calls": 0}
        
        return TaskResponse(
            status="success",
            code=200,
            message="获取任务统计数据成功",
            data={
                "task_agent": {
                    "total": task_stats["total_tasks"],
                    "created": task_stats["created_tasks"]
                },
                "script_agent": {
                    "total": script_stats["total_tasks"],
                    "created": script_stats["created_tasks"]
                },
                "calling_agent": {
                    "executing_tasks": calling_stats["executing_tasks"],
                    "pending_calls": calling_stats["pending_calls"]
                },
                "followup_agent": {
                    "completed_tasks": followup_stats["completed_tasks"],
                    "completed_calls": followup_stats["completed_calls"]
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2011,
                "message": f"获取任务统计数据失败：{str(e)}"
            }
        ) 

# 修复API路由路径，确保与前端调用一致
@call_tasks_router.post("/check_task_completion", response_model=TaskResponse)
async def check_task_completion(
    request: TaskUpdateStatusRequest,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    检查任务完成状态
    
    - **task_id**: 任务ID（必填）
    - **task_type**: 当前任务状态（必填）
    
    如果任务的所有通话都是已接通状态，则自动将任务状态更新为完成（task_type=3）
    """
    try:
        user_id = token.get('user_id')
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "用户信息无效"
                }
            )
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id, task_type FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (request.task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2007,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        current_task_type = task_result[0]['task_type']
        
        # 如果任务已经是完成状态，直接返回
        if current_task_type == 3:
            return TaskResponse(
                status="success",
                code=200,
                message="任务已完成",
                data={
                    "task_id": request.task_id,
                    "task_type": current_task_type,
                    "is_completed": True
                }
            )
        
        # 查询该任务的所有通话记录
        call_records_query = """
            SELECT ocr.call_status, ocr.call_duration, ocr.call_result
            FROM outbound_call_records ocr
            JOIN leads_task_list ltl ON ocr.lead_id = ltl.leads_id
            WHERE ltl.task_id = %s
        """
        call_records = execute_query(call_records_query, (request.task_id,))
        
        if not call_records:
            return TaskResponse(
                status="success",
                code=200,
                message="任务暂无通话记录",
                data={
                    "task_id": request.task_id,
                    "task_type": current_task_type,
                    "is_completed": False,
                    "total_calls": 0,
                    "connected_calls": 0
                }
            )
        
        # 统计通话状态
        total_calls = len(call_records)
        connected_calls = 0
        
        for record in call_records:
            call_status = record.get('call_status')
            # 检查是否为已接通状态
            if call_status in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"]:
                connected_calls += 1
        
        # 如果所有通话都是已接通状态，则更新任务为完成状态
        is_completed = total_calls > 0 and connected_calls == total_calls
        
        if is_completed and current_task_type != 3:
            # 更新任务状态为完成
            update_query = """
                UPDATE call_tasks 
                SET task_type = 3 
                WHERE id = %s AND organization_id = %s
            """
            execute_update(update_query, (request.task_id, organization_id))
            
            return TaskResponse(
                status="success",
                code=200,
                message="任务已完成，所有通话都已接通",
                data={
                    "task_id": request.task_id,
                    "task_type": 3,
                    "is_completed": True,
                    "total_calls": total_calls,
                    "connected_calls": connected_calls
                }
            )
        else:
            return TaskResponse(
                status="success",
                code=200,
                message="任务未完成，部分通话未接通",
                data={
                    "task_id": request.task_id,
                    "task_type": current_task_type,
                    "is_completed": False,
                    "total_calls": total_calls,
                    "connected_calls": connected_calls
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2009,
                "message": f"检查任务完成状态失败：{str(e)}"
            }
        )

# 添加一个GET版本的检查任务完成状态API，以便前端更容易调用
@call_tasks_router.get("/check_task_completion/{task_id}", response_model=TaskResponse)
async def check_task_completion_get(
    task_id: int,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    检查任务完成状态（GET版本）
    
    - **task_id**: 任务ID（路径参数）
    """
    try:
        user_id = token.get('user_id')
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "用户信息无效"
                }
            )
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id, task_type FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2007,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        current_task_type = task_result[0]['task_type']
        
        # 如果任务已经是完成状态，直接返回
        if current_task_type == 3:
            return TaskResponse(
                status="success",
                code=200,
                message="任务已完成",
                data={
                    "task_id": task_id,
                    "task_type": current_task_type,
                    "is_completed": True
                }
            )
        
        # 查询该任务的所有通话记录
        call_records_query = """
            SELECT ocr.call_status, ocr.call_duration, ocr.call_result
            FROM outbound_call_records ocr
            JOIN leads_task_list ltl ON ocr.lead_id = ltl.leads_id
            WHERE ltl.task_id = %s
        """
        call_records = execute_query(call_records_query, (task_id,))
        
        if not call_records:
            return TaskResponse(
                status="success",
                code=200,
                message="任务暂无通话记录",
                data={
                    "task_id": task_id,
                    "task_type": current_task_type,
                    "is_completed": False,
                    "total_calls": 0,
                    "connected_calls": 0
                }
            )
        
        # 统计通话状态
        total_calls = len(call_records)
        connected_calls = 0
        
        for record in call_records:
            call_status = record.get('call_status')
            # 检查是否为已接通状态
            if call_status in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"]:
                connected_calls += 1
        
        # 如果所有通话都是已接通状态，则更新任务为完成状态
        is_completed = total_calls > 0 and connected_calls == total_calls
        
        if is_completed and current_task_type != 3:
            # 更新任务状态为完成
            update_query = """
                UPDATE call_tasks 
                SET task_type = 3 
                WHERE id = %s AND organization_id = %s
            """
            execute_update(update_query, (task_id, organization_id))
            
            return TaskResponse(
                status="success",
                code=200,
                message="任务已完成，所有通话都已接通",
                data={
                    "task_id": task_id,
                    "task_type": 3,
                    "is_completed": True,
                    "total_calls": total_calls,
                    "connected_calls": connected_calls
                }
            )
        else:
            return TaskResponse(
                status="success",
                code=200,
                message="任务未完成，部分通话未接通",
                data={
                    "task_id": task_id,
                    "task_type": current_task_type,
                    "is_completed": False,
                    "total_calls": total_calls,
                    "connected_calls": connected_calls
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2009,
                "message": f"检查任务完成状态失败：{str(e)}"
            }
        ) 

@call_tasks_router.get("/task_followup_records/{task_id}", response_model=TaskResponse)
async def get_task_followup_records(
    task_id: int,
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    获取任务的跟进记录和任务情况
    
    - **task_id**: 任务ID（路径参数）
    """
    try:
        user_id = token.get('user_id')
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "用户信息无效"
                }
            )
        
        # 获取组织ID
        organization_id = get_user_org_id(user_id)
        
        # 检查任务是否存在且属于该组织
        task_check_query = """
            SELECT id, task_name, task_type, create_time, leads_count
            FROM call_tasks 
            WHERE id = %s AND organization_id = %s
        """
        task_result = execute_query(task_check_query, (task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2007,
                    "message": "任务不存在或无权限访问"
                }
            )
        
        task_info = task_result[0]
        
        # 获取任务的通话记录
        call_records_query = """
            SELECT 
                ocr.lead_id,
                ocr.call_status,
                ocr.call_duration,
                ocr.call_result,
                ocr.call_time,
                ocr.failure_reason,
                ltl.leads_name,
                ltl.leads_phone
            FROM outbound_call_records ocr
            JOIN leads_task_list ltl ON ocr.lead_id = ltl.leads_id
            WHERE ltl.task_id = %s
            ORDER BY ocr.call_time DESC
        """
        call_records = execute_query(call_records_query, (task_id,))
        
        # 统计通话情况
        total_calls = len(call_records)
        connected_calls = 0
        failed_calls = 0
        busy_calls = 0
        no_answer_calls = 0
        
        for record in call_records:
            call_status = record.get('call_status')
            if call_status in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"]:
                connected_calls += 1
            elif call_status in ["Failed", "NotConnected"]:
                failed_calls += 1
            elif call_status == "Busy":
                busy_calls += 1
            elif call_status == "NoAnswer":
                no_answer_calls += 1
            else:
                failed_calls += 1
        
        # 计算成功率
        success_rate = (connected_calls / total_calls * 100) if total_calls > 0 else 0
        
        # 判断任务是否完成
        is_completed = total_calls > 0 and connected_calls == total_calls
        
        # 如果任务未完成但所有通话都已接通，自动更新任务状态
        if is_completed and task_info['task_type'] != 3:
            update_query = """
                UPDATE call_tasks 
                SET task_type = 3 
                WHERE id = %s AND organization_id = %s
            """
            execute_update(update_query, (task_id, organization_id))
            task_info['task_type'] = 3
        
        # 构建跟进记录数据
        followup_records = []
        for record in call_records:
            followup_record = {
                "id": f"followup-{record['lead_id']}",
                "leadName": record['leads_name'],
                "phone": record['leads_phone'],
                "followupTime": record['call_time'].strftime('%Y-%m-%d %H:%M:%S') if record['call_time'] else '',
                "followupType": "call",
                "status": "success" if record['call_status'] in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"] else "failed",
                "content": record['call_result'] or "通话完成",
                "notes": record['failure_reason'] if record['failure_reason'] else None
            }
            followup_records.append(followup_record)
        
        return TaskResponse(
            status="success",
            code=200,
            message="获取任务跟进记录成功",
            data={
                "task_info": {
                    "id": task_info['id'],
                    "task_name": task_info['task_name'],
                    "task_type": task_info['task_type'],
                    "create_time": task_info['create_time'].strftime('%Y-%m-%d %H:%M:%S') if task_info['create_time'] else '',
                    "leads_count": task_info['leads_count'],
                    "is_completed": is_completed
                },
                "call_statistics": {
                    "total_calls": total_calls,
                    "connected_calls": connected_calls,
                    "failed_calls": failed_calls,
                    "busy_calls": busy_calls,
                    "no_answer_calls": no_answer_calls,
                    "success_rate": round(success_rate, 2)
                },
                "followup_records": followup_records
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2010,
                "message": f"获取任务跟进记录失败：{str(e)}"
            }
        ) 