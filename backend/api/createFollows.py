from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from database.db import execute_update, execute_query
from .auth import verify_access_token

create_follows_router = APIRouter(tags=["跟进管理"])

class CreateFollowRequest(BaseModel):
    clues_id: int = Field(..., description="线索ID", example=1)
    follow_type: int = Field(..., description="跟进类型：1=手动跟进；2=AI电话跟进", example=1)
    next_follow_time: Optional[datetime] = Field(None, description="下次跟进时间", example="2024-01-15 10:00:00")
    plan_visit_time: Optional[datetime] = Field(None, description="计划到店时间", example="2024-01-20 14:00:00")
    remark: Optional[str] = Field(None, description="备注", max_length=500, example="客户对产品很感兴趣，需要进一步沟通")
    
    # 跟进记录中的线索信息字段（新增）
    product: Optional[str] = Field(None, description="意向产品（保存到跟进记录中）", max_length=50, example="高端护肤套装")
    client_level: Optional[int] = Field(None, description="客户等级（保存到跟进记录中）：1=H级；2=A级；3=B级；4=C级；5=N级；6=O级；7=F级", example=3)
    clues_status: Optional[int] = Field(None, description="线索状态（保存到跟进记录中）：1=未跟进；2=跟进中；3=已成单；0=已战败", example=2)
    
    @validator('next_follow_time', 'plan_visit_time', pre=True)
    def empty_str_to_none(cls, v):
        """将空字符串转换为None"""
        if v == "" or v is None:
            return None
        return v
    
    @validator('remark', 'product', pre=True)
    def empty_str_remark_to_none(cls, v):
        """将空字符串的备注和产品转换为None"""
        if v == "":
            return None
        return v
    
    @validator('client_level')
    def validate_client_level(cls, v):
        """验证客户等级范围"""
        if v is not None and v not in [1, 2, 3, 4, 5, 6, 7]:
            raise ValueError('客户等级必须在1-7之间：1=H级；2=A级；3=B级；4=C级；5=N级；6=O级；7=F级')
        return v
    
    @validator('clues_status')
    def validate_clues_status(cls, v):
        """验证线索状态范围"""
        if v is not None and v not in [0, 1, 2, 3]:
            raise ValueError('线索状态必须在0-3之间：0=已战败；1=未跟进；2=跟进中；3=已成单')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "clues_id": 1,
                "follow_type": 1,
                "next_follow_time": "2024-01-15 10:00:00",
                "plan_visit_time": "2024-01-20 14:00:00",
                "remark": "客户对产品很感兴趣，需要进一步沟通",
                "product": "高端护肤套装",
                "client_level": 3,
                "clues_status": 2
            }
        }

class FollowResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

@create_follows_router.post("/create_follow", 
                           response_model=FollowResponse,
                           summary="创建跟进记录",
                           description="创建新的跟进记录，跟进时间自动设置为当前时间，跟进人从access-token中获取。支持在跟进记录中保存线索状态、客户等级、产品信息。需要在请求头中提供access-token进行身份验证。",
                           tags=["跟进管理"])
