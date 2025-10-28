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
    },
    "import_success_response": {
        "summary": "线索导入成功响应",
        "value": {
            "status": "success",
            "code": 1000,
            "message": "导入完成: 成功 5 条, 失败 0 条, 跳过 2 条",
            "data": {
                "success_count": 5,
                "error_count": 0,
                "skipped_count": 2,
                "total_rows": 7,
                "imported_leads": [
                    {
                        "leads_id": "LEAD001",
                        "leads_user_name": "张三",
                        "leads_user_phone": "13800138001"
                    },
                    {
                        "leads_id": "LEAD002", 
                        "leads_user_name": "李四",
                        "leads_user_phone": "13800138002"
                    }
                ],
                "errors": []
            }
        }
    },
    "import_error_response": {
        "summary": "线索导入错误响应",
        "value": {
            "status": "error",
            "code": 1002,
            "message": "导入失败: 没有成功导入任何线索",
            "data": {
                "success_count": 0,
                "error_count": 3,
                "skipped_count": 0,
                "total_rows": 3,
                "imported_leads": [],
                "errors": [
                    "第1行: leads_id不能为空",
                    "第2行: leads_id LEAD001 已存在，跳过",
                    "第3行导入失败: 数据格式错误"
                ]
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