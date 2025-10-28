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
        "name": "线索管理",
        "description": "客户线索的创建、查询和管理接口。线索默认状态为未跟进(1)，客户等级为N级(5)。需要在请求头中提供access-token进行身份验证。",
    },
    {
        "name": "线索导入",
        "description": "通过Excel文件批量导入线索数据的接口。支持文件上传、数据验证、模板下载等功能。需要在请求头中提供access-token进行身份验证。",
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