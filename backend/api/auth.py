from fastapi import HTTPException, Header
from typing import Optional, Dict, Any
from utils.jwt_utils import verify_access_token as jwt_verify_token

def verify_access_token(access_token: Optional[str] = Header(None, alias="access-token")) -> Dict[str, Any]:
    """
    验证JWT访问令牌
    
    Args:
        access_token: 从请求头中获取的access-token (JWT格式)
        
    Raises:
        HTTPException: 当令牌无效、缺失或过期时抛出异常
        
    Returns:
        Dict[str, Any]: 验证通过的用户信息
    """
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail={
                "status": "error",
                "code": 1005,
                "message": "缺少访问令牌，请在请求头中添加 access-token"
            }
        )
    
    # 如果token以Bearer开头，去掉Bearer前缀
    if access_token.startswith("Bearer "):
        access_token = access_token[7:]
    
    # 验证JWT令牌
    user_info = jwt_verify_token(access_token)
    
    if not user_info:
        raise HTTPException(
            status_code=401,
            detail={
                "status": "error", 
                "code": 1005,
                "message": "访问令牌无效或已过期，请重新登录获取新令牌"
            }
        )
    
    return user_info