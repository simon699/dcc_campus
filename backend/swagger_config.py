"""
Swagger API 文档配置
"""

tags_metadata = [
    {
        "name": "健康检查",
        "description": "服务健康状态检查接口",
    },
    {
        "name": "用户认证",
        "description": "用户登录、注册和认证相关接口",
    },
    {
        "name": "组织管理",
        "description": "组织创建、查询和管理接口",
    },
    {
        "name": "产品管理",
        "description": "产品分类的创建、查询和管理接口。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "线索管理",
        "description": "客户线索的创建、查询和管理接口。线索默认状态为未跟进(1)，客户等级为N级(5)。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "跟进管理",
        "description": "线索跟进记录的创建、查询和管理接口。跟进时间自动设置为当前时间，跟进人从access-token中获取。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "任务管理",
        "description": "任务的创建、查询和管理接口。支持手动和自动任务模式，可以关联多个线索。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "外呼任务管理",
        "description": "外呼任务的创建、查询和管理接口。支持阿里云外呼API集成，可以设置外呼策略和关联线索。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "自动外呼场景管理",
        "description": "自动外呼场景的创建、查询和管理接口。支持场景配置、机器人设置和标签管理。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "DCC用户管理",
        "description": "DCC用户的创建、校验和管理接口。支持用户创建、身份验证和状态管理。",
    },
]

# API 响应示例
response_examples = {
    "success_response": {
        "summary": "成功响应",
        "value": {
            "status": "success",
            "code": 1000,
            "message": "操作成功",
            "data": {}
        }
    },
    "error_response": {
        "summary": "错误响应",
        "value": {
            "status": "error",
            "code": 1002,
            "message": "操作失败的具体原因"
        }
    },
    "duplicate_response": {
        "summary": "重复数据响应",
        "value": {
            "status": "duplicate",
            "code": 1001,
            "message": "数据已存在",
            "data": {
                "existing_id": 123
            }
        }
    }
}

# 通用响应模型
common_responses = {
    200: {"description": "请求成功"},
    400: {"description": "请求参数错误"},
    401: {"description": "未授权访问"},
    403: {"description": "权限不足"},
    404: {"description": "资源不存在"},
    500: {"description": "服务器内部错误"},
}