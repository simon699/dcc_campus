from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn
import asyncio
import threading
from api.health import health_router
from api.login import login_router
from api.createOrganization import organization_router
from api.scene import scene_router
from api.dcc_user import dcc_user_router
from api.dcc_leads import dcc_leads_router
from api.auto_call_api import auto_call_router
from api.auth_verify import auth_verify_router
from api.auto_task_monitor import auto_task_monitor
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
    * **任务管理** - 任务创建和管理（需要access-token验证）
    * **外呼任务管理** - 外呼任务创建和查询（需要access-token验证）
    
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
    * **2004** - 任务不存在或无权限访问
    * **2005** - 获取任务信息失败

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
    docs_url=None,  # 禁用默认的Swagger UI
    redoc_url=None,  # 禁用默认的ReDoc
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，也可以指定特定的来源如 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)

# 自定义文档路由
@app.get("/docs", response_class=HTMLResponse)
async def custom_swagger_ui_html():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DCC数字员工服务API - Swagger UI</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" type="text/css" href="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js"></script>
        <script src="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = function() {
                const ui = SwaggerUIBundle({
                    url: '/openapi.json',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "StandaloneLayout"
                });
            };
        </script>
    </body>
    </html>
    """)

@app.get("/redoc", response_class=HTMLResponse)
async def custom_redoc_html():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DCC数字员工服务API - ReDoc</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <redoc spec-url="/openapi.json"></redoc>
        <script src="https://cdn.bootcdn.net/ajax/libs/redoc/2.0.0/redoc.standalone.js"></script>
    </body>
    </html>
    """)

app.include_router(health_router, prefix="/api")
app.include_router(login_router, prefix="/api")
app.include_router(organization_router, prefix="/api")
app.include_router(scene_router, prefix="/api")
app.include_router(dcc_user_router, prefix="/api")
app.include_router(dcc_leads_router, prefix="/api")
app.include_router(auto_call_router, prefix="/api")
app.include_router(auth_verify_router, prefix="/api")

# 应用启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时自动启动自动化任务监控"""
    print("🚀 DCC数字员工服务启动中...")
    
    # 启动自动化任务监控
    try:
        # 创建后台任务启动监控
        asyncio.create_task(auto_task_monitor.start_monitoring())
        print("✅ 自动化任务监控已启动")
    except Exception as e:
        print(f"❌ 启动自动化任务监控失败: {str(e)}")

# 应用关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时停止自动化任务监控"""
    print("🛑 DCC数字员工服务正在关闭...")
    
    try:
        await auto_task_monitor.stop_monitoring()
        print("✅ 自动化任务监控已停止")
    except Exception as e:
        print(f"❌ 停止自动化任务监控失败: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
