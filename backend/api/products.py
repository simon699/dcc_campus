from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel
from database.db import execute_query
from .auth import verify_access_token

products_router = APIRouter(tags=["产品管理"])

class ProductCategory(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    children: Optional[List['ProductCategory']] = []

class ProductResponse(BaseModel):
    status: str
    code: int
    message: str
    data: List[ProductCategory]

@products_router.get("/products", response_model=ProductResponse)
async def get_products(parent_id: Optional[int] = None, token: str = Depends(verify_access_token)):
    """
    获取产品分类列表
    - parent_id: 父级分类ID，不传则获取顶级分类
    - 需要在请求头中提供access-token进行身份验证
    """
    try:
        if parent_id is None:
            # 获取顶级分类（parent_id为NULL）
            query = "SELECT id, name, parent_id FROM product_category WHERE parent_id IS NULL ORDER BY id"
            params = ()
        else:
            # 获取指定父级下的子分类
            query = "SELECT id, name, parent_id FROM product_category WHERE parent_id = %s ORDER BY id"
            params = (parent_id,)
        
        categories = execute_query(query, params)
        
        # 转换为响应格式
        product_list = []
        for category in categories:
            # 查询是否有子分类
            child_query = "SELECT COUNT(*) as count FROM product_category WHERE parent_id = %s"
            child_count = execute_query(child_query, (category['id'],))
            has_children = child_count[0]['count'] > 0 if child_count else False
            
            product_item = ProductCategory(
                id=category['id'],
                name=category['name'],
                parent_id=category['parent_id'],
                children=[] if not has_children else None  # 如果有子分类，设为None表示需要进一步查询
            )
            product_list.append(product_item)
        
        return ProductResponse(
            status="success",
            code=1000,
            message="产品分类获取成功",
            data=product_list
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"获取产品分类失败: {str(e)}"
            }
        )

@products_router.get("/products/tree", response_model=ProductResponse)
async def get_products_tree(token: str = Depends(verify_access_token)):
    """
    获取完整的产品分类树结构
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 获取所有分类
        query = "SELECT id, name, parent_id FROM product_category ORDER BY parent_id, id"
        all_categories = execute_query(query)
        
        # 构建树形结构
        category_dict = {}
        root_categories = []
        
        # 先创建所有节点
        for category in all_categories:
            category_dict[category['id']] = ProductCategory(
                id=category['id'],
                name=category['name'],
                parent_id=category['parent_id'],
                children=[]
            )
        
        # 构建父子关系
        for category in all_categories:
            if category['parent_id'] is None:
                # 顶级分类
                root_categories.append(category_dict[category['id']])
            else:
                # 子分类，添加到父分类的children中
                if category['parent_id'] in category_dict:
                    category_dict[category['parent_id']].children.append(category_dict[category['id']])
        
        return ProductResponse(
            status="success",
            code=1000,
            message="产品分类树获取成功",
            data=root_categories
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"获取产品分类树失败: {str(e)}"
            }
        )

@products_router.get("/products/search")
async def search_products(keyword: str, token: str = Depends(verify_access_token)):
    """
    搜索产品分类
    需要在请求头中提供access-token进行身份验证
    """
    try:
        query = "SELECT id, name, parent_id FROM product_category WHERE name LIKE %s ORDER BY id"
        search_term = f"%{keyword}%"
        categories = execute_query(query, (search_term,))
        
        product_list = []
        for category in categories:
            product_item = ProductCategory(
                id=category['id'],
                name=category['name'],
                parent_id=category['parent_id'],
                children=[]
            )
            product_list.append(product_item)
        
        return ProductResponse(
            status="success",
            code=1000,
            message=f"找到 {len(product_list)} 个匹配 '{keyword}' 的产品分类",
            data=product_list
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"搜索产品分类失败: {str(e)}"
            }
        )