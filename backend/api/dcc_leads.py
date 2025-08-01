from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from database.db import execute_query
from .auth import verify_access_token

dcc_leads_router = APIRouter(tags=["线索管理"])

class LeadsFilter(BaseModel):
    """线索筛选条件"""
    leads_product: Optional[str] = None  # 线索产品
    leads_type: Optional[str] = None     # 线索等级
    first_follow_start: Optional[str] = None  # 首次跟进开始时间
    first_follow_end: Optional[str] = None    # 首次跟进结束时间
    latest_follow_start: Optional[str] = None # 最近跟进开始时间
    latest_follow_end: Optional[str] = None   # 最近跟进结束时间
    next_follow_start: Optional[str] = None   # 下次跟进开始时间
    next_follow_end: Optional[str] = None     # 下次跟进结束时间
    first_arrive_start: Optional[str] = None  # 首次到店开始时间
    first_arrive_end: Optional[str] = None    # 首次到店结束时间
    is_arrive: Optional[int] = None      # 是否到店：0-否，1-是

class LeadsCountItem(BaseModel):
    """线索统计项"""
    category: str  # 分类名称（产品名称或等级名称）
    count: int     # 数量
    leads_ids: List[str]  # 线索ID列表

class LeadsCountResponse(BaseModel):
    """线索统计响应"""
    status: str
    code: int
    message: str
    data: Any  # 可以是列表或字典

