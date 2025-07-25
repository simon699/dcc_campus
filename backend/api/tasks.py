from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from database.db import execute_update, execute_query
from .auth import verify_access_token

tasks_router = APIRouter(tags=["任务管理"])

class CreateTaskRequest(BaseModel):
    task_name: str = Field(..., description="任务名称", example="客户跟进任务")
    task_mode: int = Field(..., description="任务方式：1=手动，2=自动", example=1)
    task_type: int = Field(..., description="任务类型：1=通知类，2=触达类", example=1)
    execution_time: Optional[str] = Field(None, description="任务执行时间（自动任务时必填，格式：YYYY-MM-DD HH:MM:SS）", example="2024-01-15 10:00:00")
    lead_ids: List[int] = Field(..., description="选择的线索ID列表", example=[1, 2, 3])
    
    class Config:
        schema_extra = {
            "example": {
                "task_name": "客户跟进任务",
                "task_mode": 1,
                "task_type": 1,
                "execution_time": "2024-01-15 10:00:00",
                "lead_ids": [1, 2, 3]
            }
        }

class TaskResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

@tasks_router.post("/create_task",
                  response_model=TaskResponse,
                  summary="创建任务",
                  description="创建新的任务并关联选择的线索",
                  tags=["任务管理"])
async def create_task(request: CreateTaskRequest, token: str = Depends(verify_access_token)):
    """
    创建任务
    
    - **task_name**: 任务名称（必填）
    - **task_mode**: 任务方式（必填）：1=手动，2=自动
    - **task_type**: 任务类型（必填）：1=通知类，2=触达类
    - **execution_time**: 任务执行时间（自动任务时必填）
    - **lead_ids**: 选择的线索ID列表（必填）
    
    返回创建成功的任务信息。
    """
    try:
        # 验证参数
        if request.task_mode not in [1, 2]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1001,
                    "message": "任务方式参数错误，必须是1（手动）或2（自动）"
                }
            )
        
        if request.task_type not in [1, 2]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1002,
                    "message": "任务类型参数错误，必须是1（通知类）或2（触达类）"
                }
            )
        
        # 自动任务必须设置执行时间
        if request.task_mode == 2 and not request.execution_time:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "自动任务必须设置执行时间"
                }
            )
        
        # 验证线索ID是否存在
        if not request.lead_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1004,
                    "message": "必须选择至少一个线索"
                }
            )
        
        # 检查线索是否存在
        lead_ids_str = ','.join(map(str, request.lead_ids))
        lead_check_query = f"SELECT id FROM clues WHERE id IN ({lead_ids_str})"
        existing_leads = execute_query(lead_check_query)
        existing_lead_ids = [lead['id'] for lead in existing_leads]
        
        if len(existing_lead_ids) != len(request.lead_ids):
            missing_ids = set(request.lead_ids) - set(existing_lead_ids)
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1005,
                    "message": f"以下线索ID不存在：{list(missing_ids)}"
                }
            )
        
        # 获取用户信息
        creator = token.get('username', '未知用户')
        organization_id = token.get('organization_id', 'ORG001')
        
        # 创建任务
        create_task_query = """
        INSERT INTO tasks (organization_id, task_name, task_mode, task_type, execution_time, creator)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        task_params = (
            organization_id,
            request.task_name,
            request.task_mode,
            request.task_type,
            request.execution_time if request.execution_time else None,
            creator
        )
        
        task_result = execute_update(create_task_query, task_params)
        task_id = task_result
        
        # 创建任务线索关联
        for lead_id in request.lead_ids:
            create_relation_query = """
            INSERT INTO task_leads (task_id, lead_id)
            VALUES (%s, %s)
            """
            execute_update(create_relation_query, (task_id, lead_id))
        
        # 获取创建的任务信息
        task_info_query = """
        SELECT t.*, COUNT(tl.lead_id) as lead_count
        FROM tasks t
        LEFT JOIN task_leads tl ON t.id = tl.task_id
        WHERE t.id = %s
        GROUP BY t.id
        """
        task_info = execute_query(task_info_query, (task_id,))
        
        return {
            "status": "success",
            "code": 0,
            "message": "任务创建成功",
            "data": {
                "task_id": task_id,
                "task_info": task_info[0] if task_info else None,
                "selected_leads_count": len(request.lead_ids)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create task error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1999,
                "message": f"创建任务失败：{str(e)}"
            }
        )

@tasks_router.get("/tasks",
                 response_model=TaskResponse,
                 summary="获取任务列表",
                 description="获取任务列表，支持分页和筛选",
                 tags=["任务管理"])
async def get_tasks(
    page: int = 1,
    page_size: int = 10,
    status: Optional[int] = None,
    task_type: Optional[int] = None,
    token: str = Depends(verify_access_token)
):
    """
    获取任务列表
    
    - **page**: 页码（默认1）
    - **page_size**: 每页数量（默认10）
    - **status**: 任务状态筛选（可选）：1=待执行，2=执行中，3=已完成，4=已取消
    - **task_type**: 任务类型筛选（可选）：1=通知类，2=触达类
    """
    try:
        organization_id = token.get('organization_id', 'ORG001')
        
        # 构建查询条件
        where_conditions = ["t.organization_id = %s"]
        params = [organization_id]
        
        if status is not None:
            where_conditions.append("t.status = %s")
            params.append(status)
        
        if task_type is not None:
            where_conditions.append("t.task_type = %s")
            params.append(task_type)
        
        where_clause = " AND ".join(where_conditions)
        
        # 获取总数
        count_query = f"""
        SELECT COUNT(*) as total
        FROM tasks t
        WHERE {where_clause}
        """
        count_result = execute_query(count_query, params)
        total = count_result[0]['total']
        
        # 获取任务列表
        offset = (page - 1) * page_size
        tasks_query = f"""
        SELECT t.*, COUNT(tl.lead_id) as lead_count
        FROM tasks t
        LEFT JOIN task_leads tl ON t.id = tl.task_id
        WHERE {where_clause}
        GROUP BY t.id
        ORDER BY t.create_time DESC
        LIMIT %s OFFSET %s
        """
        
        tasks_params = params + [page_size, offset]
        tasks_result = execute_query(tasks_query, tasks_params)
        
        return {
            "status": "success",
            "code": 0,
            "message": "获取任务列表成功",
            "data": {
                "tasks": tasks_result,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size
                }
            }
        }
        
    except Exception as e:
        print(f"Get tasks error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1999,
                "message": f"获取任务列表失败：{str(e)}"
            }
        )

@tasks_router.get("/task_detail/{task_id}",
                 response_model=TaskResponse,
                 summary="获取任务详情",
                 description="获取指定任务的详细信息，包括关联的线索",
                 tags=["任务管理"])
async def get_task_detail(task_id: int, token: str = Depends(verify_access_token)):
    """
    获取任务详情
    
    - **task_id**: 任务ID
    """
    try:
        organization_id = token.get('organization_id', 'ORG001')
        
        # 获取任务基本信息
        task_query = """
        SELECT t.*, COUNT(tl.lead_id) as lead_count
        FROM tasks t
        LEFT JOIN task_leads tl ON t.id = tl.task_id
        WHERE t.id = %s AND t.organization_id = %s
        GROUP BY t.id
        """
        task_result = execute_query(task_query, (task_id, organization_id))
        
        if not task_result:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "code": 1006,
                    "message": "任务不存在"
                }
            )
        
        task_info = task_result[0]
        
        # 获取关联的线索信息
        leads_query = """
        SELECT c.id, c.client_name, c.phone, c.product, c.clues_status_text, c.client_level_text
        FROM task_leads tl
        JOIN clues c ON tl.lead_id = c.id
        WHERE tl.task_id = %s
        ORDER BY c.client_name
        """
        leads_result = execute_query(leads_query, (task_id,))
        
        # 组合返回数据
        task_detail = {
            **task_info,
            "leads": leads_result
        }
        
        return {
            "status": "success",
            "code": 0,
            "message": "获取任务详情成功",
            "data": task_detail
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get task detail error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1999,
                "message": f"获取任务详情失败：{str(e)}"
            }
        )

class UpdateTaskStatusRequest(BaseModel):
    task_id: int = Field(..., description="任务ID")
    status: int = Field(..., description="新状态：1=未开始，2=执行中，3=已结束，4=已暂停")

@tasks_router.post("/update_status",
                  response_model=TaskResponse,
                  summary="更新任务状态",
                  description="更新指定任务的状态",
                  tags=["任务管理"])
async def update_task_status(request: UpdateTaskStatusRequest, token: str = Depends(verify_access_token)):
    """
    更新任务状态
    
    - **task_id**: 任务ID
    - **status**: 新状态（1=未开始，2=执行中，3=已结束，4=已暂停）
    """
    try:
        organization_id = token.get('organization_id', 'ORG001')
        
        # 验证状态值
        if request.status not in [1, 2, 3, 4]:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1007,
                    "message": "状态值无效，必须是1-4之间的整数"
                }
            )
        
        # 检查任务是否存在
        check_query = "SELECT id, status FROM tasks WHERE id = %s AND organization_id = %s"
        check_result = execute_query(check_query, (request.task_id, organization_id))
        
        if not check_result:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "code": 1006,
                    "message": "任务不存在"
                }
            )
        
        current_status = check_result[0]['status']
        
        # 状态转换验证
        valid_transitions = {
            1: [2],  # 未开始 -> 执行中
            2: [3, 4],  # 执行中 -> 已结束/已暂停
            3: [],  # 已结束 -> 无法转换
            4: [2]  # 已暂停 -> 执行中
        }
        
        if request.status not in valid_transitions.get(current_status, []):
            status_names = {1: '未开始', 2: '执行中', 3: '已结束', 4: '已暂停'}
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1008,
                    "message": f"无法从{status_names[current_status]}转换到{status_names[request.status]}"
                }
            )
        
        # 更新任务状态
        update_query = "UPDATE tasks SET status = %s WHERE id = %s AND organization_id = %s"
        execute_update(update_query, (request.status, request.task_id, organization_id))
        
        return {
            "status": "success",
            "code": 0,
            "message": "任务状态更新成功",
            "data": {
                "task_id": request.task_id,
                "new_status": request.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update task status error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1999,
                "message": f"更新任务状态失败：{str(e)}"
            }
        )