async def create_follow(request: CreateFollowRequest, token: dict = Depends(verify_access_token)):
    """
    创建跟进记录并更新线索信息
    
    ## 跟进记录基本字段：
    - **clues_id**: 线索ID（必填，必须存在于线索表中）
    - **follow_type**: 跟进类型（必填）
      - 1: 手动跟进
      - 2: AI电话跟进
    - **next_follow_time**: 下次跟进时间（可选）
    - **plan_visit_time**: 计划到店时间（可选）
    - **remark**: 备注（可选，最大500字符）
    
    ## 跟进记录中的线索信息字段（新增，可选）：
    这些字段会同时保存到跟进记录中，用于记录跟进时的线索状态：
    - **product**: 意向产品（可选，最大50字符）
    - **client_level**: 客户等级（可选）
      - 1: H级（高价值客户）
      - 2: A级（重要客户）
      - 3: B级（一般客户）
      - 4: C级（低价值客户）
      - 5: N级（新客户）
      - 6: O级（其他）
      - 7: F级（失效客户）
    - **clues_status**: 线索状态（可选）
      - 0: 已战败
      - 1: 未跟进
      - 2: 跟进中
      - 3: 已成单
    
    ## 系统自动设置字段：
    - **follow_time**: 当前时间
    - **follower**: 从access-token中获取的用户ID
    
    ## 返回信息：
    返回创建成功的跟进记录信息，包含所有字段的详细信息。
    
    ## 注意事项：
    1. 跟进记录中的线索信息字段是独立保存的，不会直接更新线索表
    2. 这些字段用于记录跟进时刻的线索状态快照
    3. 在查询最新跟进记录时，会优先使用这些字段的值
    """
    try:
        # 验证线索ID是否存在
        clues_query = "SELECT id, client_name, phone, clues_status, product, client_level FROM clues WHERE id = %s"
        clues_result = execute_query(clues_query, (request.clues_id,))
        
        if not clues_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 2001,
                    "message": f"线索ID {request.clues_id} 不存在，请检查线索ID是否正确"
                }
            )
        
        clues_info = clues_result[0]
        
        # 从token中获取跟进人信息
        follower = str(token.get("user_id"))  # 使用用户ID作为跟进人
        if not follower or follower == "None":
            # 如果没有user_id，尝试使用username或phone
            follower = token.get("username") or token.get("phone") or "未知用户"
        
        # 设置跟进时间为当前时间
        follow_time = datetime.now()
        
        # 确保follows表存在并具有正确的结构
        try:
            # 检查表是否存在
            check_table_exists = "SHOW TABLES LIKE 'follows'"
            table_exists = execute_query(check_table_exists)
            
            if not table_exists:
                # 表不存在，创建新表
                # 在 create_table_query 中添加缺失的字段
                create_table_query = '''
                CREATE TABLE follows (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    clues_id INT NOT NULL COMMENT '线索ID',
                    follow_type INT NOT NULL COMMENT '跟进类型：1:手动跟进；2:AI电话跟进',
                    follow_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '跟进时间',
                    follower VARCHAR(20) COMMENT '跟进人',
                    next_follow_time DATETIME NULL COMMENT '下次跟进时间',
                    plan_visit_time DATETIME NULL COMMENT '计划到店时间',
                    remark VARCHAR(500) COMMENT '备注',
                    clues_status INT COMMENT '线索状态快照：1:未跟进；2:跟进中；3:已成单；0:已战败',
                    client_level INT COMMENT '客户等级快照：1:H级；2:A级；3:B级；4:C级；5:N级；6:O级；7:F级',
                    product VARCHAR(50) COMMENT '意向产品快照',
                    INDEX idx_clues_id (clues_id),
                    INDEX idx_follow_time (follow_time),
                    INDEX idx_next_follow_time (next_follow_time),
                    INDEX idx_clues_status (clues_status),
                    INDEX idx_client_level (client_level)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索跟进表'
                '''
                execute_update(create_table_query)
            else:
                # 表存在，检查是否有follow_time字段
                try:
                    check_column_query = "SHOW COLUMNS FROM follows LIKE 'follow_time'"
                    column_exists = execute_query(check_column_query)
                    
                    if not column_exists:
                        # 添加缺失的follow_time字段
                        add_column_query = "ALTER TABLE follows ADD COLUMN follow_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '跟进时间' AFTER follow_type"
                        execute_update(add_column_query)
                        
                        # 添加索引
                        add_index_query = "ALTER TABLE follows ADD INDEX idx_follow_time (follow_time)"
                        execute_update(add_index_query)
                        
                except Exception as alter_error:
                    print(f"修改表结构时出错: {alter_error}")
                    
        except Exception as table_error:
            print(f"处理表结构时出错: {table_error}")
            raise Exception(f"数据库表结构处理失败: {table_error}")
        
        # 插入跟进记录 - 修改插入语句包含新字段
        insert_query = '''
        INSERT INTO follows (clues_id, follow_type, follow_time, follower, next_follow_time, plan_visit_time, remark, clues_status, client_level, product)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        # 准备参数 - 添加新字段参数
        params = (
            request.clues_id,
            request.follow_type,
            follow_time,
            follower,
            request.next_follow_time,
            request.plan_visit_time,
            request.remark,
            request.clues_status,  # 新增
            request.client_level,  # 新增
            request.product        # 新增
        )
        
        # 执行插入
        affected_rows = execute_update(insert_query, params)
        
        if affected_rows == 0:
            raise Exception("跟进记录创建失败，请检查数据是否正确")
        
        # 获取插入的ID
        result = execute_query("SELECT LAST_INSERT_ID() as id")
        follow_id = result[0]['id'] if result else None
        
        # 更新线索信息
        update_fields = []
        update_params = []
        
        # 如果提供了意向产品，更新产品信息
        if request.product is not None:
            update_fields.append("product = %s")
            update_params.append(request.product)
        
        # 如果提供了客户等级，更新等级信息
        if request.client_level is not None:
            update_fields.append("client_level = %s")
            update_params.append(request.client_level)
        
        # 如果提供了线索状态，更新状态信息
        if request.clues_status is not None:
            update_fields.append("clues_status = %s")
            update_params.append(request.clues_status)
        else:
            # 如果没有明确指定状态，且当前状态是"未跟进"，则自动更新为"跟进中"
            if clues_info['clues_status'] == 1:  # 1=未跟进
                update_fields.append("clues_status = %s")
                update_params.append(2)  # 2=跟进中
        
        # 执行线索信息更新
        if update_fields:
            update_clues_query = f"UPDATE clues SET {', '.join(update_fields)}, update_time = CURRENT_TIMESTAMP WHERE id = %s"
            update_params.append(request.clues_id)
            execute_update(update_clues_query, update_params)
        
        # 重新查询更新后的线索信息
        updated_clues_query = "SELECT id, client_name, phone, clues_status, product, client_level FROM clues WHERE id = %s"
        updated_clues_result = execute_query(updated_clues_query, (request.clues_id,))
        updated_clues_info = updated_clues_result[0] if updated_clues_result else clues_info
        
        # 状态和等级的中文映射
        status_map = {0: "已战败", 1: "未跟进", 2: "跟进中", 3: "已成单"}
        level_map = {1: "H级", 2: "A级", 3: "B级", 4: "C级", 5: "N级", 6: "O级", 7: "F级"}
        
        return FollowResponse(
            status="success",
            code=2000,
            message="跟进记录创建成功，线索信息已更新",
            data={
                "跟进记录ID": follow_id,
                "线索ID": request.clues_id,
                "跟进信息": {
                    "跟进类型": "手动跟进" if request.follow_type == 1 else "AI电话跟进",
                    "跟进时间": follow_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "跟进人": follower,
                    "下次跟进时间": request.next_follow_time.strftime("%Y-%m-%d %H:%M:%S") if request.next_follow_time else None,
                    "计划到店时间": request.plan_visit_time.strftime("%Y-%m-%d %H:%M:%S") if request.plan_visit_time else None,
                    "备注": request.remark
                },
                "线索信息": {
                    "客户姓名": updated_clues_info['client_name'],
                    "手机号": updated_clues_info['phone'],
                    "意向产品": updated_clues_info['product'],
                    "客户等级": level_map.get(updated_clues_info['client_level'], f"未知等级({updated_clues_info['client_level']})"),
                    "线索状态": status_map.get(updated_clues_info['clues_status'], f"未知状态({updated_clues_info['clues_status']})")
                },
                "更新内容": {
                    "意向产品": "已更新" if request.product is not None else "未更新",
                    "客户等级": "已更新" if request.client_level is not None else "未更新", 
                    "线索状态": "已更新" if request.clues_status is not None or (clues_info['clues_status'] == 1 and not request.clues_status) else "未更新"
                }
            }
        )
        
    except HTTPException:
        raise
        
        # 检查并添加新字段
        new_fields = [
        ('clues_status', 'INT COMMENT "线索状态快照"'),
        ('client_level', 'INT COMMENT "客户等级快照"'),
        ('product', 'VARCHAR(50) COMMENT "意向产品快照"')
        ]
        
        for field_name, field_definition in new_fields:
            check_field_query = f"SHOW COLUMNS FROM follows LIKE '{field_name}'"
            field_exists = execute_query(check_field_query)
            
            if not field_exists:
                add_field_query = f"ALTER TABLE follows ADD COLUMN {field_name} {field_definition}"
                execute_update(add_field_query)

@create_follows_router.get("/follows/{clues_id}",
                          response_model=FollowResponse,
                          summary="查询线索跟进记录",
                          description="根据线索ID查询该线索的所有跟进记录。需要在请求头中提供access-token进行身份验证。",
                          tags=["跟进管理"])
async def get_follows_by_clues_id(clues_id: int, token: dict = Depends(verify_access_token)):
    """
    查询线索跟进记录
    
    - **clues_id**: 线索ID
    
    返回该线索的所有跟进记录，按跟进时间倒序排列。
    """
    try:
        # 验证线索是否存在
        clues_query = "SELECT id, client_name, phone FROM clues WHERE id = %s"
        clues_result = execute_query(clues_query, (clues_id,))
        
        if not clues_result:
            raise HTTPException(
                status_code=404,
                detail={
                    "status": "error",
                    "code": 2003,
                    "message": f"线索ID {clues_id} 不存在，请检查线索ID是否正确"
                }
            )
        
        clues_info = clues_result[0]
        
        # 查询跟进记录 - 关联用户表获取username
        follows_query = '''
        SELECT f.id, f.clues_id, f.follow_type, f.follow_time, 
               f.follower as follower_id, u.username as follower_name,
               f.next_follow_time, f.plan_visit_time, f.remark,
               f.clues_status, f.client_level, f.product
        FROM follows f
        LEFT JOIN users u ON f.follower = u.id
        WHERE f.clues_id = %s 
        ORDER BY f.follow_time DESC
        '''
        
        follows = execute_query(follows_query, (clues_id,))
        
        # 格式化时间字段
        for follow in follows:
            if follow['follow_time']:
                follow['follow_time'] = follow['follow_time'].strftime("%Y-%m-%d %H:%M:%S")
            if follow['next_follow_time']:
                follow['next_follow_time'] = follow['next_follow_time'].strftime("%Y-%m-%d %H:%M:%S")
            if follow['plan_visit_time']:
                follow['plan_visit_time'] = follow['plan_visit_time'].strftime("%Y-%m-%d %H:%M:%S")
            # 如果没有找到用户名，使用ID作为备用显示
            if not follow['follower_name']:
                follow['follower_name'] = f"用户{follow['follower_id']}"
        
        return FollowResponse(
            status="success",
            code=2000,
            message=f"找到 {len(follows)} 条跟进记录",
            data={
                "线索信息": {
                    "线索ID": clues_info['id'],
                    "客户姓名": clues_info['client_name'],
                    "手机号": clues_info['phone']
                },
                "跟进记录": follows,
                "记录总数": len(follows)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2002,
                "message": f"查询跟进记录失败：{str(e)}"
            }
        )

@create_follows_router.get("/follows",
                          response_model=FollowResponse,
                          summary="查询所有跟进记录",
                          description="查询所有跟进记录，支持按跟进人筛选。需要在请求头中提供access-token进行身份验证。",
                          tags=["跟进管理"])
async def get_all_follows(
    follower: Optional[str] = None,
    follow_type: Optional[int] = None,
    page: int = 1,
    page_size: int = 10,
    token: dict = Depends(verify_access_token)
):
    """
    查询所有跟进记录
    
    支持的查询条件：
    - **follower**: 跟进人筛选
    - **follow_type**: 跟进类型筛选 (1=手动跟进，2=AI电话跟进)
    - **page**: 页码 (默认1)
    - **page_size**: 每页数量 (默认10)
    
    返回分页的跟进记录列表，包含关联的线索信息。
    """
    try:
        # 构建查询条件 - 关联用户表获取username
        base_query = '''
        SELECT f.id, f.clues_id, f.follow_type, f.follow_time, 
               f.follower as follower_id, u.username as follower_name,
               f.next_follow_time, f.plan_visit_time, f.remark,
               f.clues_status, f.client_level, f.product,
               c.client_name, c.phone, c.source, c.product as clues_product
        FROM follows f
        LEFT JOIN clues c ON f.clues_id = c.id
        LEFT JOIN users u ON f.follower = u.id
        WHERE 1=1
        '''
        count_query = "SELECT COUNT(*) as total FROM follows f LEFT JOIN users u ON f.follower = u.id WHERE 1=1"
        params = []
        
        if follower:
            # 支持按用户名或用户ID筛选
            base_query += " AND (u.username = %s OR f.follower = %s)"
            count_query += " AND (u.username = %s OR f.follower = %s)"
            params.extend([follower, follower])
        
        if follow_type is not None:
            base_query += " AND f.follow_type = %s"
            count_query += " AND f.follow_type = %s"
            params.append(follow_type)
        
        # 获取总数
        total_result = execute_query(count_query, params)
        total_count = total_result[0]['total'] if total_result else 0
        
        # 添加排序和分页
        base_query += " ORDER BY f.follow_time DESC"
        
        # 计算偏移量
        offset = (page - 1) * page_size
        base_query += f" LIMIT {page_size} OFFSET {offset}"
        
        # 执行查询
        follows = execute_query(base_query, params)
        
        # 格式化时间字段
        for follow in follows:
            if follow['follow_time']:
                follow['follow_time'] = follow['follow_time'].strftime("%Y-%m-%d %H:%M:%S")
            if follow['next_follow_time']:
                follow['next_follow_time'] = follow['next_follow_time'].strftime("%Y-%m-%d %H:%M:%S")
            if follow['plan_visit_time']:
                follow['plan_visit_time'] = follow['plan_visit_time'].strftime("%Y-%m-%d %H:%M:%S")
        # 计算分页信息
        total_pages = (total_count + page_size - 1) // page_size
        
        return FollowResponse(
            status="success",
            code=2000,
            message=f"第 {page} 页找到 {len(follows)} 条跟进记录",
            data={
                "跟进记录": follows,
                "分页信息": {
                    "当前页": page,
                    "每页数量": page_size,
                    "总记录数": total_count,
                    "总页数": total_pages,
                    "有下一页": page < total_pages,
                    "有上一页": page > 1
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 2002,
                "message": f"查询跟进记录失败：{str(e)}"
            }
        )

class FollowDetailResponse(BaseModel):
    """跟进记录详细信息响应模型"""
    follow_id: int = Field(..., description="跟进记录ID")
    clues_id: int = Field(..., description="线索ID")
    follow_type: int = Field(..., description="跟进类型：1=手动跟进；2=AI电话跟进")
    follow_time: str = Field(..., description="跟进时间")
    follower_id: str = Field(..., description="跟进人ID")
    follower_name: Optional[str] = Field(None, description="跟进人姓名")
    next_follow_time: Optional[str] = Field(None, description="下次跟进时间")
    plan_visit_time: Optional[str] = Field(None, description="计划到店时间")
    remark: Optional[str] = Field(None, description="备注")
    clues_status: Optional[int] = Field(None, description="线索状态：0=已战败；1=未跟进；2=跟进中；3=已成单")
    client_level: Optional[int] = Field(None, description="客户等级：1=H级；2=A级；3=B级；4=C级；5=N级；6=O级；7=F级")
    product: Optional[str] = Field(None, description="意向产品")

class LeadInfoResponse(BaseModel):
    """线索信息响应模型"""
    id: int = Field(..., description="线索ID")
    client_name: str = Field(..., description="客户姓名")
    phone: str = Field(..., description="手机号")
    source: str = Field(..., description="线索来源")
    product: str = Field(..., description="意向产品（优先使用最新跟进记录中的值）")
    clues_status: int = Field(..., description="线索状态（优先使用最新跟进记录中的值）")
    clues_status_text: str = Field(..., description="线索状态文本")
    client_level: int = Field(..., description="客户等级（优先使用最新跟进记录中的值）")
    client_level_text: str = Field(..., description="客户等级文本")