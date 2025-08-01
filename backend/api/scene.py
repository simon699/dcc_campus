from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
from database.db import execute_update, execute_query
from .auth import verify_access_token

scene_router = APIRouter(tags=["自动外呼场景管理"])

# 请求模型
class SceneTagRequest(BaseModel):
    tag_name: str = Field(..., description="标签名称")
    tag_detail: str = Field(..., description="标签详情")
    tags: str = Field(..., description="标签内容，多个用分号隔开")

class CreateSceneRequest(BaseModel):
    scene_name: str = Field(..., description="场景名称")
    scene_detail: str = Field(..., description="场景详情")
    scene_type: int = Field(..., description="场景类型:1:官方场景；2:自定义场景")
    bot_name: str = Field(..., description="机器人名称")
    bot_sex: Optional[int] = Field(None, description="机器人性别:1:男；2:女;3:不确定")
    bot_age: Optional[int] = Field(None, description="机器人年龄")
    bot_post: Optional[str] = Field(None, description="机器人身份，多个用分号隔开")
    bot_style: Optional[str] = Field(None, description="机器人风格，多个用分号隔开")
    dialogue_target: Optional[str] = Field(None, description="对话目标")
    dialogue_bg: Optional[str] = Field(None, description="对话背景")
    dialogue_skill: Optional[str] = Field(None, description="对话技能")
    dialogue_flow: Optional[str] = Field(None, description="对话流程")
    dialogue_constraint: Optional[str] = Field(None, description="对话限制")
    dialogue_opening_prompt: Optional[str] = Field(None, description="对话开场白")
    scene_tags: Optional[List[SceneTagRequest]] = Field(None, description="场景标签列表")

# 响应模型
class SceneTagResponse(BaseModel):
    id: int
    scene_id: str
    tag_name: str
    tag_detail: str
    tags: str

class SceneResponse(BaseModel):
    id: int
    scene_id: str
    scene_name: str
    scene_detail: str
    scene_status: int
    scene_type: int
    scene_create_user_id: str
    scene_create_user_name: str
    scene_create_org_id: str
    scene_create_time: str
    bot_name: str
    bot_sex: Optional[int]
    bot_age: Optional[int]
    bot_post: Optional[str]
    bot_style: Optional[str]
    dialogue_target: Optional[str]
    dialogue_bg: Optional[str]
    dialogue_skill: Optional[str]
    dialogue_flow: Optional[str]
    dialogue_constraint: Optional[str]
    dialogue_opening_prompt: Optional[str]
    scene_tags: Optional[List[SceneTagResponse]] = []

class SceneListResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[List[SceneResponse]] = None

class SceneCreateResponse(BaseModel):
    status: str
    code: int
    message: str
    data: Optional[dict] = None

@scene_router.post("/create_scene",
                  response_model=SceneCreateResponse,
                  summary="创建自动外呼场景",
                  description="创建自动外呼场景，支持同时创建场景标签")