@dcc_leads_router.get("/leads/statistics", response_model=LeadsCountResponse)
async def get_leads_statistics(
    filter_by: Optional[str] = Query(None, description="筛选维度：product-按产品，type-按等级，both-按产品和等级，arrive-按是否到店"),
    leads_product: Optional[str] = Query(None, description="线索产品筛选"),
    leads_type: Optional[str] = Query(None, description="线索等级筛选"),
    first_follow_start: Optional[str] = Query(None, description="首次跟进开始时间"),
    first_follow_end: Optional[str] = Query(None, description="首次跟进结束时间"),
    latest_follow_start: Optional[str] = Query(None, description="最近跟进开始时间"),
    latest_follow_end: Optional[str] = Query(None, description="最近跟进结束时间"),
    next_follow_start: Optional[str] = Query(None, description="下次跟进开始时间"),
    next_follow_end: Optional[str] = Query(None, description="下次跟进结束时间"),
    first_arrive_start: Optional[str] = Query(None, description="首次到店开始时间"),
    first_arrive_end: Optional[str] = Query(None, description="首次到店结束时间"),
    is_arrive: Optional[int] = Query(None, description="是否到店：0-否，1-是"),
    token: str = Depends(verify_access_token)
):
    """
    获取线索统计信息，支持多种筛选条件叠加
    
    参数说明：
    - filter_by: 筛选维度（product/type/both/arrive）
    - leads_product: 线索产品筛选
    - leads_type: 线索等级筛选
    - first_follow_start/end: 首次跟进时间区间
    - latest_follow_start/end: 最近跟进时间区间
    - next_follow_start/end: 下次跟进时间区间
    - first_arrive_start/end: 首次到店时间区间
    - is_arrive: 是否到店筛选
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 如果没有指定filter_by，默认返回总数和线索ID列表
        if filter_by is None:
            # 构建查询条件
            where_conditions = []
            params = []
            
            # 组织ID限定（必须）
            user_id = token.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "code": 1003,
                        "message": "令牌中缺少用户ID信息"
                    }
                )
            
            # 从数据库中获取用户的组织ID
            org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
            org_result = execute_query(org_query, (user_id,))
            
            if not org_result or not org_result[0].get('dcc_user_org_id'):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "code": 1003,
                        "message": "用户未绑定组织或组织ID无效"
                    }
                )
            
            dcc_user_org_id = org_result[0]['dcc_user_org_id']
            where_conditions.append("dl.organization_id = %s")
            params.append(dcc_user_org_id)
            
            # 产品筛选
            if leads_product:
                where_conditions.append("dl.leads_product = %s")
                params.append(leads_product)
            
            # 等级筛选
            if leads_type:
                where_conditions.append("dl.leads_type = %s")
                params.append(leads_type)
            
            # 时间区间筛选
            if first_follow_start:
                where_conditions.append("dlf.frist_follow_time >= %s")
                params.append(first_follow_start)
            
            if first_follow_end:
                where_conditions.append("dlf.frist_follow_time <= %s")
                params.append(first_follow_end)
            
            if latest_follow_start:
                where_conditions.append("dlf.new_follow_time >= %s")
                params.append(latest_follow_start)
            
            if latest_follow_end:
                where_conditions.append("dlf.new_follow_time <= %s")
                params.append(latest_follow_end)
            
            if next_follow_start:
                where_conditions.append("dlf.next_follow_time >= %s")
                params.append(next_follow_start)
            
            if next_follow_end:
                where_conditions.append("dlf.next_follow_time <= %s")
                params.append(next_follow_end)
            
            if first_arrive_start:
                where_conditions.append("dlf.frist_arrive_time >= %s")
                params.append(first_arrive_start)
            
            if first_arrive_end:
                where_conditions.append("dlf.frist_arrive_time <= %s")
                params.append(first_arrive_end)
            
            # 是否到店筛选
            if is_arrive is not None:
                where_conditions.append("dlf.is_arrive = %s")
                params.append(is_arrive)
            
            # 构建查询SQL
            query = """
                SELECT DISTINCT dl.leads_id, dlf.is_arrive
                FROM dcc_leads dl
                LEFT JOIN dcc_leads_follow dlf ON dl.leads_id = CAST(dlf.leads_id AS CHAR)
            """
            
            if where_conditions:
                query += " WHERE " + " AND ".join(where_conditions)
            
            # 执行查询
            results = execute_query(query, params)
            
            # 提取线索ID列表
            leads_ids = [str(row['leads_id']) for row in results]
            
            return LeadsCountResponse(
                status="success",
                code=1000,
                message="线索统计获取成功",
                data={
                    "total_count": len(leads_ids),
                    "leads_ids": leads_ids
                }
            )
        
        # 如果指定了filter_by，验证参数
        if filter_by not in ['product', 'type', 'both', 'arrive']:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "filter_by参数必须是 product、type、both 或 arrive"
                }
            )
        
        # 构建查询条件
        where_conditions = []
        params = []
        
        # 组织ID限定（必须）
        user_id = token.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "令牌中缺少用户ID信息"
                }
            )
        
        # 从数据库中获取用户的组织ID
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "用户未绑定组织或组织ID无效"
                }
            )
        
        dcc_user_org_id = org_result[0]['dcc_user_org_id']
        where_conditions.append("dl.organization_id = %s")
        params.append(dcc_user_org_id)
        
        # 产品筛选
        if leads_product:
            where_conditions.append("dl.leads_product = %s")
            params.append(leads_product)
        
        # 等级筛选
        if leads_type:
            where_conditions.append("dl.leads_type = %s")
            params.append(leads_type)
        
        # 时间区间筛选
        if first_follow_start:
            where_conditions.append("dlf.frist_follow_time >= %s")
            params.append(first_follow_start)
        
        if first_follow_end:
            where_conditions.append("dlf.frist_follow_time <= %s")
            params.append(first_follow_end)
        
        if latest_follow_start:
            where_conditions.append("dlf.new_follow_time >= %s")
            params.append(latest_follow_start)
        
        if latest_follow_end:
            where_conditions.append("dlf.new_follow_time <= %s")
            params.append(latest_follow_end)
        
        if next_follow_start:
            where_conditions.append("dlf.next_follow_time >= %s")
            params.append(next_follow_start)
        
        if next_follow_end:
            where_conditions.append("dlf.next_follow_time <= %s")
            params.append(next_follow_end)
        
        if first_arrive_start:
            where_conditions.append("dlf.frist_arrive_time >= %s")
            params.append(first_arrive_start)
        
        if first_arrive_end:
            where_conditions.append("dlf.frist_arrive_time <= %s")
            params.append(first_arrive_end)
        
        # 是否到店筛选
        if is_arrive is not None:
            where_conditions.append("dlf.is_arrive = %s")
            params.append(is_arrive)
        
        # 构建完整查询SQL
        base_query = """
            SELECT DISTINCT
                dl.leads_id,
                dl.leads_product,
                dl.leads_type,
                dlf.frist_follow_time,
                dlf.new_follow_time,
                dlf.next_follow_time,
                dlf.frist_arrive_time,
                dlf.is_arrive
            FROM dcc_leads dl
            LEFT JOIN dcc_leads_follow dlf ON dl.leads_id = CAST(dlf.leads_id AS CHAR)
        """
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # 执行查询
        results = execute_query(base_query, params)
        
        # 按维度统计
        if filter_by == 'product':
            stats = _count_by_product(results)
        elif filter_by == 'type':
            stats = _count_by_type(results)
        elif filter_by == 'arrive':
            stats = _count_by_arrive(results)
        else:  # both
            stats = {
                'by_product': _count_by_product(results),
                'by_type': _count_by_type(results)
            }
        
        return LeadsCountResponse(
            status="success",
            code=1000,
            message="线索统计获取成功",
            data=stats
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"获取线索统计失败: {str(e)}"
            }
        )

@dcc_leads_router.get("/leads/count", response_model=LeadsCountResponse)
async def get_leads_count(
    leads_product: Optional[str] = Query(None, description="线索产品筛选"),
    leads_type: Optional[str] = Query(None, description="线索等级筛选"),
    first_follow_start: Optional[str] = Query(None, description="首次跟进开始时间"),
    first_follow_end: Optional[str] = Query(None, description="首次跟进结束时间"),
    latest_follow_start: Optional[str] = Query(None, description="最近跟进开始时间"),
    latest_follow_end: Optional[str] = Query(None, description="最近跟进结束时间"),
    next_follow_start: Optional[str] = Query(None, description="下次跟进开始时间"),
    next_follow_end: Optional[str] = Query(None, description="下次跟进结束时间"),
    first_arrive_start: Optional[str] = Query(None, description="首次到店开始时间"),
    first_arrive_end: Optional[str] = Query(None, description="首次到店结束时间"),
    is_arrive: Optional[int] = Query(None, description="是否到店：0-否，1-是"),
    token: str = Depends(verify_access_token)
):
    """
    获取符合条件的线索总数和线索ID列表
    
    支持所有筛选条件的叠加使用
    """
    try:
        # 构建查询条件
        where_conditions = []
        params = []
        
        # 组织ID限定（必须）
        user_id = token.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "令牌中缺少用户ID信息"
                }
            )
        
        # 从数据库中获取用户的组织ID
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "用户未绑定组织或组织ID无效"
                }
            )
        
        dcc_user_org_id = org_result[0]['dcc_user_org_id']
        where_conditions.append("dl.organization_id = %s")
        params.append(dcc_user_org_id)
        
        # 产品筛选
        if leads_product:
            where_conditions.append("dl.leads_product = %s")
            params.append(leads_product)
        
        # 等级筛选
        if leads_type:
            where_conditions.append("dl.leads_type = %s")
            params.append(leads_type)
        
        # 时间区间筛选
        if first_follow_start:
            where_conditions.append("dlf.frist_follow_time >= %s")
            params.append(first_follow_start)
        
        if first_follow_end:
            where_conditions.append("dlf.frist_follow_time <= %s")
            params.append(first_follow_end)
        
        if latest_follow_start:
            where_conditions.append("dlf.new_follow_time >= %s")
            params.append(latest_follow_start)
        
        if latest_follow_end:
            where_conditions.append("dlf.new_follow_time <= %s")
            params.append(latest_follow_end)
        
        if next_follow_start:
            where_conditions.append("dlf.next_follow_time >= %s")
            params.append(next_follow_start)
        
        if next_follow_end:
            where_conditions.append("dlf.next_follow_time <= %s")
            params.append(next_follow_end)
        
        if first_arrive_start:
            where_conditions.append("dlf.frist_arrive_time >= %s")
            params.append(first_arrive_start)
        
        if first_arrive_end:
            where_conditions.append("dlf.frist_arrive_time <= %s")
            params.append(first_arrive_end)
        
        # 是否到店筛选
        if is_arrive is not None:
            where_conditions.append("dlf.is_arrive = %s")
            params.append(is_arrive)
        
        # 构建查询SQL
        query = """
            SELECT DISTINCT dl.leads_id, dlf.is_arrive
            FROM dcc_leads dl
            LEFT JOIN dcc_leads_follow dlf ON dl.leads_id = CAST(dlf.leads_id AS CHAR)
        """
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        # 执行查询
        results = execute_query(query, params)
        
        # 提取线索ID列表
        leads_ids = [str(row['leads_id']) for row in results]
        
        return LeadsCountResponse(
            status="success",
            code=1000,
            message="线索统计获取成功",
            data={
                "total_count": len(leads_ids),
                "leads_ids": leads_ids
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"获取线索统计失败: {str(e)}"
            }
        )

def _count_by_product(results: List[Dict]) -> List[LeadsCountItem]:
    """按产品统计线索"""
    product_stats = {}
    
    for row in results:
        product = row['leads_product'] or '未知产品'
        leads_id = str(row['leads_id'])
        
        if product not in product_stats:
            product_stats[product] = {
                'count': 0,
                'leads_ids': []
            }
        
        product_stats[product]['count'] += 1
        if leads_id not in product_stats[product]['leads_ids']:
            product_stats[product]['leads_ids'].append(leads_id)
    
    return [
        LeadsCountItem(
            category=product,
            count=stats['count'],
            leads_ids=stats['leads_ids']
        )
        for product, stats in product_stats.items()
    ]

def _count_by_type(results: List[Dict]) -> List[LeadsCountItem]:
    """按等级统计线索"""
    type_stats = {}
    
    for row in results:
        leads_type = row['leads_type'] or '未知等级'
        leads_id = str(row['leads_id'])
        
        if leads_type not in type_stats:
            type_stats[leads_type] = {
                'count': 0,
                'leads_ids': []
            }
        
        type_stats[leads_type]['count'] += 1
        if leads_id not in type_stats[leads_type]['leads_ids']:
            type_stats[leads_type]['leads_ids'].append(leads_id)
    
    return [
        LeadsCountItem(
            category=leads_type,
            count=stats['count'],
            leads_ids=stats['leads_ids']
        )
        for leads_type, stats in type_stats.items()
    ]

def _count_by_arrive(results: List[Dict]) -> List[LeadsCountItem]:
    """按是否到店统计线索"""
    arrive_stats = {}
    
    for row in results:
        # 从跟进表中获取是否到店信息
        is_arrive = row.get('is_arrive', 0)  # 默认为0（未到店）
        arrive_status = "已到店" if is_arrive == 1 else "未到店"
        leads_id = str(row['leads_id'])
        
        if arrive_status not in arrive_stats:
            arrive_stats[arrive_status] = {
                'count': 0,
                'leads_ids': []
            }
        
        arrive_stats[arrive_status]['count'] += 1
        if leads_id not in arrive_stats[arrive_status]['leads_ids']:
            arrive_stats[arrive_status]['leads_ids'].append(leads_id)
    
    return [
        LeadsCountItem(
            category=arrive_status,
            count=stats['count'],
            leads_ids=stats['leads_ids']
        )
        for arrive_status, stats in arrive_stats.items()
    ]
