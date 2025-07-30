from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
import json
from database.db import execute_update, execute_query
from .auth import verify_access_token
from openAPI.create_job_group import Sample as JobGroupSample
from openAPI.list_jobs import Sample as ListJobsSample
from openAPI.list_job_groups import Sample as ListJobGroupsSample
from openAPI.assign_jobs import Sample as AssignJobsSample

auto_call_router = APIRouter(tags=["外呼任务管理"])

class CreateOutboundCallRequest(BaseModel):
    job_group_name: str = Field(..., description="外呼任务组名称", example="客户回访任务")
    job_group_description: str = Field(..., description="外呼任务组描述", example="对重要客户进行回访")
    strategy_json: Optional[dict] = Field(None, description="外呼策略配置", example={
        "maxAttemptsPerDay": 3,
        "minAttemptInterval": 120,
        "RepeatBy": "once"
    })
    lead_ids: List[int] = Field(..., description="选择的线索ID列表", example=[1, 2, 3])
    extras: Optional[List[dict]] = Field(None, description="额外参数配置", example=[
        {"key": "ServiceId", "value": ""},
        {"key": "TenantId", "value": ""}
    ])
    
    class Config:
        schema_extra = {
            "example": {
                "job_group_name": "客户回访任务",
                "job_group_description": "对重要客户进行回访",
                "strategy_json": {
                    "maxAttemptsPerDay": 3,
                    "minAttemptInterval": 120,
                    "RepeatBy": "once"
                },
                "lead_ids": [1, 2, 3],
            }
        }

class QueryOutboundCallRequest(BaseModel):
    job_ids: List[str] = Field(..., description="外呼任务ID列表", example=["1c00013c-f4fa-4a81-af55-4c81940dd759"])
    
    class Config:
        schema_extra = {
            "example": {
                "job_ids": ["1c00013c-f4fa-4a81-af55-4c81940dd759"]
            }
        }

class OutboundCallResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

@auto_call_router.post("/create_outbound_call",
                      response_model=OutboundCallResponse,
                      summary="发起外呼任务",
                      description="创建外呼任务组并分配外呼任务，关联选择的线索",
                      tags=["外呼任务管理"])