async def create_scene(request: CreateSceneRequest, token: dict = Depends(verify_access_token)):
    """创建自动外呼场景"""
    try:
        # 验证参数
        if not request.scene_name.strip():
            raise HTTPException(status_code=400, detail={"status": "error", "code": 4001, "message": "场景名称不能为空"})
        
        if not request.scene_detail.strip():
            raise HTTPException(status_code=400, detail={"status": "error", "code": 4002, "message": "场景详情不能为空"})
        
        if request.scene_type not in [1, 2]:
            raise HTTPException(status_code=400, detail={"status": "error", "code": 4003, "message": "场景类型只能是1(官方场景)或2(自定义场景)"})
        
        if not request.bot_name.strip():
            raise HTTPException(status_code=400, detail={"status": "error", "code": 4004, "message": "机器人名称不能为空"})
        
        # 生成场景ID
        scene_id = f"scene_{uuid.uuid4().hex[:8]}"
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 获取用户信息
        user_id = token.get("user_id")
        user_name = token.get("user_name", "未知用户")
        org_id = token.get("org_id")
        
        # 如果是官方场景，使用默认值
        if request.scene_type == 1:
            user_id = "official"
            user_name = "官方"
            org_id = "official"
        
        # 插入场景数据
        scene_sql = """
        INSERT INTO auto_call_scene (
            scene_id, scene_name, scene_detail, scene_status, scene_type,
            scene_create_user_id, scene_create_user_name, scene_create_org_id, scene_create_time,
            bot_name, bot_sex, bot_age, bot_post, bot_style,
            dialogue_target, dialogue_bg, dialogue_skill, dialogue_flow, dialogue_constraint, dialogue_opening_prompt
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        
        scene_params = (
            scene_id, request.scene_name, request.scene_detail, 1, request.scene_type,
            user_id, user_name, org_id, current_time,
            request.bot_name, request.bot_sex, request.bot_age, request.bot_post, request.bot_style,
            request.dialogue_target, request.dialogue_bg, request.dialogue_skill, 
            request.dialogue_flow, request.dialogue_constraint, request.dialogue_opening_prompt
        )
        
        execute_update(scene_sql, scene_params)
        
        # 如果有场景标签，插入标签数据
        if request.scene_tags:
            tag_sql = """
            INSERT INTO scene_tags (scene_id, tag_name, tag_detail, tags)
            VALUES (%s, %s, %s, %s)
            """
            
            for tag in request.scene_tags:
                tag_params = (scene_id, tag.tag_name, tag.tag_detail, tag.tags)
                execute_update(tag_sql, tag_params)
        
        return {
            "status": "success",
            "code": 200,
            "message": "场景创建成功",
            "data": {
                "scene_id": scene_id,
                "scene_name": request.scene_name,
                "scene_type": request.scene_type
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "code": 5001, "message": f"创建场景失败: {str(e)}"})

@scene_router.get("/scenes",
                 response_model=SceneListResponse,
                 summary="查询自动外呼场景",
                 description="根据token查询对应组织中创建的上线场景和官方上线场景")
async def get_scenes(token: dict = Depends(verify_access_token)):
    """查询自动外呼场景"""
    try:
        # 获取用户信息
        org_id = token.get("org_id")
        
        # 查询场景：用户组织创建的上线场景 + 官方上线场景
        scene_sql = """
        SELECT * FROM auto_call_scene 
        WHERE scene_status = 1 
        AND (scene_create_org_id = %s OR scene_type = 1)
        ORDER BY scene_create_time DESC
        """
        
        scenes = execute_query(scene_sql, (org_id,))
        
        # 查询每个场景的标签
        result_scenes = []
        for scene in scenes:
            # 查询场景标签
            tag_sql = """
            SELECT * FROM scene_tags WHERE scene_id = %s
            """
            tags = execute_query(tag_sql, (scene["scene_id"],))
            
            # 构建标签响应
            scene_tags = []
            for tag in tags:
                scene_tags.append(SceneTagResponse(**tag))
            
            # 构建场景响应
            # 处理可能为None的字段
            scene_data = dict(scene)
            
            # 确保必需字段不为None
            if scene_data.get("scene_create_user_name") is None:
                if scene_data.get("scene_type") == 1:
                    scene_data["scene_create_user_name"] = "官方"
                else:
                    scene_data["scene_create_user_name"] = "未知用户"
            if scene_data.get("scene_create_org_id") is None:
                if scene_data.get("scene_type") == 1:
                    scene_data["scene_create_org_id"] = "官方"
                else:
                    scene_data["scene_create_org_id"] = "未知组织"
            
            # 将datetime对象转换为字符串
            if isinstance(scene_data.get("scene_create_time"), datetime):
                scene_data["scene_create_time"] = scene_data["scene_create_time"].strftime("%Y-%m-%d %H:%M:%S")
            
            scene_response = SceneResponse(
                **scene_data,
                scene_tags=scene_tags
            )
            result_scenes.append(scene_response)
        
        return {
            "status": "success",
            "code": 200,
            "message": "查询成功",
            "data": result_scenes
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "code": 5002, "message": f"查询场景失败: {str(e)}"})