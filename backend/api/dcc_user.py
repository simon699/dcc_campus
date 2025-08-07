from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
import hashlib
import time
from database.db import execute_query, execute_update

# 创建路由
dcc_user_router = APIRouter(tags=["DCC用户管理"])

# DCC用户模型
class DccUserCreate(BaseModel):
    user_name: str = Field(..., description="用户名称")
    user_password: str = Field(..., description="用户密码")
    user_org_id: str = Field(..., description="用户组织ID")
    user_status: int = Field(1, description="用户状态:1:启用；0:禁用")

class DccUserVerify(BaseModel):
    user_name: str = Field(..., description="用户名称")
    user_password: str = Field(..., description="用户密码")
    user_org_id: str = Field(..., description="用户组织ID")

class DccUserInfo(BaseModel):
    id: int
    user_name: str
    user_status: int

class DccUserResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

# 密码加密函数
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# 创建DCC用户接口
@dcc_user_router.post("/dcc/user/create", response_model=DccUserResponse, description="创建DCC用户")
async def create_dcc_user(user: DccUserCreate):
    """
    创建DCC用户接口
    
    - **user_name**: 用户名称（唯一）
    - **user_password**: 用户密码
    - **user_org_id**: 用户组织ID
    - **user_status**: 用户状态（1:启用；0:禁用，默认为1）
    
    返回数据包含：
    - **user_info**: 用户基本信息
    """
    try:
        # 检查用户名是否已存在
        existing_user = execute_query(
            "SELECT * FROM dcc_user WHERE user_name = %s", 
            (user.user_name,)
        )
        if existing_user:
            return DccUserResponse(
                status="error",
                code=1001,
                message="用户名称已存在",
                data={"field": "user_name", "value": user.user_name}
            )
        
        # 检查组织ID是否已存在
        existing_org = execute_query(
            "SELECT * FROM dcc_user WHERE user_org_id = %s", 
            (user.user_org_id,)
        )
        if existing_org:
            return DccUserResponse(
                status="error",
                code=1002,
                message="组织ID已存在",
                data={"field": "user_org_id", "value": user.user_org_id}
            )
        
        # 密码加密
        hashed_password = hash_password(user.user_password)
        
        # 插入用户数据
        execute_update(
            "INSERT INTO dcc_user (user_name, user_password, user_org_id, user_status) VALUES (%s, %s, %s, %s)",
            (user.user_name, hashed_password, user.user_org_id, user.user_status)
        )
        
        # 获取新创建的用户信息
        new_user = execute_query(
            "SELECT id, user_name, user_org_id, user_status FROM dcc_user WHERE user_name = %s",
            (user.user_name,)
        )
        
        if new_user:
            user_info = new_user[0]
            return DccUserResponse(
                status="success",
                code=200,
                message="DCC用户创建成功",
                data={
                    "user_info": {
                        "id": user_info["id"],
                        "user_name": user_info["user_name"],
                        "user_org_id": user_info["user_org_id"],
                        "user_status": user_info["user_status"]
                    }
                }
            )
        else:
            return DccUserResponse(
                status="error",
                code=500,
                message="创建用户后无法获取用户信息"
            )
            
    except Exception as e:
        return DccUserResponse(
            status="error",
            code=500,
            message=f"创建DCC用户失败: {str(e)}"
        )

# 校验DCC用户接口
@dcc_user_router.post("/dcc/user/verify", response_model=DccUserResponse, description="校验DCC用户")
async def verify_dcc_user(user: DccUserVerify):
    """
    校验DCC用户接口
    
    通过输入用户名、密码、用户组织ID，返回用户信息
    
    - **user_name**: 用户名称
    - **user_password**: 用户密码
    - **user_org_id**: 用户组织ID
    
    返回数据包含：
    - **user_info**: 用户基本信息（用户名称、用户状态）
    """
    try:
        # 密码加密
        hashed_password = hash_password(user.user_password)
        
        # 查询用户信息
        user_info = execute_query(
            "SELECT id, user_name, user_status, user_org_id FROM dcc_user WHERE user_name = %s AND user_password = %s AND user_org_id = %s",
            (user.user_name, hashed_password, user.user_org_id)
        )
        
        if user_info:
            user_data = user_info[0]
            return DccUserResponse(
                status="success",
                code=200,
                message="用户校验成功",
                data={
                    "user_info": {
                        "id": user_data["id"],
                        "user_name": user_data["user_name"],
                        "user_status": user_data["user_status"],
                        "user_org_id": user_data["user_org_id"]
                    }
                }
            )
        else:
            return DccUserResponse(
                status="error",
                code=1003,
                message="用户名、密码或组织ID不正确",
                data={"field": "credentials", "value": "invalid"}
            )
            
    except Exception as e:
        return DccUserResponse(
            status="error",
            code=500,
            message=f"校验DCC用户失败: {str(e)}"
        )

# 获取DCC用户列表接口
@dcc_user_router.get("/dcc/user/list", response_model=DccUserResponse, description="获取DCC用户列表")
async def get_dcc_user_list():
    """
    获取DCC用户列表接口
    
    返回所有DCC用户的基本信息
    """
    try:
        users = execute_query(
            "SELECT id, user_name, user_org_id, user_status FROM dcc_user ORDER BY id"
        )
        
        return DccUserResponse(
            status="success",
            code=200,
            message="获取DCC用户列表成功",
            data={
                "users": users,
                "total": len(users),
                "org_id": users[0]["user_org_id"]
            }
        )
        
    except Exception as e:
        return DccUserResponse(
            status="error",
            code=500,
            message=f"获取DCC用户列表失败: {str(e)}"
        )

# 更新DCC用户状态接口
@dcc_user_router.put("/dcc/user/{user_id}/status", response_model=DccUserResponse, description="更新DCC用户状态")
async def update_dcc_user_status(user_id: int, user_status: int):
    """
    更新DCC用户状态接口
    
    - **user_id**: 用户ID
    - **user_status**: 用户状态（1:启用；0:禁用）
    """
    try:
        # 检查用户是否存在
        existing_user = execute_query(
            "SELECT * FROM dcc_user WHERE id = %s",
            (user_id,)
        )
        
        if not existing_user:
            return DccUserResponse(
                status="error",
                code=1004,
                message="用户不存在",
                data={"field": "user_id", "value": user_id}
            )
        
        # 更新用户状态
        execute_update(
            "UPDATE dcc_user SET user_status = %s WHERE id = %s",
            (user_status, user_id)
        )
        
        # 获取更新后的用户信息
        updated_user = execute_query(
            "SELECT id, user_name, user_org_id, user_status FROM dcc_user WHERE id = %s",
            (user_id,)
        )
        
        if updated_user:
            user_info = updated_user[0]
            return DccUserResponse(
                status="success",
                code=200,
                message="用户状态更新成功",
                data={
                    "user_info": user_info
                }
            )
        else:
            return DccUserResponse(
                status="error",
                code=500,
                message="更新用户状态后无法获取用户信息"
            )
            
    except Exception as e:
        return DccUserResponse(
            status="error",
            code=500,
            message=f"更新DCC用户状态失败: {str(e)}"
        )