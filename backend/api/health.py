from fastapi import APIRouter

health_router = APIRouter(tags=["健康检查"])

@health_router.get("/health")
async def health_check():
    """
    健康检查接口，用于确认服务是否正常运行
    """
    return {"status": "ok", "message": "服务运行正常"}