async def create_outbound_call(request: CreateOutboundCallRequest, token: str = Depends(verify_access_token)):
    """
    发起外呼任务
    
    - **job_group_name**: 外呼任务组名称（必填）
    - **job_group_description**: 外呼任务组描述（必填）
    - **strategy_json**: 外呼策略配置（可选）
    - **lead_ids**: 选择的线索ID列表（必填）
    - **extras**: 额外参数配置（可选），用于传递自定义参数给外呼脚本
    
    返回创建成功的外呼任务组和任务信息。
    """
    try:
        # 验证参数
        if not request.job_group_name.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3001,
                    "message": "外呼任务组名称不能为空"
                }
            )
        
        if not request.job_group_description.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3002,
                    "message": "外呼任务组描述不能为空"
                }
            )
        
        # 验证线索ID是否存在
        if not request.lead_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3003,
                    "message": "必须选择至少一个线索"
                }
            )
        
        # 检查线索是否存在并获取详细信息
        lead_ids_str = ','.join(map(str, request.lead_ids))
        lead_check_query = f"""
            SELECT id, client_name, phone, organization_id, create_name 
            FROM clues 
            WHERE id IN ({lead_ids_str})
        """
        existing_leads = execute_query(lead_check_query)
        existing_lead_ids = [lead['id'] for lead in existing_leads]
        
        if len(existing_lead_ids) != len(request.lead_ids):
            missing_ids = set(request.lead_ids) - set(existing_lead_ids)
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3004,
                    "message": f"以下线索ID不存在: {list(missing_ids)}"
                }
            )
        
        # 检查是否有有效的电话号码
        valid_leads = [lead for lead in existing_leads if lead['phone']]
        if not valid_leads:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3005,
                    "message": "选择的线索中没有有效的电话号码"
                }
            )
        
        # 调用阿里云外呼API创建任务组
        try:
            job_group = JobGroupSample.main(
                self=JobGroupSample(),
                args=[],
                job_group_name=request.job_group_name,
                job_group_description=request.job_group_description,
                StrategyJson=request.strategy_json
            )
            
            job_group_id = job_group.job_group_id
            job_group_name = job_group.job_group_name
            created_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            
            
            # 添加联系人信息
            jobs_json = []
            for lead in valid_leads:
                # 准备外呼任务数据
                jobs_data = {
                    "contacts": [{
                        "phoneNumber": lead['phone'],
                        "name": lead['client_name'],  # 使用client_name字段
                        "referenceId": f"lead_{lead['id']}",
                    "role": "客户",
                    "honorific": lead['client_name']  # 可以根据需要设置称谓
                    }]
                }
                jobs_json.append(json.dumps(jobs_data))
            
            # 调用阿里云API分配外呼任务
            jobs_response = AssignJobsSample.main(
                args=[],
                job_group_id=job_group_id,
                jobs_json=jobs_json
            )
            
            # 保存外呼任务记录到数据库
            insert_query = """
                INSERT INTO outbound_calls (job_group_id, job_group_name, description, 
                                         strategy_json, lead_ids, status, created_time, creator)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            strategy_json_str = json.dumps(request.strategy_json) if request.strategy_json else None
            lead_ids_str = json.dumps(request.lead_ids)
            
            # 获取创建者信息（从token中解析或使用默认值）
            creator = "system"  # 这里可以从token中解析用户信息
            
            execute_update(insert_query, (
                job_group_id,
                job_group_name,
                request.job_group_description,
                strategy_json_str,
                lead_ids_str,
                1,  # 状态：1=已创建
                created_time,
                creator
            ))
            
            # 更新线索状态为外呼中
            update_leads_query = f"""
                UPDATE clues 
                SET clues_status = 2, update_time = NOW() 
                WHERE id IN ({','.join(map(str, request.lead_ids))})
            """
            execute_update(update_leads_query)
            
            return {
                "status": "success",
                "code": 1000,
                "message": "外呼任务创建成功",
                "data": {
                    "job_group_id": job_group_id,
                    "job_group_name": job_group_name,
                    "description": request.job_group_description,
                    "strategy_json": request.strategy_json,
                    "lead_count": len(valid_leads),
                    "created_time": created_time,
                    "jobs_id": jobs_response,
                    "jobs_json": jobs_json
                }
            }
            
        except Exception as api_error:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 3006,
                    "message": f"外呼API调用失败: {str(api_error)}"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 3007,
                "message": f"创建外呼任务失败: {str(e)}"
            }
        )

@auto_call_router.post("/query_outbound_call",
                      response_model=OutboundCallResponse,
                      summary="查询外呼任务",
                      description="查询指定外呼任务的详细信息",
                      tags=["外呼任务管理"])
async def query_outbound_call(request: QueryOutboundCallRequest, token: str = Depends(verify_access_token)):
    """
    查询外呼任务
    
    - **job_ids**: 外呼任务ID列表（必填）
    
    返回外呼任务的详细信息。
    """
    try:
        # 验证参数
        if not request.job_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3008,
                    "message": "必须提供至少一个外呼任务ID"
                }
            )
        
        # 调用阿里云外呼API查询任务
        try:
            jobs_response = ListJobsSample.main(
                args=[],
                job_id=request.job_ids
            )
            
            # 查询数据库中的外呼任务记录
            job_ids_str = ','.join([f"'{job_id}'" for job_id in request.job_ids])
            db_query = f"""
                SELECT * FROM outbound_calls 
                WHERE job_group_id IN ({job_ids_str})
                ORDER BY created_time DESC
            """
            db_records = execute_query(db_query)
            
            # 构建返回数据
            jobs_data = []
            for job in jobs_response:
                # 查找对应的数据库记录
                db_record = next((record for record in db_records if record['job_group_id'] == job.job_id), None)
                
                job_info = {
                    "job_id": job.job_id,
                    "job_group_id": job.job_group_id,
                    "status": job.status,
                    "priority": job.priority,
                    "failure_reason": job.failure_reason,
                    "result": job.result,
                    "created_time": job.created_time,
                    "modified_time": job.modified_time,
                    "db_record": db_record
                }
                jobs_data.append(job_info)
            
            return {
                "status": "success",
                "code": 1000,
                "message": "查询外呼任务成功",
                "data": {
                    "jobs": jobs_data,
                    "total_count": len(jobs_data)
                }
            }
            
        except Exception as api_error:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 3009,
                    "message": f"外呼API查询失败: {str(api_error)}"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 3010,
                "message": f"查询外呼任务失败: {str(e)}"
            }
        )

@auto_call_router.get("/outbound_calls",
                     response_model=OutboundCallResponse,
                     summary="获取外呼任务列表",
                     description="获取阿里云外呼任务组列表，支持分页和筛选",
                     tags=["外呼任务管理"])
async def get_outbound_calls(
    page: int = 1,
    page_size: int = 10,
    status: Optional[str] = None,
    token: str = Depends(verify_access_token)
):
    """
    获取外呼任务列表
    
    - **page**: 页码（默认1）
    - **page_size**: 每页数量（默认10）
    - **status**: 任务状态筛选（可选）
    
    直接返回阿里云外呼任务组列表数据。
    """
    try:
        # 调用阿里云API获取外呼任务组列表
        try:
            cloud_job_groups = ListJobGroupsSample.main(
                args=[],
                page_number=page,
                page_size=page_size,
                instance_id=os.getenv('INSTANCE_ID')
            )
            
            # 转换数据格式
            records = []
            if cloud_job_groups.list:
                for job_group in cloud_job_groups.list:
                    if job_group.script_id == os.getenv('SCRIPT_ID'):
                        # 转换状态
                        status_map = {
                            "Succeeded": 3,  # 已完成
                            "Failed": 5,     # 已失败
                            "Paused": 4,     # 已暂停
                            "Running": 2,    # 执行中
                            "Waiting": 1     # 已创建
                        }
                    
                        record = {
                            "job_group_id": job_group.job_group_id,
                            "job_group_name": job_group.job_group_name,
                            "description": job_group.job_group_description or "",
                            "status": status_map.get(job_group.status, 1),
                            "status_text": job_group.status,
                            "creation_time": job_group.creation_time,
                            "script_id": job_group.script_id,
                            "script_name": job_group.script_name
                        }
                        
                        records.append(record)
            
            return {
                "status": "success",
                "code": 1000,
                "message": "获取外呼任务列表成功",
                "data": {
                    "records": records,
                    "pagination": {
                        "page": page,
                        "page_size": page_size,
                        "total_count": len(records),
                        "total_pages": 1  # 阿里云API返回的是当前页数据
                    },
                    "source": "aliyun_cloud"
                }
            }
            
        except Exception as api_error:
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 3012,
                    "message": f"获取阿里云外呼任务组失败: {str(api_error)}"
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 3011,
                "message": f"获取外呼任务列表失败: {str(e)}"
            }
        )
