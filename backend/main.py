from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from api.health import health_router
from api.login import login_router
from api.createOrganization import organization_router
from api.products import products_router
from api.createLeads import create_leads_router
from api.createFollows import create_follows_router
from api.tasks import tasks_router
from swagger_config import tags_metadata

app = FastAPI(
    title="DCC数字员工服务API",
    description="""
    DCC数字员工后端服务API文档
    
    ## 功能模块
    
    * **健康检查** - 服务状态检查
    * **用户认证** - 用户登录和认证相关接口
    * **组织管理** - 组织创建和管理
    * **产品管理** - 产品分类和管理（需要access-token验证）
    * **线索管理** - 客户线索创建和管理（需要access-token验证）
    * **跟进管理** - 线索跟进记录创建和管理（需要access-token验证）
    
    ## 身份验证
    
    产品管理、线索管理和跟进管理接口需要在请求头中提供access-token进行身份验证：
    
    ```
    Headers:
    access-token: your-access-token-here
    ```
    
    默认访问令牌：`dcc-api-token-2024`
    
    ## 状态码说明
    
    * **1000** - 操作成功
    * **1001** - 数据重复/已存在
    * **1002** - 操作失败/系统错误
    * **1003** - 参数验证失败
    * **1004** - 数据不存在
    * **1005** - 权限不足/访问令牌无效
    * **2000** - 跟进操作成功
    * **2001** - 线索不存在
    * **2002** - 跟进操作失败
    * **2003** - 跟进记录不存在
    
    ## 线索状态说明
    
    * **0** - 已战败
    * **1** - 未跟进（默认）
    * **2** - 跟进中
    * **3** - 已成单
    
    ## 客户等级说明
    
    * **1** - H级  * **2** - A级  * **3** - B级  * **4** - C级
    * **5** - N级（默认）  * **6** - O级  * **7** - F级
    """,
    version="1.0.0",
    contact={
        "name": "DCC开发团队",
        "email": "dev@dcc.com",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=tags_metadata,
    docs_url="/docs",  # Swagger UI 地址
    redoc_url="/redoc",  # ReDoc 地址
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，也可以指定特定的来源如 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)

app.include_router(health_router, prefix="/api")
app.include_router(login_router, prefix="/api")
app.include_router(organization_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(create_leads_router, prefix="/api")
app.include_router(create_follows_router, prefix="/api")
# 注册路由
app.include_router(tasks_router, prefix="/api/tasks")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
