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
    script_id: str = Field(..., description="场景ID（脚本ID）", example="script_123")
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
                "script_id": "script_123"
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
    - **script_id**: 场景ID（脚本ID）（必填）- 阿里云外呼API要求必须提供有效的脚本ID
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
        
        # 验证场景ID（脚本ID）是否提供
        if not request.script_id or not request.script_id.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 3006,
                    "message": "场景ID（脚本ID）不能为空，阿里云外呼API要求必须提供有效的脚本ID"
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
        lead_ids_str = ','.join([f"'{lead_id}'" for lead_id in request.lead_ids])
        lead_check_query = f"""
            SELECT id, leads_id, leads_user_name, leads_user_phone, organization_id, leads_create_time 
            FROM dcc_leads 
            WHERE leads_id IN ({lead_ids_str})
        """
        existing_leads = execute_query(lead_check_query)
        existing_lead_ids = [lead['leads_id'] for lead in existing_leads]
        
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
        valid_leads = [lead for lead in existing_leads if lead['leads_user_phone']]
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
                JobGroupSample(),
                [],
                job_group_name=request.job_group_name,
                job_group_description=request.job_group_description,
                StrategyJson=request.strategy_json,
                script_id=request.script_id,
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
                        "phoneNumber": lead['leads_user_phone'],
                        "name": lead['leads_user_name'],  # 使用leads_user_name字段
                        "referenceId": f"lead_{lead['leads_id']}",
                        "role": "客户",
                        "honorific": lead['leads_user_name']  # 可以根据需要设置称谓
                    }]
                }
                jobs_json.append(json.dumps(jobs_data))
            
            # 调用阿里云API分配外呼任务
            jobs_response = AssignJobsSample.main(
                [],
                job_group_id=job_group_id,
                jobs_json=jobs_json
            )
            
            # 保存外呼任务记录到数据库
            insert_query = """
                INSERT INTO outbound_calls (job_group_id, job_group_name, description, script_id,
                                         strategy_json, lead_ids, status, created_time, creator)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            strategy_json_str = json.dumps(request.strategy_json) if request.strategy_json else None
            lead_ids_str = json.dumps(request.lead_ids)
            
            # 获取创建者信息（从token中解析或使用默认值）
            creator = "system"  # 这里可以从token中解析用户信息
            
            # 添加调试信息
            print(f"准备插入数据库，参数：")
            print(f"job_group_id: {job_group_id}")
            print(f"job_group_name: {job_group_name}")
            print(f"description: {request.job_group_description}")
            print(f"script_id: {request.script_id}")
            print(f"strategy_json_str: {strategy_json_str}")
            print(f"lead_ids_str: {lead_ids_str}")
            print(f"created_time: {created_time}")
            print(f"creator: {creator}")
            
            try:
                execute_update(insert_query, (
                    job_group_id,
                    job_group_name,
                    request.job_group_description,
                    request.script_id,
                    strategy_json_str,
                    lead_ids_str,
                    1,  # 状态：1=已创建
                    created_time,
                    creator
                ))
                print("数据库插入成功")
            except Exception as db_error:
                print(f"数据库插入失败: {str(db_error)}")
                raise HTTPException(
                    status_code=500,
                    detail={
                        "status": "error",
                        "code": 3008,
                        "message": f"数据库插入失败: {str(db_error)}"
                    }
                )
            
            # 更新线索状态为外呼中
            lead_ids_for_update = ','.join([f"'{lead_id}'" for lead_id in request.lead_ids])
            update_leads_query = f"""
                UPDATE dcc_leads 
                SET leads_status = 2, update_time = NOW() 
                WHERE leads_id IN ({lead_ids_for_update})
            """
            try:
                execute_update(update_leads_query)
                print("线索状态更新成功")
            except Exception as update_error:
                print(f"线索状态更新失败: {str(update_error)}")
                # 这里不抛出异常，因为主要的外呼任务已经创建成功
            
            # 同步外呼任务数据到统计表和记录表
            try:
                print("开始同步外呼任务数据...")
                await sync_outbound_call_data([job_group_id])
                print("外呼任务数据同步完成")
            except Exception as sync_error:
                print(f"外呼任务数据同步失败: {str(sync_error)}")
                # 这里不抛出异常，因为主要的外呼任务已经创建成功
            
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
            error_message = str(api_error)
            print(f"API Error: {error_message}")
            print(f"Error type: {type(api_error)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            
            # 检查是否是阿里云API的特定错误
            if "ParameterNull.ScenarioIdOrScriptId" in error_message:
                error_detail = "阿里云外呼API错误：缺少场景ID或脚本ID参数。请确保提供有效的script_id。"
            elif "ParameterNull" in error_message:
                error_detail = f"阿里云外呼API参数错误：{error_message}"
            elif "NameResolutionError" in error_message or "Failed to resolve" in error_message:
                error_detail = "网络连接错误：无法连接到阿里云外呼服务。请检查网络连接或稍后重试。"
            else:
                error_detail = f"外呼API调用失败：{error_message}"
            
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 3006,
                    "message": error_detail,
                    "original_error": error_message
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
        jobs_response = None
        try:
            jobs_response = ListJobsSample.main(
                args=[],
                job_id=request.job_ids
            )
            
            # 添加调试信息
            print(f"API Response type: {type(jobs_response)}")
            if jobs_response:
                print(f"Number of jobs: {len(jobs_response)}")
                print(f"First job type: {type(jobs_response[0])}")
        except Exception as api_error:
            error_message = str(api_error)
            print(f"API Error: {error_message}")
            print(f"Error type: {type(api_error)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            
            # 检查是否是网络连接错误
            if "NameResolutionError" in error_message or "Failed to resolve" in error_message:
                error_detail = "网络连接错误：无法连接到阿里云外呼服务。请检查网络连接或稍后重试。"
            else:
                error_detail = f"查询外呼任务失败：{error_message}"
            
            raise HTTPException(
                status_code=500,
                detail={
                    "status": "error",
                    "code": 3009,
                    "message": error_detail,
                    "original_error": error_message
                }
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
        if jobs_response:
            for job in jobs_response:
                try:
                    # 查找对应的数据库记录
                    job_group_id = job.get('JobGroupId') if isinstance(job, dict) else getattr(job, 'JobGroupId', None)
                    db_record = next((record for record in db_records if record['job_group_id'] == job_group_id), None)
                    
                    # 确保db_record是可序列化的
                    if db_record:
                        # 将datetime对象转换为字符串
                        serializable_db_record = {}
                        for key, value in db_record.items():
                            if hasattr(value, 'isoformat'):  # datetime对象
                                serializable_db_record[key] = value.isoformat()
                            else:
                                serializable_db_record[key] = value
                        db_record = serializable_db_record
                    
                    # 安全地获取job属性
                    if isinstance(job, dict):
                        job_info = {
                            "job_id": job.get('JobId'),
                            "job_group_id": job.get('JobGroupId'),
                            "status": job.get('Status'),
                            "priority": job.get('Priority'),
                            "failure_reason": job.get('FailureReason'),
                            "result": job.get('Result'),
                            "created_time": job.get('CreatedTime'),
                            "modified_time": job.get('ModifiedTime'),
                            "db_record": db_record
                        }
                    else:
                        # 如果是对象，使用getattr并转换为可序列化的格式
                        job_info = {
                            "job_id": getattr(job, 'JobId', None),
                            "job_group_id": getattr(job, 'JobGroupId', None),
                            "status": getattr(job, 'Status', None),
                            "priority": getattr(job, 'Priority', None),
                            "failure_reason": getattr(job, 'FailureReason', None),
                            "result": getattr(job, 'Result', None),
                            "created_time": getattr(job, 'CreatedTime', None),
                            "modified_time": getattr(job, 'ModifiedTime', None),
                            "db_record": db_record
                        }
                        
                        # 尝试将阿里云对象转换为字典
                        try:
                            if hasattr(job, 'to_map'):
                                raw_data = job.to_map()
                            elif hasattr(job, '__dict__'):
                                raw_data = {k: v for k, v in job.__dict__.items() if not k.startswith('_')}
                            else:
                                raw_data = str(job)
                            job_info["raw_data"] = raw_data
                        except Exception as e:
                            job_info["raw_data"] = f"无法序列化对象: {str(e)}"
                    jobs_data.append(job_info)
                except Exception as job_error:
                    print(f"Error processing job: {job_error}")
                    # 继续处理下一个job
                    continue
        
        return {
            "status": "success",
            "code": 1000,
            "message": "查询外呼任务成功",
            "data": {
                "jobs": jobs_data,
                "total_count": len(jobs_data)
            }
        }
            
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
                     description="获取阿里云外呼任务组列表，支持分页和筛选，并同步更新统计数据",
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
    
    获取阿里云外呼任务组列表数据，并同步更新 outbound_call_stats 和 outbound_call_records 表。
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
            job_group_ids = []
            
            if cloud_job_groups.list:
                for job_group in cloud_job_groups.list:
                    # 移除script_id过滤条件，获取所有任务组
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
                        "script_id": getattr(job_group, 'script_id', None),
                        "script_name": getattr(job_group, 'script_name', None)
                    }
                    
                    records.append(record)
                    job_group_ids.append(job_group.job_group_id)
            
            # 同步更新数据库中的外呼任务记录
            if job_group_ids:
                await sync_outbound_call_data(job_group_ids)
            
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
                    "source": "aliyun_cloud",
                    "synced_job_groups": len(job_group_ids)
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

async def sync_outbound_call_data(job_group_ids: List[str]):
    """
    同步外呼任务数据到数据库
    
    Args:
        job_group_ids: 外呼任务组ID列表
    """
    try:
        for job_group_id in job_group_ids:
            # 1. 获取任务组下的所有任务详情
            try:
                # 首先从数据库获取该任务组下的所有任务ID
                db_jobs_query = """
                    SELECT job_id FROM outbound_call_records 
                    WHERE job_group_id = %s
                """
                existing_jobs = execute_query(db_jobs_query, (job_group_id,))
                
                if existing_jobs:
                    # 使用现有的任务ID列表
                    job_ids = [job['job_id'] for job in existing_jobs]
                else:
                    # 如果没有现有记录，尝试使用任务组ID作为单个任务ID
                    # 这是阿里云API的常见模式，任务组ID可能也是任务ID
                    print(f"任务组 {job_group_id} 没有现有记录，使用任务组ID作为任务ID")
                    job_ids = [job_group_id]
                
                jobs_response = ListJobsSample.main(
                    args=[],
                    job_id=job_ids
                )
                
                if jobs_response:
                    # 2. 更新或插入 outbound_call_stats
                    await update_outbound_call_stats(job_group_id, jobs_response)
                    
                    # 3. 更新或插入 outbound_call_records
                    await update_outbound_call_records(job_group_id, jobs_response)
                    
            except Exception as job_error:
                print(f"同步任务组 {job_group_id} 数据失败: {str(job_error)}")
                continue
                
    except Exception as e:
        print(f"同步外呼任务数据失败: {str(e)}")

async def update_outbound_call_stats(job_group_id: str, jobs_data: List):
    """
    更新外呼任务统计表
    
    Args:
        job_group_id: 外呼任务组ID
        jobs_data: 任务数据列表
    """
    try:
        # 统计各项数据
        total_calls = 0
        answered_calls = 0
        failed_calls = 0
        busy_calls = 0
        no_answer_calls = 0
        total_duration = 0
        
        print(f"开始处理任务组 {job_group_id} 的统计数据")
        print(f"任务数据数量: {len(jobs_data)}")
        
        for job in jobs_data:
            # 阿里云API返回的是对象，需要正确获取属性
            job_id = getattr(job, 'JobId', None)
            print(f"处理任务: {job_id}")
            
            # 获取任务中的Tasks数组
            tasks = getattr(job, 'Tasks', []) if hasattr(job, 'Tasks') else []
            print(f"任务中的Tasks数量: {len(tasks)}")
            
            # 如果没有Tasks，尝试从job.body.Jobs[0]中获取
            if not tasks and hasattr(job, 'body') and hasattr(job.body, 'Jobs'):
                jobs = getattr(job.body, 'Jobs', [])
                if jobs and len(jobs) > 0:
                    first_job = jobs[0]
                    tasks = getattr(first_job, 'Tasks', []) if hasattr(first_job, 'Tasks') else []
                    print(f"从job.body.Jobs[0]中获取Tasks数量: {len(tasks)}")
            
            # 如果还是没有Tasks，尝试直接从job.body中获取
            if not tasks and hasattr(job, 'body'):
                # 检查job.body是否是字典类型
                if hasattr(job.body, 'Jobs'):
                    jobs = getattr(job.body, 'Jobs', [])
                    if jobs and len(jobs) > 0:
                        first_job = jobs[0]
                        if hasattr(first_job, 'Tasks'):
                            tasks = getattr(first_job, 'Tasks', [])
                            print(f"从job.body中获取Tasks数量: {len(tasks)}")
            
            # 如果还是没有Tasks，直接处理job.body.Jobs[0]
            if not tasks and hasattr(job, 'body') and hasattr(job.body, 'Jobs'):
                jobs = getattr(job.body, 'Jobs', [])
                if jobs and len(jobs) > 0:
                    first_job = jobs[0]
                    # 直接处理first_job作为任务
                    job_id = getattr(first_job, 'JobId', None)
                    print(f"直接处理first_job: {job_id}")
                    tasks = getattr(first_job, 'Tasks', []) if hasattr(first_job, 'Tasks') else []
                    print(f"从first_job中获取Tasks数量: {len(tasks)}")
            
            for task in tasks:
                total_calls += 1
                
                # 获取任务状态和结果
                task_status = getattr(task, 'Status', None) if hasattr(task, 'Status') else None
                task_duration = getattr(task, 'Duration', 0) if hasattr(task, 'Duration') else 0
                
                print(f"任务状态: {task_status}, 时长: {task_duration}")
                
                # 根据任务状态统计
                if task_status == "Connected":
                    answered_calls += 1
                    total_duration += task_duration
                elif task_status == "Failed":
                    failed_calls += 1
                elif task_status == "Busy":
                    busy_calls += 1
                elif task_status == "NoAnswer":
                    no_answer_calls += 1
                elif task_status == "NotConnected":
                    # 未接通的情况，可能是各种原因
                    failed_calls += 1
                else:
                    # 其他状态也计入失败
                    failed_calls += 1
        
        # 计算成功率
        success_rate = (answered_calls / total_calls * 100) if total_calls > 0 else 0
        avg_duration = (total_duration / answered_calls) if answered_calls > 0 else 0
        
        print(f"统计结果 - 任务组: {job_group_id}, 总通话: {total_calls}, 接通: {answered_calls}, 失败: {failed_calls}")
        
        # 检查是否已存在统计记录
        check_query = "SELECT id FROM outbound_call_stats WHERE job_group_id = %s"
        existing_record = execute_query(check_query, (job_group_id,))
        
        if existing_record:
            # 更新现有记录
            update_query = """
                UPDATE outbound_call_stats 
                SET total_calls = %s, answered_calls = %s, failed_calls = %s, 
                    busy_calls = %s, no_answer_calls = %s, total_duration = %s,
                    success_rate = %s, avg_duration = %s, updated_time = NOW()
                WHERE job_group_id = %s
            """
            execute_update(update_query, (
                total_calls, answered_calls, failed_calls, busy_calls, 
                no_answer_calls, total_duration, success_rate, avg_duration, job_group_id
            ))
            print(f"更新统计记录成功 - 任务组: {job_group_id}")
        else:
            # 插入新记录
            insert_query = """
                INSERT INTO outbound_call_stats 
                (job_group_id, total_calls, answered_calls, failed_calls, busy_calls, 
                 no_answer_calls, total_duration, success_rate, avg_duration)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            execute_update(insert_query, (
                job_group_id, total_calls, answered_calls, failed_calls, busy_calls,
                no_answer_calls, total_duration, success_rate, avg_duration
            ))
            print(f"插入统计记录成功 - 任务组: {job_group_id}")
            
    except Exception as e:
        print(f"更新外呼任务统计失败: {str(e)}")
        import traceback
        print(f"错误详情: {traceback.format_exc()}")

