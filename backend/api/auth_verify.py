from fastapi import APIRouter, HTTPException, Depends
from api.auth import verify_access_token
from typing import Dict, Any

auth_verify_router = APIRouter()

@auth_verify_router.get("/auth/verify", tags=["认证"])
async def verify_token(user_info: Dict[str, Any] = Depends(verify_access_token)) -> Dict[str, Any]:
    """
    验证访问令牌
    
    验证当前请求中的access-token是否有效
    
    Returns:
        Dict[str, Any]: 验证结果
        
    Raises:
        HTTPException: 当令牌无效时抛出401异常
    """
    try:
        # 如果代码执行到这里，说明token是有效的
        # user_info包含了验证后的用户信息
        return {
            "status": "success",
            "code": 1000,
            "message": "访问令牌有效",
            "data": {
                "valid": True,
                "user_info": {
                    "username": user_info.get("username"),
                    "user_id": user_info.get("user_id"),
                    "organization_id": user_info.get("organization_id")
                },
                "org_id": user_info.get("organization_id")  # 添加组织ID到顶层
            }
        }
    except HTTPException as e:
        # 重新抛出HTTPException，保持原有的状态码和错误信息
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"验证过程中发生错误: {str(e)}"
            }
        ) 