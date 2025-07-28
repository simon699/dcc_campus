from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Optional, Union, List
from datetime import datetime
from database.db import execute_update, execute_query
from .auth import verify_access_token

create_leads_router = APIRouter(tags=["线索管理"])

class CreateLeadRequest(BaseModel):
    organization_id: str = Field(..., description="组织ID", example="ORG001")
    client_name: str = Field(..., description="客户姓名", example="张三")
    phone: str = Field(..., description="手机号", example="13800138000")
    source: str = Field(..., description="线索来源", example="网络推广")
    product_id: int = Field(..., description="意向产品ID（产品分类表的ID）", example=1)
    
    class Config:
        schema_extra = {
            "example": {
                "organization_id": "ORG001",
                "client_name": "张三",
                "phone": "13800138000",
                "source": "网络推广",
                "product_id": 1
            }
        }

class LeadResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

class LeadQueryRequest(BaseModel):
    organization_id: Optional[str] = Field(None, description="组织ID筛选", example="ORG001")
    clues_status: Optional[Union[int, List[int]]] = Field(None, description="线索状态筛选：0=已战败，1=未跟进，2=跟进中，3=已成单", example=1)
    client_level: Optional[Union[int, List[int]]] = Field(None, description="客户等级筛选：1=H级，2=A级，3=B级，4=C级，5=N级，6=O级，7=F级", example=5)
    page: Optional[int] = Field(1, description="页码", example=1)
    page_size: Optional[int] = Field(10, description="每页数量", example=10)
    
    # 新增搜索条件
    phone: Optional[str] = Field(None, description="手机号搜索（模糊匹配）", example="138")
    product: Optional[str] = Field(None, description="产品名称搜索（模糊匹配）", example="Model S")
    create_time_start: Optional[str] = Field(None, description="创建时间开始（YYYY-MM-DD）", example="2024-01-01")
    create_time_end: Optional[str] = Field(None, description="创建时间结束（YYYY-MM-DD）", example="2024-12-31")
    last_follow_time_start: Optional[str] = Field(None, description="最新跟进时间开始（YYYY-MM-DD）", example="2024-01-01")
    last_follow_time_end: Optional[str] = Field(None, description="最新跟进时间结束（YYYY-MM-DD）", example="2024-12-31")
    next_follow_time_start: Optional[str] = Field(None, description="下次跟进时间开始（YYYY-MM-DD）", example="2024-01-01")
    next_follow_time_end: Optional[str] = Field(None, description="下次跟进时间结束（YYYY-MM-DD）", example="2024-12-31")
    ai_call: Optional[bool] = Field(None, description="是否AI外呼筛选", example=True)

class LeadLevelStatsRequest(BaseModel):
    clues_status: Optional[Union[int, List[int]]] = Field(None, description="线索状态筛选：0=已战败，1=未跟进，2=跟进中，3=已成单", example=1)
    create_time_start: Optional[str] = Field(None, description="创建时间开始（YYYY-MM-DD）", example="2024-01-01")
    create_time_end: Optional[str] = Field(None, description="创建时间结束（YYYY-MM-DD）", example="2024-12-31")
    last_follow_time_start: Optional[str] = Field(None, description="最新跟进时间开始（YYYY-MM-DD）", example="2024-01-01")
    last_follow_time_end: Optional[str] = Field(None, description="最新跟进时间结束（YYYY-MM-DD）", example="2024-12-31")
    next_follow_time_start: Optional[str] = Field(None, description="下次跟进时间开始（YYYY-MM-DD）", example="2024-01-01")
    next_follow_time_end: Optional[str] = Field(None, description="下次跟进时间结束（YYYY-MM-DD）", example="2024-12-31")
    ai_call: Optional[bool] = Field(None, description="是否AI外呼筛选", example=True)

class LeadLevelStatsResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

class DailyLeadsStatsRequest(BaseModel):
    start_date: str = Field(..., description="开始日期（YYYY-MM-DD）", example="2024-01-01")
    end_date: str = Field(..., description="结束日期（YYYY-MM-DD）", example="2024-01-07")
    clues_status: Optional[Union[int, List[int]]] = Field(None, description="线索状态筛选：0=已战败，1=未跟进，2=跟进中，3=已成单", example=1)

class DailyLeadsStatsResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

