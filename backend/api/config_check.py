from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import os
from config import config

router = APIRouter()

@router.get("/config/check")
async def check_config() -> Dict[str, Any]:
    """
    检查当前环境配置
    返回当前配置信息（隐藏敏感信息）
    """
    try:
        # 获取配置信息
        config_info = {
            "environment": config.ENVIRONMENT,
            "debug": config.DEBUG,
            "database": {
                "host": config.DB_HOST,
                "port": config.DB_PORT,
                "user": config.DB_USER,
                "database": config.DB_NAME,
                "password_set": bool(config.DB_PASSWORD)
            },
            "jwt": {
                "expire_hours": config.JWT_EXPIRE_HOURS,
                "secret_set": bool(config.JWT_SECRET_KEY)
            },
            "alibaba_cloud": {
                "access_key_set": bool(config.ALIBABA_CLOUD_ACCESS_KEY_ID),
                "secret_set": bool(config.ALIBABA_CLOUD_ACCESS_KEY_SECRET),
                "instance_id_set": bool(config.INSTANCE_ID)
            },
            "alibailian": {
                "dashscope_key_set": bool(config.DASHSCOPE_API_KEY),
                "app_id_set": bool(config.ALIBAILIAN_APP_ID)
            },
            "external_api": {
                "url": config.SCENE_ID_API_URL,
                "timeout": config.API_TIMEOUT,
                "token_set": bool(config.EXTERNAL_API_TOKEN)
            }
        }
        
        # 检查必需配置
        missing_configs = []
        
        if not config.DB_PASSWORD:
            missing_configs.append("数据库密码")
        
        if not config.JWT_SECRET_KEY:
            missing_configs.append("JWT密钥")
        
        if not config.ALIBABA_CLOUD_ACCESS_KEY_ID:
            missing_configs.append("阿里云AccessKey ID")
        
        if not config.ALIBABA_CLOUD_ACCESS_KEY_SECRET:
            missing_configs.append("阿里云AccessKey Secret")
        
        if not config.INSTANCE_ID:
            missing_configs.append("阿里云实例ID")
        
        if not config.DASHSCOPE_API_KEY:
            missing_configs.append("DashScope API密钥")
        
        if not config.ALIBAILIAN_APP_ID:
            missing_configs.append("阿里百炼应用ID")
        
        if not config.EXTERNAL_API_TOKEN:
            missing_configs.append("外部API令牌")
        
        return {
            "status": "success",
            "config": config_info,
            "missing_configs": missing_configs,
            "is_configured": len(missing_configs) == 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置检查失败: {str(e)}")

@router.get("/config/test-database")
async def test_database_connection() -> Dict[str, Any]:
    """
    测试数据库连接
    """
    try:
        from database.db import get_db_connection
        
        # 测试数据库连接
        connection = get_db_connection()
        if connection:
            connection.close()
            return {
                "status": "success",
                "message": "数据库连接成功",
                "database_url": config.get_database_url().replace(config.DB_PASSWORD, "***")
            }
        else:
            return {
                "status": "error",
                "message": "数据库连接失败"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"数据库连接测试失败: {str(e)}"
        }

@router.get("/config/environment")
async def get_environment_info() -> Dict[str, Any]:
    """
    获取环境信息
    """
    return {
        "node_env": os.getenv("NODE_ENV", "development"),
        "environment": config.ENVIRONMENT,
        "debug": config.DEBUG,
        "python_version": os.sys.version,
        "platform": os.sys.platform
    }
