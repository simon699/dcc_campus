import os
from typing import Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class Config:
    """配置基类"""
    # 数据库配置
    DB_HOST: str = os.getenv('DB_HOST', 'localhost')
    DB_PORT: int = int(os.getenv('DB_PORT', '3306'))
    DB_USER: str = os.getenv('DB_USER', 'root')
    DB_PASSWORD: str = os.getenv('DB_PASSWORD', '')
    DB_NAME: str = os.getenv('DB_NAME', 'dcc_employee_db')
    
    # JWT配置
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', 'dcc-jwt-secret-key-2024')
    JWT_EXPIRE_HOURS: int = int(os.getenv('JWT_EXPIRE_HOURS', '24'))
    
    # 阿里云配置
    ALIBABA_CLOUD_ACCESS_KEY_ID: Optional[str] = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID')
    ALIBABA_CLOUD_ACCESS_KEY_SECRET: Optional[str] = os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
    INSTANCE_ID: Optional[str] = os.getenv('INSTANCE_ID')
    
    # 阿里百炼配置
    DASHSCOPE_API_KEY: Optional[str] = os.getenv('DASHSCOPE_API_KEY')
    ALIBAILIAN_APP_ID: Optional[str] = os.getenv('ALIBAILIAN_APP_ID')
    
    # 外部API配置
    SCENE_ID_API_URL: str = os.getenv('SCENE_ID_API_URL', 'https://your-external-api.com/get-scene-id')
    API_TIMEOUT: int = int(os.getenv('API_TIMEOUT', '30'))
    EXTERNAL_API_TOKEN: str = os.getenv('EXTERNAL_API_TOKEN', '')
    
    # 应用配置
    DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')
    
    @classmethod
    def get_database_url(cls) -> str:
        """获取数据库连接URL"""
        return f"mysql+pymysql://{cls.DB_USER}:{cls.DB_PASSWORD}@{cls.DB_HOST}:{cls.DB_PORT}/{cls.DB_NAME}"
    
    @classmethod
    def get_database_config(cls) -> dict:
        """获取数据库配置字典"""
        return {
            'host': cls.DB_HOST,
            'port': cls.DB_PORT,
            'user': cls.DB_USER,
            'password': cls.DB_PASSWORD,
            'database': cls.DB_NAME
        }

class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    ENVIRONMENT = 'development'

class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    ENVIRONMENT = 'production'

class TestingConfig(Config):
    """测试环境配置"""
    DEBUG = True
    ENVIRONMENT = 'testing'
    DB_NAME = 'dcc_employee_test'

# 根据环境变量选择配置
def get_config():
    """根据环境变量返回相应的配置类"""
    env = os.getenv('ENVIRONMENT', 'development').lower()
    
    if env == 'production':
        return ProductionConfig
    elif env == 'testing':
        return TestingConfig
    else:
        return DevelopmentConfig

# 当前配置实例
config = get_config()