@create_leads_router.get("/test_db", tags=["线索管理"])
async def test_database_connection():
    """
    测试数据库连接和表结构
    """
    try:
        # 测试数据库连接
        result = execute_query("SELECT 1 as test")
        print(f"Database connection test: {result}")
        
        # 检查表是否存在
        table_check = execute_query("SHOW TABLES LIKE 'clues'")
        print(f"Table 'clues' exists: {len(table_check) > 0}")
        
        if len(table_check) > 0:
            # 检查表结构
            table_structure = execute_query("DESCRIBE clues")
            print(f"Table structure: {table_structure}")
            
            # 检查表中的数据
            count_result = execute_query("SELECT COUNT(*) as count FROM clues")
            print(f"Records in clues table: {count_result[0]['count']}")
            
            # 检查索引
            index_check = execute_query("SHOW INDEX FROM clues")
            print(f"Table indexes: {index_check}")
        
        return {
            "status": "success",
            "database_connected": True,
            "table_exists": len(table_check) > 0,
            "table_structure": table_structure if len(table_check) > 0 else None,
            "record_count": count_result[0]['count'] if len(table_check) > 0 else 0,
            "indexes": index_check if len(table_check) > 0 else None
        }
        
    except Exception as e:
        print(f"Database test error: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@create_leads_router.get("/fix_organization_id", tags=["线索管理"])
async def fix_organization_id_constraint(token: str = Depends(verify_access_token)):
    """
    修复 organization_id 唯一约束问题
    
    如果 organization_id 被错误地设置为唯一键，此接口将移除该约束，确保 organization_id 只是普通索引。
    """
    try:
        # 检查是否存在唯一约束
        check_query = """
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME = 'clues' 
        AND CONSTRAINT_TYPE = 'UNIQUE' 
        AND CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME LIKE '%organization_id%'?
        """
        
        constraint_result = execute_query(check_query)
        
        if constraint_result:
            constraint_name = constraint_result[0]['CONSTRAINT_NAME']
            # 删除唯一约束
            drop_query = f"ALTER TABLE clues DROP INDEX {constraint_name}"
            execute_update(drop_query)
            
            # 重新添加普通索引
            add_index_query = "ALTER TABLE clues ADD INDEX idx_organization_id (organization_id)"
            execute_update(add_index_query)
            
            return {
                "status": "success",
                "message": f"已移除 organization_id 的唯一约束 '{constraint_name}' 并添加普通索引",
                "fixed": True
            }
        else:
            # 检查是否存在普通索引
            index_query = """
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_NAME = 'clues' 
            AND COLUMN_NAME = 'organization_id' 
            AND TABLE_SCHEMA = DATABASE()
            """
            
            index_result = execute_query(index_query)
            
            if not index_result:
                # 添加普通索引
                add_index_query = "ALTER TABLE clues ADD INDEX idx_organization_id (organization_id)"
                execute_update(add_index_query)
                
                return {
                    "status": "success",
                    "message": "已为 organization_id 添加普通索引",
                    "fixed": True
                }
            else:
                return {
                    "status": "success",
                    "message": "organization_id 已经是普通索引，无需修复",
                    "fixed": False
                }
    
    except Exception as e:
        print(f"Fix organization_id error: {str(e)}")
        return {
            "status": "error",
            "message": f"修复 organization_id 约束失败: {str(e)}",
            "fixed": False
        }

@create_leads_router.post("/create_leads", 
                         response_model=LeadResponse,
                         summary="创建客户线索",
                         description="创建新的客户线索，系统会自动设置状态为'未跟进'，客户等级为'N级'。需要在请求头中提供access-token进行身份验证。",
                         tags=["线索管理"])
async def create_leads(request: CreateLeadRequest, token: str = Depends(verify_access_token)):
    """
    创建客户线索
    
    - **organization_id**: 组织ID（必填）
    - **client_name**: 客户姓名（必填）
    - **phone**: 手机号（必填，唯一）
    - **source**: 线索来源（必填）
    - **product_id**: 意向产品ID（必填，需要在产品分类表中存在）
    
    系统会自动设置：
    - **clues_status**: 1（未跟进）
    - **client_level**: 5（N级）
    - **create_time**: 当前时间
    - **create_name**: 创建人（从access-token中获取）
    
    返回创建成功的线索信息，包含自动生成的ID。
    """
    try:
        # 验证产品ID是否存在
        product_query = "SELECT id, name FROM product_category WHERE id = %s"
        product_result = execute_query(product_query, (request.product_id,))
        
        if not product_result:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": f"产品ID {request.product_id} 不存在"
                }
            )
        
        product_name = product_result[0]['name']
        
        # 检查手机号是否已存在（手机号应该是唯一的）
        phone_check_query = "SELECT id FROM clues WHERE phone = %s LIMIT 1"
        existing_phone = execute_query(phone_check_query, (request.phone,))
        if existing_phone:
            return LeadResponse(
                status="duplicate",
                code=1001,
                message="手机号码已存在",
                data={"existing_id": existing_phone[0]['id'], "phone": request.phone}
            )
        
        # 设置默认值
        clues_status = 1  # 默认未跟进
        client_level = 5  # 默认N级
        create_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 确保表存在（使用正确的结构）
        create_table_query = '''
        CREATE TABLE IF NOT EXISTS clues (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
            client_name VARCHAR(50) NOT NULL COMMENT '姓名',
            phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号（唯一）',
            source VARCHAR(50) NOT NULL COMMENT '线索来源',
            product VARCHAR(50) NOT NULL COMMENT '意向产品',
            create_name VARCHAR(50) NOT NULL COMMENT '创建人',
            clues_status INT NOT NULL DEFAULT 1 COMMENT '状态：1:未跟进；2:跟进中；3:已成单；0:已战败',
            client_level INT NOT NULL DEFAULT 5 COMMENT '客户等级：1:H级；2:A级；3:B级；4:C级；5:N级；6:O级；7:F级',
            create_time DATETIME NOT NULL COMMENT '创建时间',
            INDEX idx_organization_id (organization_id),
            INDEX idx_clues_status (clues_status),
            INDEX idx_client_level (client_level),
            INDEX idx_create_time (create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索信息表'
        '''
        execute_update(create_table_query)
        
        # 从token中获取创建人信息
        create_name = token.get("username") or token.get("user_id") or "未知用户"
        
        # 插入新线索
        insert_query = '''
        INSERT INTO clues (organization_id, client_name, phone, source, product, create_name, clues_status, client_level, create_time)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        
        # 打印调试信息
        print(f"Executing insert query: {insert_query}")
        print(f"Parameters: {(request.organization_id, request.client_name, request.phone, request.source, product_name, create_name, clues_status, client_level, create_time)}")
        
        try:
            affected_rows = execute_update(insert_query, (
                request.organization_id, 
                request.client_name, 
                request.phone, 
                request.source, 
                product_name,  # 存储产品名称而不是ID
                create_name,   # 添加创建人
                clues_status, 
                client_level, 
                create_time
            ))
            
            print(f"Affected rows: {affected_rows}")
            
            if affected_rows == 0:
                raise Exception("No rows were affected by the insert operation")
            
            # 获取插入的ID
            result = execute_query("SELECT LAST_INSERT_ID() as id")
            lead_id = result[0]['id'] if result else None
            print(f"Inserted lead ID: {lead_id}")
            
            # 验证数据是否真的插入了
            verify_query = "SELECT COUNT(*) as count FROM clues WHERE phone = %s"
            verify_result = execute_query(verify_query, (request.phone,))
            print(f"Verification count: {verify_result[0]['count']}")
            
        except Exception as insert_error:
            print(f"Insert error: {insert_error}")
            raise insert_error
        
        return LeadResponse(
            status="success",
            code=1000,
            message="线索创建成功",
            data={
                "id": lead_id,
                "organization_id": request.organization_id,
                "client_name": request.client_name,
                "phone": request.phone,
                "source": request.source,
                "product_id": request.product_id,
                "product_name": product_name,
                "create_name": create_name,
                "clues_status": clues_status,
                "client_level": client_level,
                "create_time": create_time
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": str(e)
            }
        )

@create_leads_router.get("/leads",
                       response_model=LeadResponse,
                       summary="查询线索列表",
                       description="根据条件查询客户线索列表。需要在请求头中提供access-token进行身份验证。",
                       tags=["线索管理"])
async def get_leads(
    organization_id: Optional[str] = None,
    clues_status: Optional[int] = None,
    client_level: Optional[int] = None,
    token: str = Depends(verify_access_token)
):
    """
    查询线索列表
    
    支持按以下条件筛选：
    - **organization_id**: 组织ID
    - **clues_status**: 线索状态
      - 0: 已战败
      - 1: 未跟进
      - 2: 跟进中  
      - 3: 已成单
    - **client_level**: 客户等级
      - 1: H级
      - 2: A级
      - 3: B级
      - 4: C级
      - 5: N级
      - 6: O级
      - 7: F级
    
    返回符合条件的线索列表，包含创建人(create_name)信息，按创建时间倒序排列。
    """
    try:
        base_query = "SELECT * FROM clues WHERE 1=1"
        params = []
        
        if organization_id:
            base_query += " AND organization_id = %s"
            params.append(organization_id)
        
        if clues_status is not None:
            base_query += " AND clues_status = %s"
            params.append(clues_status)
        
        if client_level is not None:
            base_query += " AND client_level = %s"
            params.append(client_level)
        
        base_query += " ORDER BY create_time DESC"
        
        leads = execute_query(base_query, params)
        
        return LeadResponse(
            status="success",
            code=1000,
            message=f"找到 {len(leads)} 条线索",
            data={"leads": leads}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": str(e)
            }
        )

@create_leads_router.post("/leads/query",
                         response_model=LeadResponse,
                         summary="查询线索列表(POST)",
                         description="使用POST方法查询线索列表，支持分页和复杂查询条件。需要在请求头中提供access-token进行身份验证。",
                         tags=["线索管理"])
async def query_leads(request: LeadQueryRequest, token: str = Depends(verify_access_token)):
    """
    查询线索列表 (POST方法)
    
    支持的查询条件：
    - **organization_id**: 组织ID
    - **clues_status**: 线索状态 (0=已战败，1=未跟进，2=跟进中，3=已成单)
    - **client_level**: 客户等级 (1=H级，2=A级，3=B级，4=C级，5=N级，6=O级，7=F级)
    - **page**: 页码 (默认1)
    - **page_size**: 每页数量 (默认10)
    
    返回分页的线索列表，包含创建人(create_name)信息。
    """
    try:
        # 构建查询条件
        base_query = "SELECT * FROM clues WHERE 1=1"
        count_query = "SELECT COUNT(*) as total FROM clues WHERE 1=1"
        params = []
        
        if request.organization_id:
            base_query += " AND organization_id = %s"
            count_query += " AND organization_id = %s"
            params.append(request.organization_id)
        
        if request.clues_status is not None:
            base_query += " AND clues_status = %s"
            count_query += " AND clues_status = %s"
            params.append(request.clues_status)
        
        if request.client_level is not None:
            base_query += " AND client_level = %s"
            count_query += " AND client_level = %s"
            params.append(request.client_level)
        
        # 添加其他查询条件
        # 在现有的查询条件基础上添加新条件（在 client_level 条件后添加）
        if request.phone:
            base_query += " AND c.phone LIKE %s"
            count_query += " AND c.phone LIKE %s"
            params.append(f"%{request.phone}%")
        
        if request.product:
            base_query += " AND (c.product LIKE %s OR pc.name LIKE %s)"
            count_query += " AND (c.product LIKE %s OR EXISTS (SELECT 1 FROM product_category pc2 WHERE pc2.id = c.product_id AND pc2.name LIKE %s))"
            params.extend([f"%{request.product}%", f"%{request.product}%"])
        
        # 修改时间筛选条件，使用完整的时间戳比较而不是 DATE() 函数
        if request.create_time_start:
            base_query += " AND c.create_time >= %s"
            count_query += " AND c.create_time >= %s"
            params.append(request.create_time_start)
        
        if request.create_time_end:
            base_query += " AND c.create_time <= %s"
            count_query += " AND c.create_time <= %s"
            params.append(request.create_time_end)
        
        if request.last_follow_time_start:
            base_query += " AND f.follow_time >= %s"
            count_query += " AND f.follow_time >= %s"
            params.append(request.last_follow_time_start)
        
        if request.last_follow_time_end:
            base_query += " AND f.follow_time <= %s"
            count_query += " AND f.follow_time <= %s"
            params.append(request.last_follow_time_end)
        
        if request.next_follow_time_start:
            base_query += " AND f.next_follow_time >= %s"
            count_query += " AND f.next_follow_time >= %s"
            params.append(request.next_follow_time_start)
        
        if request.next_follow_time_end:
            base_query += " AND f.next_follow_time <= %s"
            count_query += " AND f.next_follow_time <= %s"
            params.append(request.next_follow_time_end)
        
        if request.ai_call is not None:
            if request.ai_call:
                base_query += " AND f.follow_type = 2"
                count_query += " AND EXISTS (SELECT 1 FROM follows f2 WHERE f2.clues_id = c.id AND f2.follow_type = 2)"
            else:
                base_query += " AND (f.follow_type != 2 OR f.follow_type IS NULL)"
                count_query += " AND NOT EXISTS (SELECT 1 FROM follows f2 WHERE f2.clues_id = c.id AND f2.follow_type = 2)"
        
        # 获取总数
        total_result = execute_query(count_query, params)
        total_count = total_result[0]['total'] if total_result else 0
        
        # 添加排序和分页
        base_query += " ORDER BY c.create_time DESC"
        
        # 计算偏移量
        offset = (request.page - 1) * request.page_size
        base_query += f" LIMIT {request.page_size} OFFSET {offset}"
        
        # 执行查询
        leads = execute_query(base_query, params)
        
        # 计算分页信息
        total_pages = (total_count + request.page_size - 1) // request.page_size
        
        return LeadResponse(
            status="success",
            code=1000,
            message=f"第 {request.page} 页找到 {len(leads)} 条线索",
            data={
                "leads": leads,
                "pagination": {
                    "current_page": request.page,
                    "page_size": request.page_size,
                    "total_count": total_count,
                    "total_pages": total_pages,
                    "has_next": request.page < total_pages,
                    "has_prev": request.page > 1
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": str(e)
            }
        )

@create_leads_router.post("/leads/query_with_latest_follow",
                         response_model=LeadResponse,
                         summary="查询线索列表并合并最新跟进记录",
                         description="查询线索列表，并为每个线索合并其最新的跟进记录信息。如果最新跟进记录中包含线索状态、客户等级、产品信息，将优先使用跟进记录中的值。需要在请求头中提供access-token进行身份验证。",
                         tags=["线索管理"])
async def query_leads_with_latest_follow(request: LeadQueryRequest, token: str = Depends(verify_access_token)):
    try:
        # 从token中获取organization_id
        import jwt
        import os
        from datetime import datetime
        
        # 解析token获取organization_id
        try:
            payload = jwt.decode(token, os.getenv('JWT_SECRET', 'your-secret-key'), algorithms=['HS256'])
            organization_id = payload.get('organization_id')
        except:
            organization_id = None
        
        # 调试信息
        print(f"查询参数: {request}")
        print(f"Organization ID: {organization_id}")
        
        # 构建查询条件 - 修复字段名并添加新字段
        base_query = '''
        SELECT c.*,
               f.id as latest_follow_id,
               f.follow_type as latest_follow_type,
               f.follow_time as latest_follow_time,
               f.follower as latest_follower,
               u.username as latest_follower_name,
               f.next_follow_time as latest_next_follow_time,
               f.plan_visit_time as latest_plan_visit_time,
               f.remark as latest_follow_remark,
               -- 从最新跟进记录中获取的新字段
               f.clues_status as latest_follow_clues_status,
               f.client_level as latest_follow_client_level,
               f.product as latest_follow_product,
               pc.id as product_category_id,
               pc.name as product_category_name,
               pc.parent_id as product_parent_id
        FROM clues c
        LEFT JOIN (
            SELECT f1.*
            FROM follows f1
            INNER JOIN (
                SELECT clues_id, MAX(follow_time) as max_follow_time
                FROM follows
                GROUP BY clues_id
            ) f2 ON f1.clues_id = f2.clues_id AND f1.follow_time = f2.max_follow_time
        ) f ON c.id = f.clues_id
        LEFT JOIN users u ON f.follower = u.id
        LEFT JOIN product_category pc ON c.product_id = pc.id
        WHERE 1=1
        '''
        
        count_query = '''
        SELECT COUNT(DISTINCT c.id) as total 
        FROM clues c
        LEFT JOIN (
            SELECT f1.*
            FROM follows f1
            INNER JOIN (
                SELECT clues_id, MAX(follow_time) as max_follow_time
                FROM follows
                GROUP BY clues_id
            ) f2 ON f1.clues_id = f2.clues_id AND f1.follow_time = f2.max_follow_time
        ) f ON c.id = f.clues_id
        LEFT JOIN product_category pc ON c.product_id = pc.id
        WHERE 1=1
        '''
        params = []
        
        # 使用从token中获取的organization_id
        if organization_id:
            base_query += " AND c.organization_id = %s"
            count_query += " AND c.organization_id = %s"
            params.append(organization_id)
        elif request.organization_id:
            base_query += " AND c.organization_id = %s"
            count_query += " AND c.organization_id = %s"
            params.append(request.organization_id)
        
        if request.clues_status is not None:
            if isinstance(request.clues_status, list):
                # 如果是数组，使用 IN 查询
                placeholders = ','.join(['%s'] * len(request.clues_status))
                base_query += f" AND (COALESCE(f.clues_status, c.clues_status) IN ({placeholders}))"
                count_query += f" AND (COALESCE(f.clues_status, c.clues_status) IN ({placeholders}))"
                params.extend(request.clues_status)
            else:
                # 如果是单个值，使用 = 查询
                base_query += " AND (COALESCE(f.clues_status, c.clues_status) = %s)"
                count_query += " AND (COALESCE(f.clues_status, c.clues_status) = %s)"
                params.append(request.clues_status)
        
        if request.client_level is not None:
            if isinstance(request.client_level, list):
                # 如果是数组，使用 IN 查询
                placeholders = ','.join(['%s'] * len(request.client_level))
                base_query += f" AND (COALESCE(f.client_level, c.client_level) IN ({placeholders}))"
                count_query += f" AND (COALESCE(f.client_level, c.client_level) IN ({placeholders}))"
                params.extend(request.client_level)
            else:
                # 如果是单个值，使用 = 查询
                base_query += " AND (COALESCE(f.client_level, c.client_level) = %s)"
                count_query += " AND (COALESCE(f.client_level, c.client_level) = %s)"
                params.append(request.client_level)
        
        # 添加新的搜索条件
        if request.phone:
            base_query += " AND c.phone LIKE %s"
            count_query += " AND c.phone LIKE %s"
            params.append(f"%{request.phone}%")
        
        if request.product:
            base_query += " AND (c.product LIKE %s OR pc.name LIKE %s OR f.product LIKE %s)"
            count_query += " AND (c.product LIKE %s OR pc.name LIKE %s OR f.product LIKE %s)"
            params.extend([f"%{request.product}%", f"%{request.product}%", f"%{request.product}%"])
        
        if request.create_time_start:
            base_query += " AND c.create_time >= %s"
            count_query += " AND c.create_time >= %s"
            params.append(request.create_time_start)
        
        if request.create_time_end:
            base_query += " AND c.create_time <= %s"
            count_query += " AND c.create_time <= %s"
            params.append(request.create_time_end)
        
        if request.last_follow_time_start:
            base_query += " AND f.follow_time >= %s"
            count_query += " AND f.follow_time >= %s"
            params.append(request.last_follow_time_start)
        
        if request.last_follow_time_end:
            base_query += " AND f.follow_time <= %s"
            count_query += " AND f.follow_time <= %s"
            params.append(request.last_follow_time_end)
        
        if request.next_follow_time_start:
            base_query += " AND f.next_follow_time >= %s"
            count_query += " AND f.next_follow_time >= %s"
            params.append(request.next_follow_time_start)
        
        if request.next_follow_time_end:
            base_query += " AND f.next_follow_time <= %s"
            count_query += " AND f.next_follow_time <= %s"
            params.append(request.next_follow_time_end)
        
        if request.ai_call is not None:
            if request.ai_call:
                base_query += " AND f.follow_type = 2"
                count_query += " AND f.follow_type = 2"
            else:
                base_query += " AND (f.follow_type != 2 OR f.follow_type IS NULL)"
                count_query += " AND (f.follow_type != 2 OR f.follow_type IS NULL)"
        
        # 调试信息
        print(f"Count Query: {count_query}")
        print(f"Count Params: {params}")
        
        # 获取总数
        total_result = execute_query(count_query, params)
        total_count = total_result[0]['total'] if total_result else 0
        
        print(f"Total Count Result: {total_result}")
        print(f"Total Count: {total_count}")
        
        # 添加排序和分页
        base_query += " ORDER BY c.create_time DESC"
        
        # 计算偏移量
        offset = (request.page - 1) * request.page_size
        base_query += f" LIMIT {request.page_size} OFFSET {offset}"
        
        # 执行查询
        results = execute_query(base_query, params)
        
        # 格式化数据时添加产品层级信息
        leads_with_follows = []
        for row in results:
            # 获取产品完整层级路径
            product_hierarchy = []
            if row["product_category_id"]:
                product_hierarchy = await get_product_hierarchy(row["product_category_id"])
            
            # 线索基本信息 - 如果有最新跟进记录，优先使用跟进记录中的字段
            lead_info = {
                "id": row["id"],
                "organization_id": row["organization_id"],
                "client_name": row["client_name"],
                "phone": row["phone"],
                "source": row["source"],
                # 优先使用最新跟进记录中的产品信息
                "product": row["latest_follow_product"] if row["latest_follow_product"] is not None else row["product"],
                "create_name": row.get("create_name", "未知"),
                # 优先使用最新跟进记录中的状态信息
                "clues_status": row["latest_follow_clues_status"] if row["latest_follow_clues_status"] is not None else row["clues_status"],
                "clues_status_text": {
                    0: "已战败",
                    1: "未跟进", 
                    2: "跟进中",
                    3: "已成单"
                }.get(row["latest_follow_clues_status"] if row["latest_follow_clues_status"] is not None else row["clues_status"], "未知状态"),
                # 优先使用最新跟进记录中的客户等级
                "client_level": row["latest_follow_client_level"] if row["latest_follow_client_level"] is not None else row["client_level"],
                "client_level_text": {
                    1: "H级",
                    2: "A级",
                    3: "B级", 
                    4: "C级",
                    5: "N级",
                    6: "O级",
                    7: "F级"
                }.get(row["latest_follow_client_level"] if row["latest_follow_client_level"] is not None else row["client_level"], "未知等级"),
                "create_time": row["create_time"].strftime("%Y-%m-%d %H:%M:%S") if row["create_time"] else None
            }
            
            # 最新跟进记录信息
            if row["latest_follow_id"]:
                latest_follow = {
                    "follow_id": row["latest_follow_id"],
                    "follow_type": row["latest_follow_type"],
                    "follow_type_text": "手动跟进" if row["latest_follow_type"] == 1 else "AI电话跟进",
                    "follow_time": row["latest_follow_time"].strftime("%Y-%m-%d %H:%M:%S") if row["latest_follow_time"] else None,
                    "follower": row["latest_follower"],
                    "follower_name": row["latest_follower_name"] or "未知用户",
                    "next_follow_time": row["latest_next_follow_time"].strftime("%Y-%m-%d %H:%M:%S") if row["latest_next_follow_time"] else None,
                    "plan_visit_time": row["latest_plan_visit_time"].strftime("%Y-%m-%d %H:%M:%S") if row["latest_plan_visit_time"] else None,
                    "remark": row["latest_follow_remark"]
                }
            else:
                latest_follow = None
            
            leads_with_follows.append({
                "lead_info": lead_info,
                "latest_follow": latest_follow
            })
        
        # 计算分页信息
        total_pages = (total_count + request.page_size - 1) // request.page_size
        
        return LeadResponse(
            status="success",
            code=1000,
            message=f"第 {request.page} 页找到 {len(leads_with_follows)} 条线索（含最新跟进记录）",
            data={
                "leads_with_follows": leads_with_follows,
                "pagination": {
                    "current_page": request.page,
                    "page_size": request.page_size,
                    "total_count": total_count,
                    "total_pages": total_pages,
                    "has_next": request.page < total_pages,
                    "has_prev": request.page > 1
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"查询线索和跟进记录失败：{str(e)}"
            }
        )

async def get_product_hierarchy(product_id: int):
    """
    获取产品的完整层级路径
    """
    hierarchy = []
    current_id = product_id
    
    while current_id:
        query = "SELECT id, name, parent_id FROM product_category WHERE id = %s"
        result = execute_query(query, (current_id,))
        
        if result:
            category = result[0]
            hierarchy.insert(0, {
                "id": category["id"],
                "name": category["name"],
                "parent_id": category["parent_id"]
            })
            current_id = category["parent_id"]
        else:
            break
    
    return hierarchy

@create_leads_router.post("/leads/level_stats",
                         response_model=LeadLevelStatsResponse,
                         summary="查询客户等级统计",
                         description="统计各个客户等级的数量情况，支持按状态、时间等条件筛选。organization_id 会自动从 access-token 中获取。优先使用最新跟进记录中的客户等级。需要在请求头中提供access-token进行身份验证。",
                         tags=["线索管理"])
async def get_lead_level_stats(request: LeadLevelStatsRequest, token: str = Depends(verify_access_token)):
    """
    查询客户等级统计
    
    支持的筛选条件：
    - **clues_status**: 线索状态 (0=已战败，1=未跟进，2=跟进中，3=已成单)
    - **create_time_start/end**: 创建时间范围
    - **last_follow_time_start/end**: 最新跟进时间范围
    - **next_follow_time_start/end**: 下次跟进时间范围
    - **ai_call**: 是否AI外呼筛选
    
    注意：organization_id 会自动从 access-token 中获取，确保用户只能查看自己组织的数据。
    
    返回各个客户等级的统计数量：
    - H级 (1)
    - A级 (2)
    - B级 (3)
    - C级 (4)
    - N级 (5)
    - O级 (6)
    - F级 (7)
    """
    try:
        # 构建统计查询
        stats_query = '''
        SELECT 
            CASE 
                WHEN f.client_level IS NOT NULL THEN f.client_level
                ELSE c.client_level
            END as final_client_level,
            COUNT(*) as count
        FROM clues c
        LEFT JOIN (
            SELECT f1.*
            FROM follows f1
            INNER JOIN (
                SELECT clues_id, MAX(follow_time) as max_follow_time
                FROM follows
                GROUP BY clues_id
            ) f2 ON f1.clues_id = f2.clues_id AND f1.follow_time = f2.max_follow_time
        ) f ON c.id = f.clues_id
        WHERE 1=1
        '''
        
        params = []
        
        # 从token中获取organization_id
        organization_id = token.get("organization_id")
        if organization_id:
            stats_query += " AND c.organization_id = %s"
            params.append(organization_id)
        
        if request.clues_status is not None:
            stats_query += " AND c.clues_status = %s"
            params.append(request.clues_status)
        
        if request.create_time_start:
            stats_query += " AND DATE(c.create_time) >= %s"
            params.append(request.create_time_start)
        
        if request.create_time_end:
            stats_query += " AND DATE(c.create_time) <= %s"
            params.append(request.create_time_end)
        
        if request.last_follow_time_start:
            stats_query += " AND DATE(f.follow_time) >= %s"
            params.append(request.last_follow_time_start)
        
        if request.last_follow_time_end:
            stats_query += " AND DATE(f.follow_time) <= %s"
            params.append(request.last_follow_time_end)
        
        if request.next_follow_time_start:
            stats_query += " AND DATE(f.next_follow_time) >= %s"
            params.append(request.next_follow_time_start)
        
        if request.next_follow_time_end:
            stats_query += " AND DATE(f.next_follow_time) <= %s"
            params.append(request.next_follow_time_end)
        
        if request.ai_call is not None:
            if request.ai_call:
                stats_query += " AND f.follow_type = 2"
            else:
                stats_query += " AND (f.follow_type != 2 OR f.follow_type IS NULL)"
        
        stats_query += " GROUP BY final_client_level ORDER BY final_client_level"
        
        # 执行统计查询
        stats_result = execute_query(stats_query, params)
        
        # 初始化所有等级的统计
        level_stats = {
            "H级": {"level": 1, "count": 0, "percentage": 0},
            "A级": {"level": 2, "count": 0, "percentage": 0},
            "B级": {"level": 3, "count": 0, "percentage": 0},
            "C级": {"level": 4, "count": 0, "percentage": 0},
            "N级": {"level": 5, "count": 0, "percentage": 0},
            "O级": {"level": 6, "count": 0, "percentage": 0},
            "F级": {"level": 7, "count": 0, "percentage": 0}
        }
        
        # 计算总数
        total_count = 0
        for row in stats_result:
            level = row["final_client_level"]
            count = row["count"]
            total_count += count
            
            # 根据等级设置对应的统计
            if level == 1:
                level_stats["H级"]["count"] = count
            elif level == 2:
                level_stats["A级"]["count"] = count
            elif level == 3:
                level_stats["B级"]["count"] = count
            elif level == 4:
                level_stats["C级"]["count"] = count
            elif level == 5:
                level_stats["N级"]["count"] = count
            elif level == 6:
                level_stats["O级"]["count"] = count
            elif level == 7:
                level_stats["F级"]["count"] = count
        
        # 计算百分比
        if total_count > 0:
            for level_name, stats in level_stats.items():
                stats["percentage"] = round((stats["count"] / total_count) * 100, 2)
        
        # 构建返回数据
        stats_data = {
            "total_count": total_count,
            "level_stats": level_stats,
            "summary": {
                "high_value_count": level_stats["H级"]["count"] + level_stats["A级"]["count"] + level_stats["B级"]["count"],
                "medium_value_count": level_stats["C级"]["count"] + level_stats["N级"]["count"],
                "low_value_count": level_stats["O级"]["count"] + level_stats["F级"]["count"]
            }
        }
        
        return LeadLevelStatsResponse(
            status="success",
            code=1000,
            message=f"统计完成，共找到 {total_count} 条线索",
            data=stats_data
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"统计客户等级失败：{str(e)}"
            }
        )

@create_leads_router.post("/leads/daily_stats",
                         response_model=DailyLeadsStatsResponse,
                         summary="查询每日新增线索统计",
                         description="统计指定时间范围内每天的新增线索数量，支持按状态等条件筛选。organization_id 会自动从 access-token 中获取。需要在请求头中提供access-token进行身份验证。",
                         tags=["线索管理"])
async def get_daily_leads_stats(request: DailyLeadsStatsRequest, token: str = Depends(verify_access_token)):
    """
    查询每日新增线索统计
    
    支持的筛选条件：
    - **start_date**: 开始日期（必填）
    - **end_date**: 结束日期（必填）
    - **clues_status**: 线索状态筛选
    
    注意：organization_id 会自动从 access-token 中获取，确保用户只能查看自己组织的数据。
    
    返回指定时间范围内每天的新增线索数量统计。
    """
    try:
        # 构建统计查询
        stats_query = '''
        SELECT 
            DATE(create_time) as date,
            COUNT(*) as daily_count
        FROM clues 
        WHERE DATE(create_time) BETWEEN %s AND %s
        '''
        
        params = [request.start_date, request.end_date]
        
        # 从token中获取organization_id
        organization_id = token.get("organization_id")
        if organization_id:
            stats_query += " AND organization_id = %s"
            params.append(organization_id)
        
        if request.clues_status is not None:
            stats_query += " AND clues_status = %s"
            params.append(request.clues_status)
        
        stats_query += " GROUP BY DATE(create_time) ORDER BY date"
        
        # 执行统计查询
        stats_result = execute_query(stats_query, params)
        
        # 生成日期范围内的所有日期
        from datetime import datetime, timedelta
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d")
        
        # 创建日期范围
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date.strftime("%Y-%m-%d"))
            current_date += timedelta(days=1)
        
        # 构建每日统计数据
        daily_stats = {}
        total_count = 0
        
        # 初始化所有日期的统计为0
        for date in date_range:
            daily_stats[date] = {
                "date": date,
                "count": 0,
                "weekday": datetime.strptime(date, "%Y-%m-%d").strftime("%A")  # 星期几
            }
        
        # 填充实际数据
        for row in stats_result:
            date = row["date"].strftime("%Y-%m-%d")
            count = row["daily_count"]
            daily_stats[date]["count"] = count
            total_count += count
        
        # 计算统计信息
        daily_counts = [stats["count"] for stats in daily_stats.values()]
        avg_daily_count = round(sum(daily_counts) / len(daily_counts), 2) if daily_counts else 0
        max_daily_count = max(daily_counts) if daily_counts else 0
        min_daily_count = min(daily_counts) if daily_counts else 0
        
        # 找出最高和最低的日期
        max_date = None
        min_date = None
        for date, stats in daily_stats.items():
            if stats["count"] == max_daily_count:
                max_date = date
            if stats["count"] == min_daily_count:
                min_date = date
        
        # 构建返回数据
        stats_data = {
            "date_range": {
                "start_date": request.start_date,
                "end_date": request.end_date,
                "total_days": len(date_range)
            },
            "total_leads": total_count,
            "daily_stats": list(daily_stats.values()),
            "summary": {
                "avg_daily_count": avg_daily_count,
                "max_daily_count": max_daily_count,
                "min_daily_count": min_daily_count,
                "max_date": max_date,
                "min_date": min_date,
                "total_days_with_leads": len([stats for stats in daily_stats.values() if stats["count"] > 0])
            }
        }
        
        return DailyLeadsStatsResponse(
            status="success",
            code=1000,
            message=f"统计完成，{request.start_date} 至 {request.end_date} 期间共新增 {total_count} 条线索",
            data=stats_data
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"统计每日新增线索失败：{str(e)}"
            }
        )