async def update_outbound_call_records(job_group_id: str, jobs_data: List):
    """
    更新外呼任务执行记录表
    
    Args:
        job_group_id: 外呼任务组ID
        jobs_data: 任务数据列表
    """
    try:
        print(f"开始处理任务组 {job_group_id} 的执行记录")
        print(f"任务数据数量: {len(jobs_data)}")
        
        for job in jobs_data:
            # 获取任务基本信息
            job_id = getattr(job, 'JobId', None) if hasattr(job, 'JobId') else None
            job_status = getattr(job, 'Status', None) if hasattr(job, 'Status') else None
            
            print(f"处理任务: {job_id}, 状态: {job_status}")
            
            # 从任务数据中提取联系人信息
            contacts = getattr(job, 'Contacts', []) if hasattr(job, 'Contacts') else []
            
            # 如果没有Contacts，尝试从job.body.Jobs[0]中获取
            if (not contacts or len(contacts) == 0) and hasattr(job, 'body') and hasattr(job.body, 'Jobs'):
                jobs = getattr(job.body, 'Jobs', [])
                if jobs and len(jobs) > 0:
                    first_job = jobs[0]
                    contacts = getattr(first_job, 'Contacts', []) if hasattr(first_job, 'Contacts') else []
                    print(f"从job.body.Jobs[0]中获取Contacts数量: {len(contacts)}")
            
            # 如果还是没有Contacts，尝试直接从job.body中获取
            if (not contacts or len(contacts) == 0) and hasattr(job, 'body'):
                if hasattr(job.body, 'Jobs'):
                    jobs = getattr(job.body, 'Jobs', [])
                    if jobs and len(jobs) > 0:
                        first_job = jobs[0]
                        if hasattr(first_job, 'Contacts'):
                            contacts = getattr(first_job, 'Contacts', [])
                            print(f"从job.body中获取Contacts数量: {len(contacts)}")
            
            # 如果还是没有Contacts，直接处理job.body.Jobs[0]
            if (not contacts or len(contacts) == 0) and hasattr(job, 'body') and hasattr(job.body, 'Jobs'):
                jobs = getattr(job.body, 'Jobs', [])
                if jobs and len(jobs) > 0:
                    first_job = jobs[0]
                    # 直接处理first_job作为任务
                    job_id = getattr(first_job, 'JobId', None)
                    job_status = getattr(first_job, 'Status', None)
                    print(f"直接处理first_job: {job_id}, 状态: {job_status}")
                    contacts = getattr(first_job, 'Contacts', []) if hasattr(first_job, 'Contacts') else []
                    print(f"从first_job中获取Contacts数量: {len(contacts)}")
            
            if not contacts or len(contacts) == 0:
                print(f"任务 {job_id} 没有联系人信息")
                continue
                
            contact = contacts[0] if isinstance(contacts, list) else contacts
            phone = getattr(contact, 'PhoneNumber', '') if hasattr(contact, 'PhoneNumber') else ''
            reference_id = getattr(contact, 'ReferenceId', '') if hasattr(contact, 'ReferenceId', '') else ''
            
            print(f"联系人信息: phone={phone}, reference_id={reference_id}")
            
            # 从reference_id中提取lead_id
            lead_id = None
            if reference_id and reference_id.startswith('lead_'):
                try:
                    lead_id = int(reference_id.replace('lead_', ''))
                except ValueError:
                    print(f"无法解析lead_id: {reference_id}")
                    continue
            
            if not lead_id or not phone:
                print(f"缺少lead_id或phone: lead_id={lead_id}, phone={phone}")
                continue
            
            # 获取任务中的Tasks数组
            tasks = getattr(job, 'Tasks', []) if hasattr(job, 'Tasks') else []
            print(f"任务 {job_id} 中的Tasks数量: {len(tasks)}")
            
            for task in tasks:
                # 获取任务详细信息
                task_id = getattr(task, 'TaskId', None) if hasattr(task, 'TaskId') else None
                task_status = getattr(task, 'Status', None) if hasattr(task, 'Status') else None
                task_duration = getattr(task, 'Duration', 0) if hasattr(task, 'Duration') else 0
                called_number = getattr(task, 'CalledNumber', '') if hasattr(task, 'CalledNumber') else ''
                calling_number = getattr(task, 'CallingNumber', '') if hasattr(task, 'CallingNumber') else ''
                actual_time = getattr(task, 'ActualTime', None) if hasattr(task, 'ActualTime') else None
                
                print(f"任务详情: task_id={task_id}, status={task_status}, duration={task_duration}")
                
                # 转换时间戳为datetime
                call_time = None
                if actual_time:
                    try:
                        call_time = datetime.fromtimestamp(actual_time / 1000)
                    except:
                        call_time = datetime.now()
                
                # 检查是否已存在记录
                check_query = "SELECT id FROM outbound_call_records WHERE job_id = %s AND lead_id = %s"
                existing_record = execute_query(check_query, (job_id, lead_id))
                
                if existing_record:
                    # 更新现有记录
                    update_query = """
                        UPDATE outbound_call_records 
                        SET call_status = %s, call_duration = %s, call_result = %s,
                            failure_reason = %s, call_time = %s, called_number = %s, calling_number = %s, task_id = %s
                        WHERE job_id = %s AND lead_id = %s
                    """
                    execute_update(update_query, (
                        task_status, task_duration, task_status, None, call_time,
                        called_number, calling_number, task_id, job_id, lead_id
                    ))
                    print(f"更新通话记录成功 - 任务: {job_id}, 线索: {lead_id}, 任务: {task_id}")
                else:
                    # 插入新记录
                    insert_query = """
                        INSERT INTO outbound_call_records 
                        (job_group_id, job_id, lead_id, phone, call_status, call_duration, 
                         call_result, failure_reason, call_time, task_id, called_number, calling_number)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    execute_update(insert_query, (
                        job_group_id, job_id, lead_id, phone, task_status, task_duration,
                        task_status, None, call_time, task_id, called_number, calling_number
                    ))
                    print(f"插入通话记录成功 - 任务: {job_id}, 线索: {lead_id}, 任务: {task_id}")
        
        # 检查任务完成状态并自动更新
        await check_and_update_task_completion(job_group_id)
                        
    except Exception as e:
        print(f"更新外呼任务执行记录失败: {str(e)}")
        import traceback
        print(f"错误详情: {traceback.format_exc()}")

async def check_and_update_task_completion(job_group_id: str):
    """
    检查任务完成状态并自动更新
    
    Args:
        job_group_id: 外呼任务组ID
    """
    try:
        print(f"开始检查任务组 {job_group_id} 的完成状态")
        
        # 查询该任务组关联的所有call_tasks
        task_query = """
            SELECT ct.id, ct.task_type, ct.organization_id
            FROM call_tasks ct
            JOIN leads_task_list ltl ON ct.id = ltl.task_id
            JOIN outbound_call_records ocr ON ltl.leads_id = ocr.lead_id
            WHERE ocr.job_group_id = %s
            GROUP BY ct.id
        """
        tasks = execute_query(task_query, (job_group_id,))
        
        if not tasks:
            print(f"任务组 {job_group_id} 没有关联的call_tasks")
            return
        
        for task in tasks:
            task_id = task['id']
            current_task_type = task['task_type']
            organization_id = task['organization_id']
            
            # 如果任务已经是完成状态，跳过
            if current_task_type == 3:
                print(f"任务 {task_id} 已经是完成状态，跳过检查")
                continue
            
            # 查询该任务的所有通话记录
            call_records_query = """
                SELECT ocr.call_status
                FROM outbound_call_records ocr
                JOIN leads_task_list ltl ON ocr.lead_id = ltl.leads_id
                WHERE ltl.task_id = %s
            """
            call_records = execute_query(call_records_query, (task_id,))
            
            if not call_records:
                print(f"任务 {task_id} 暂无通话记录")
                continue
            
            # 统计通话状态
            total_calls = len(call_records)
            connected_calls = 0
            
            for record in call_records:
                call_status = record.get('call_status')
                # 检查是否为已接通状态
                if call_status in ["Connected", "Succeeded", "SucceededFinish", "SucceededTransferByIntent"]:
                    connected_calls += 1
            
            print(f"任务 {task_id} 统计: 总通话 {total_calls}, 已接通 {connected_calls}")
            
            # 如果所有通话都是已接通状态，则更新任务为完成状态
            if total_calls > 0 and connected_calls == total_calls:
                update_query = """
                    UPDATE call_tasks 
                    SET task_type = 3 
                    WHERE id = %s AND organization_id = %s
                """
                execute_update(update_query, (task_id, organization_id))
                print(f"任务 {task_id} 已完成，所有通话都已接通，状态已更新为完成")
            else:
                print(f"任务 {task_id} 未完成，部分通话未接通")
                
    except Exception as e:
        print(f"检查任务完成状态失败: {str(e)}")
        import traceback
        print(f"错误详情: {traceback.format_exc()}")
