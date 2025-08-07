import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from config import config

# JWT配置
JWT_SECRET_KEY = config.JWT_SECRET_KEY
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = config.JWT_EXPIRE_HOURS

def create_access_token(data: Dict[Any, Any], expires_delta: Optional[timedelta] = None) -> Dict[str, Any]:
    """
    创建JWT访问令牌
    
    Args:
        data: 要编码到令牌中的数据
        expires_delta: 过期时间增量，如果不提供则使用默认值
        
    Returns:
        Dict: 包含令牌信息的字典
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    
    issued_at = datetime.utcnow()
    
    # 标准化字段名
    to_encode.update({
        "user_id": data.get("id"),  # 将id映射为user_id
        "username": data.get("username"),
        "phone": data.get("phone"),
        "organization_id": data.get("organization_id"),  # 添加组织ID
        "exp": expire,
        "iat": issued_at,
        "type": "access_token"
    })
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    return {
        "access_token": encoded_jwt,
        "token_type": "Bearer",
        "expires_in": int((expire - issued_at).total_seconds()),
        "expires_at": expire.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "issued_at": issued_at.strftime("%Y-%m-%d %H:%M:%S UTC")
    }

def verify_access_token(token: str) -> Optional[Dict[Any, Any]]:
    """
    验证JWT访问令牌
    
    Args:
        token: JWT令牌字符串
        
    Returns:
        Dict: 解码后的令牌数据，如果验证失败返回None
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        # 检查令牌类型
        if payload.get("type") != "access_token":
            return None
        
        # 返回用户相关信息
        return {
            "user_id": payload.get("user_id"),
            "username": payload.get("username"),
            "phone": payload.get("phone"),
            "organization_id": payload.get("organization_id"),  # 添加组织ID
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
            "type": payload.get("type")
        }
    except jwt.ExpiredSignatureError:
        # 令牌已过期
        return None
    except jwt.InvalidTokenError:
        # 令牌无效
        return None
    except Exception:
        # 其他错误
        return None

def get_token_expiry_info(token: str) -> Optional[Dict[str, Any]]:
    """
    获取令牌过期信息
    
    Args:
        token: JWT令牌字符串
        
    Returns:
        Dict: 包含过期时间信息的字典
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        exp_timestamp = payload.get("exp")
        iat_timestamp = payload.get("iat")
        
        if exp_timestamp and iat_timestamp:
            exp_datetime = datetime.fromtimestamp(exp_timestamp)
            iat_datetime = datetime.fromtimestamp(iat_timestamp)
            now = datetime.utcnow()
            
            return {
                "issued_at": iat_datetime.strftime("%Y-%m-%d %H:%M:%S"),
                "expires_at": exp_datetime.strftime("%Y-%m-%d %H:%M:%S"),
                "is_expired": now > exp_datetime,
                "remaining_seconds": int((exp_datetime - now).total_seconds()) if exp_datetime > now else 0,
                "remaining_hours": round((exp_datetime - now).total_seconds() / 3600, 2) if exp_datetime > now else 0
            }
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None

def refresh_token_if_needed(token: str, refresh_threshold_hours: int = 2) -> Optional[str]:
    """
    如果令牌即将过期，则刷新令牌
    
    Args:
        token: 当前JWT令牌
        refresh_threshold_hours: 刷新阈值（小时），当剩余时间少于此值时刷新
        
    Returns:
        str: 新的令牌，如果不需要刷新则返回None
    """
    payload = verify_access_token(token)
    if not payload:
        return None
    
    exp_timestamp = payload.get("exp")
    if not exp_timestamp:
        return None
    
    exp_datetime = datetime.fromtimestamp(exp_timestamp)
    now = datetime.utcnow()
    remaining_hours = (exp_datetime - now).total_seconds() / 3600
    
    # 如果剩余时间少于阈值，创建新令牌
    if remaining_hours < refresh_threshold_hours:
        # 移除时间相关的字段，保留用户数据
        user_data = {k: v for k, v in payload.items() if k not in ["exp", "iat", "type"]}
        return create_access_token(user_data)
    
    return None