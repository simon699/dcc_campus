from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field
from typing import Optional
import hashlib
import time
from database.db import execute_query, execute_update
from utils.jwt_utils import create_access_token, get_token_expiry_info

# 创建路由
login_router = APIRouter(tags=["用户管理"])

# 用户模型
class UserBase(BaseModel):
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")

class UserRegister(UserBase):
    phone: str = Field(..., description="手机号")

class UserLogin(UserBase):
    pass

class UserResponse(BaseModel):
    id: int
    username: str
    phone: str
    create_time: str

class LoginResponse(BaseModel):
    status: str
    code: int
    message: str
    data: dict

class RegisterResponse(BaseModel):
    status: str
    code: int
    message: str
    data: dict

# 密码加密函数
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# 注册接口
@login_router.post("/register", response_model=RegisterResponse, description="用户注册")
async def register(user: UserRegister):
    """
    用户注册接口
    
    注册成功后会返回用户信息和access-token，
    access-token用于访问需要身份验证的API接口（如产品管理、线索管理）
    
    - **username**: 用户名（唯一）
    - **password**: 密码
    - **phone**: 手机号（唯一）
    
    返回数据包含：
    - **user_info**: 用户基本信息
    - **access_token**: 访问令牌，用于后续API调用
    """
    try:
        # 检查用户名是否已存在
        existing_user = execute_query(
            "SELECT * FROM users WHERE username = %s", 
            (user.username,)
        )
        if existing_user:
            return RegisterResponse(
                status="duplicate",
                code=1001,
                message="用户名已存在",
                data={"field": "username", "value": user.username}
            )
        
        # 检查手机号是否已被注册
        existing_phone = execute_query(
            "SELECT * FROM users WHERE phone = %s", 
            (user.phone,)
        )
        if existing_phone:
            return RegisterResponse(
                status="duplicate",
                code=1001,
                message="手机号已被注册",
                data={"field": "phone", "value": user.phone}
            )
        
        # 密码加密
        hashed_password = hash_password(user.password)
        
        # 获取当前时间
        create_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        
        # 插入用户数据
        execute_update(
            "INSERT INTO users (username, password, phone, create_time) VALUES (%s, %s, %s, %s)",
            (user.username, hashed_password, user.phone, create_time)
        )
        
        # 获取新用户信息
        new_user = execute_query(
            "SELECT id, username, phone, create_time,organization_id FROM users WHERE username = %s",
            (user.username,)
        )
        
        if not new_user:
            return RegisterResponse(
                status="error",
                code=1002,
                message="用户创建失败",
                data={}
            )
        
        # 确保create_time是字符串
        user_data = new_user[0]
        user_data['create_time'] = str(user_data['create_time'])
        
        # 创建JWT访问令牌
        token_data = create_access_token(user_data)
        
        return RegisterResponse(
            status="success",
            code=1000,
            message="注册成功",
            data={
                "user_info": user_data,
                "access_token": token_data["access_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
                "expires_at": token_data["expires_at"],
                "token_usage": "请在后续API请求的Header中添加: access-token: " + token_data["access_token"],
                "org_id": user_data.get("org_id", None)  # 增加组织id返回
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"注册失败: {str(e)}"
            }
        )

# 登录接口
@login_router.post("/login", response_model=LoginResponse, description="用户登录")
async def login(user: UserLogin):
    """
    用户登录接口
    
    成功登录后会返回用户信息和access-token，
    access-token用于访问需要身份验证的API接口（如产品管理、线索管理）
    
    - **username**: 用户名
    - **password**: 密码
    
    返回数据包含：
    - **user_info**: 用户基本信息
    - **access_token**: 访问令牌，用于后续API调用
    """
    try:
        # 查询用户
        hashed_password = hash_password(user.password)
        
        user_data = execute_query(
            "SELECT id, username, phone, create_time,organization_id FROM users WHERE username = %s AND password = %s",
            (user.username, hashed_password)
        )
        
        if not user_data:
            return LoginResponse(
                status="error",
                code=1004,
                message="用户名或密码错误",
                data={}
            )
        
        # 确保create_time是字符串
        user_info = user_data[0]
        user_info['create_time'] = str(user_info['create_time'])
        
        # 创建JWT访问令牌
        token_data = create_access_token(user_info)
        
        return LoginResponse(
            status="success",
            code=1000,
            message="登录成功",
            data={
                "user_info": user_info,
                "org_id": user_info.get("organization_id", None),  # 增加组织id返回
                "access_token": token_data["access_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
                "expires_at": token_data["expires_at"],
                "token_usage": "请在后续API请求的Header中添加: access-token: " + token_data["access_token"],
                
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"登录失败: {str(e)}"
            }
        )

# 令牌验证接口
@login_router.get("/token/verify", description="验证访问令牌")
async def verify_token(access_token: str = Header(None, alias="access-token")):
    """
    验证访问令牌状态
    
    返回令牌的有效性和过期信息
    """
    if not access_token:
        return {
            "status": "error",
            "code": 1005,
            "message": "缺少访问令牌",
            "data": {"valid": False}
        }
    
    # 如果token以Bearer开头，去掉Bearer前缀
    if access_token.startswith("Bearer "):
        access_token = access_token[7:]
    
    # 验证令牌
    from utils.jwt_utils import verify_access_token as jwt_verify
    user_info = jwt_verify(access_token)
    
    # 获取令牌过期信息
    expiry_info = get_token_expiry_info(access_token)
    
    if user_info:
        return {
            "status": "success",
            "code": 1000,
            "message": "令牌有效",
            "data": {
                "valid": True,
                "user_info": user_info,
                "expiry_info": expiry_info
            }
        }
    else:
        return {
            "status": "error",
            "code": 1005,
            "message": "令牌无效或已过期",
            "data": {
                "valid": False,
                "expiry_info": expiry_info
            }
        }

# 令牌刷新接口
@login_router.post("/token/refresh", response_model=LoginResponse, description="刷新访问令牌")
async def refresh_token(access_token: str = Header(None, alias="access-token")):
    """
    刷新访问令牌
    
    使用当前令牌（即使已过期但在合理时间内）来获取新的令牌
    """
    if not access_token:
        return LoginResponse(
            status="error",
            code=1005,
            message="缺少访问令牌",
            data={}
        )
    
    # 如果token以Bearer开头，去掉Bearer前缀
    if access_token.startswith("Bearer "):
        access_token = access_token[7:]
    
    try:
        # 尝试从过期的令牌中获取用户信息
        import jwt
        from utils.jwt_utils import JWT_SECRET_KEY, JWT_ALGORITHM
        
        try:
            # 不验证过期时间，只获取用户信息
            payload = jwt.decode(access_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
        except jwt.InvalidTokenError:
            return LoginResponse(
                status="error",
                code=1005,
                message="令牌格式无效",
                data={}
            )
        
        user_id = payload.get("user_id")
        if not user_id:
            return LoginResponse(
                status="error",
                code=1005,
                message="令牌格式无效",
                data={}
            )
        
        # 从数据库重新获取用户信息
        user_data = execute_query(
            "SELECT id, username, phone, create_time FROM users WHERE id = %s",
            (user_id,)
        )
        
        if not user_data:
            return LoginResponse(
                status="error",
                code=1004,
                message="用户不存在",
                data={}
            )
        
        # 确保create_time是字符串
        user_info = user_data[0]
        user_info['create_time'] = str(user_info['create_time'])
        
        # 创建新的JWT访问令牌
        token_data = create_access_token(user_info)
        
        return LoginResponse(
            status="success",
            code=1000,
            message="令牌刷新成功",
            data={
                "user_info": user_info,
                "access_token": token_data["access_token"],
                "token_type": token_data["token_type"],
                "expires_in": token_data["expires_in"],
                "expires_at": token_data["expires_at"],
                "token_usage": "请在后续API请求的Header中添加: access-token: " + token_data["access_token"]
            }
        )
        
    except Exception as e:
        return LoginResponse(
            status="error",
            code=1005,
            message=f"令牌刷新失败: {str(e)}",
            data={}
        )
