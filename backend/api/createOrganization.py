from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import random
import string
from database.db import execute_update, execute_query
from typing import Optional

organization_router = APIRouter(tags=["组织管理"])

class CreateOrganizationRequest(BaseModel):
    name: str
    organization_type: Optional[int] = 2  # 默认为未认证
    end_time_days: Optional[int] = 365  # 默认1年有效期

class OrganizationResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

def generate_organization_id():
    """生成6-8位随机组织ID"""
    length = random.randint(6, 8)
    # 使用大写字母和数字组合
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def is_organization_id_unique(org_id):
    """检查组织ID是否唯一"""
    check_query = "SELECT COUNT(*) as count FROM organizations WHERE organization_id = %s"
    result = execute_query(check_query, (org_id,))
    return result[0]['count'] == 0

def generate_unique_organization_id():
    """生成唯一的组织ID"""
    max_attempts = 100  # 防止无限循环
    for _ in range(max_attempts):
        org_id = generate_organization_id()
        if is_organization_id_unique(org_id):
            return org_id
    raise Exception("无法生成唯一的组织ID，请重试")

@organization_router.post("/create_organization", response_model=OrganizationResponse)
async def create_organization(request: CreateOrganizationRequest):
    try:
        # 验证必填字段
        if not request.name or request.name.strip() == "":
            return OrganizationResponse(
                status="error",
                code=2001,
                message="组织名称不能为空"
            )
        
        # 验证组织类型
        if request.organization_type not in [1, 2]:
            return OrganizationResponse(
                status="error",
                code=2002,
                message="组织类型必须为1(已认证)或2(未认证)"
            )
        
        # 确保组织表存在
        create_table_query = '''
        CREATE TABLE IF NOT EXISTS organizations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE COMMENT '公司名称',
            organization_id VARCHAR(20) NOT NULL UNIQUE COMMENT '组织ID',
            organization_type INT NOT NULL COMMENT '组织类型，1:已认证；2:未认证',
            create_time DATETIME NOT NULL COMMENT '创建时间',
            end_time DATETIME NOT NULL COMMENT '到期时间'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';
        '''
        execute_update(create_table_query)
        
        # 检查组织名称是否已存在
        check_name_query = "SELECT id, organization_id FROM organizations WHERE name = %s LIMIT 1"
        existing_org = execute_query(check_name_query, (request.name,))
        
        if existing_org:
            return OrganizationResponse(
                status="duplicate",
                code=2003,
                message="组织名称已存在",
                data={
                    "id": existing_org[0]['id'],
                    "name": request.name,
                    "organization_id": existing_org[0]['organization_id']
                }
            )
        
        # 生成唯一的组织ID
        organization_id = generate_unique_organization_id()
        
        # 设置创建时间和到期时间
        create_time = datetime.now()
        end_time = create_time + timedelta(days=request.end_time_days)
        
        # 插入新组织
        insert_query = '''
        INSERT INTO organizations (name, organization_id, organization_type, create_time, end_time)
        VALUES (%s, %s, %s, %s, %s)
        '''
        execute_update(insert_query, (request.name, organization_id, request.organization_type, create_time, end_time))
        
        # 获取插入的ID
        result = execute_query("SELECT LAST_INSERT_ID() as id")
        org_id = result[0]['id'] if result else None
        
        return OrganizationResponse(
            status="success",
            code=2000,
            message="组织创建成功",
            data={
                "id": org_id,
                "name": request.name,
                "organization_id": organization_id,
                "organization_type": request.organization_type,
                "organization_type_text": "已认证" if request.organization_type == 1 else "未认证",
                "create_time": create_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": end_time.strftime("%Y-%m-%d %H:%M:%S")
            }
        )
        
    except Exception as e:
        return OrganizationResponse(
            status="error",
            code=2004,
            message=f"创建组织失败: {str(e)}"
        )