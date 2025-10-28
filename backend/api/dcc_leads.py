from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import os
import pandas as pd
import tempfile
from database.db import execute_query, execute_update
from .auth import verify_access_token

dcc_leads_router = APIRouter(tags=["线索管理"])

# 系统常量配置
ARRIVE_STATUS_CONSTANTS = {
    "ARRIVED": os.getenv("ARRIVE_STATUS_ARRIVED", "已到店"),
    "NOT_ARRIVED": os.getenv("ARRIVE_STATUS_NOT_ARRIVED", "未到店")
}

class LeadsFilter(BaseModel):
    """线索筛选条件"""
    leads_product: Optional[List[str]] = None  # 线索产品（支持多选）
    leads_type: Optional[List[str]] = None     # 线索等级（支持多选）
    first_follow_start: Optional[str] = None  # 首次跟进开始时间
    first_follow_end: Optional[str] = None    # 首次跟进结束时间
    latest_follow_start: Optional[str] = None # 最近跟进开始时间
    latest_follow_end: Optional[str] = None   # 最近跟进结束时间
    next_follow_start: Optional[str] = None   # 下次跟进开始时间
    next_follow_end: Optional[str] = None     # 下次跟进结束时间
    first_arrive_start: Optional[str] = None  # 首次到店开始时间
    first_arrive_end: Optional[str] = None    # 首次到店结束时间
    is_arrive: Optional[List[int]] = None     # 是否到店：0-否，1-是（支持多选）

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

class LeadsImportResponse(BaseModel):
    """线索导入响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

@dcc_leads_router.get("/leads/statistics", response_model=LeadsCountResponse)
async def get_leads_statistics(
    filter_by: Optional[str] = Query(None, description="筛选维度：product-按产品，type-按等级，both-按产品和等级，arrive-按是否到店"),
    leads_product: Optional[str] = Query(None, description="线索产品筛选，多个值用逗号分隔，如：产品1,产品2,产品3"),
    leads_type: Optional[str] = Query(None, description="线索等级筛选，多个值用逗号分隔，如：等级1,等级2,等级3"),
    first_follow_start: Optional[str] = Query(None, description="首次跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_follow_end: Optional[str] = Query(None, description="首次跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    latest_follow_start: Optional[str] = Query(None, description="最近跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    latest_follow_end: Optional[str] = Query(None, description="最近跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    next_follow_start: Optional[str] = Query(None, description="下次跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    next_follow_end: Optional[str] = Query(None, description="下次跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_arrive_start: Optional[str] = Query(None, description="首次到店开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_arrive_end: Optional[str] = Query(None, description="首次到店结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    is_arrive: Optional[str] = Query(None, description="是否到店筛选，多个值用逗号分隔，如：0,1（0-否，1-是）"),
    token: str = Depends(verify_access_token)
):
    """
    获取线索统计信息，支持多种筛选条件叠加
    
    筛选逻辑：
    - 同一个筛选项的多个值之间是"或"的关系（如：产品A和B，则查询A或B的）
    - 不同筛选项之间是"且"的关系（如：产品A和B，同时等级N和H，则视为满足A&N、A&H、B&N、B&H都可以）
    - 时间开始和结束算一个筛选项
    - 最终去重计算数量和返回
    
    参数说明：
    - filter_by: 筛选维度（product/type/both/arrive）
    - leads_product: 线索产品筛选，支持多选，多个值用逗号分隔
    - leads_type: 线索等级筛选，支持多选，多个值用逗号分隔
    - first_follow_start/end: 首次跟进时间区间，支持多区间，格式：开始时间,结束时间;开始时间,结束时间
    - latest_follow_start/end: 最近跟进时间区间，支持多区间，格式：开始时间,结束时间;开始时间,结束时间
    - next_follow_start/end: 下次跟进时间区间，支持多区间，格式：开始时间,结束时间;开始时间,结束时间
    - first_arrive_start/end: 首次到店时间区间，支持多区间，格式：开始时间,结束时间;开始时间,结束时间
    - is_arrive: 是否到店筛选，支持多选，多个值用逗号分隔
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 解析多选参数
        leads_product_list = _parse_multi_values(leads_product)
        leads_type_list = _parse_multi_values(leads_type)
        is_arrive_list = _parse_multi_int_values(is_arrive)
        
        # 解析多时间区间参数
        first_follow_ranges = _parse_time_ranges(first_follow_start, first_follow_end)
        latest_follow_ranges = _parse_time_ranges(latest_follow_start, latest_follow_end)
        next_follow_ranges = _parse_time_ranges(next_follow_start, next_follow_end)
        first_arrive_ranges = _parse_time_ranges(first_arrive_start, first_arrive_end)
        
        # 获取用户组织ID
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
        
        # 构建基础查询条件（组织ID限定）
        base_conditions = ["dl.organization_id = %s"]
        base_params = [dcc_user_org_id]
        
        # 构建筛选条件
        filter_conditions = []
        filter_params = []
        
        # 产品筛选条件（同一筛选项多值为"或"关系）
        if leads_product_list:
            placeholders = ','.join(['%s'] * len(leads_product_list))
            filter_conditions.append(f"dl.leads_product IN ({placeholders})")
            filter_params.extend(leads_product_list)
        
        # 等级筛选条件（同一筛选项多值为"或"关系）
        if leads_type_list:
            placeholders = ','.join(['%s'] * len(leads_type_list))
            filter_conditions.append(f"dl.leads_type IN ({placeholders})")
            filter_params.extend(leads_type_list)
        
        # 时间筛选条件（时间开始和结束算一个筛选项，多区间为"或"关系）
        time_condition_parts = []
        time_params = []
        
        if first_follow_ranges:
            first_follow_conditions = []
            for start_time, end_time in first_follow_ranges:
                if start_time and end_time:
                    first_follow_conditions.append("(dlf.frist_follow_time >= %s AND dlf.frist_follow_time <= %s)")
                    time_params.extend([start_time, end_time])
                elif start_time:
                    first_follow_conditions.append("dlf.frist_follow_time >= %s")
                    time_params.append(start_time)
                elif end_time:
                    first_follow_conditions.append("dlf.frist_follow_time <= %s")
                    time_params.append(end_time)
            if first_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(first_follow_conditions)})")
        
        if latest_follow_ranges:
            latest_follow_conditions = []
            for start_time, end_time in latest_follow_ranges:
                if start_time and end_time:
                    latest_follow_conditions.append("(dlf.new_follow_time >= %s AND dlf.new_follow_time <= %s)")
                    time_params.extend([start_time, end_time])
                elif start_time:
                    latest_follow_conditions.append("dlf.new_follow_time >= %s")
                    time_params.append(start_time)
                elif end_time:
                    latest_follow_conditions.append("dlf.new_follow_time <= %s")
                    time_params.append(end_time)
            if latest_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(latest_follow_conditions)})")
        
        if next_follow_ranges:
            next_follow_conditions = []
            for start_time, end_time in next_follow_ranges:
                if start_time and end_time:
                    next_follow_conditions.append("(dlf.next_follow_time >= %s AND dlf.next_follow_time <= %s)")
                    time_params.extend([start_time, end_time])
                elif start_time:
                    next_follow_conditions.append("dlf.next_follow_time >= %s")
                    time_params.append(start_time)
                elif end_time:
                    next_follow_conditions.append("dlf.next_follow_time <= %s")
                    time_params.append(end_time)
            if next_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(next_follow_conditions)})")
        
        if first_arrive_ranges:
            first_arrive_conditions = []
            for start_time, end_time in first_arrive_ranges:
                if start_time and end_time:
                    first_arrive_conditions.append("(dlf.frist_arrive_time >= %s AND dlf.frist_arrive_time <= %s)")
                    time_params.extend([start_time, end_time])
                elif start_time:
                    first_arrive_conditions.append("dlf.frist_arrive_time >= %s")
                    time_params.append(start_time)
                elif end_time:
                    first_arrive_conditions.append("dlf.frist_arrive_time <= %s")
                    time_params.append(end_time)
            if first_arrive_conditions:
                time_condition_parts.append(f"({' OR '.join(first_arrive_conditions)})")
        
        # 如果有时间条件，作为一个筛选项添加到筛选条件中
        if time_condition_parts:
            filter_conditions.append(" AND ".join(time_condition_parts))
            filter_params.extend(time_params)
        
        # 是否到店筛选条件（同一筛选项多值为"或"关系）
        if is_arrive_list:
            placeholders = ','.join(['%s'] * len(is_arrive_list))
            filter_conditions.append(f"dlf.is_arrive IN ({placeholders})")
            filter_params.extend(is_arrive_list)
        
        # 构建完整查询条件（不同筛选项之间是"且"关系）
        all_conditions = base_conditions + filter_conditions
        all_params = base_params + filter_params
        
        # 构建查询SQL
        query = """
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
        
        if all_conditions:
            query += " WHERE " + " AND ".join(all_conditions)
        
        # 执行查询
        results = execute_query(query, all_params)
        
        # 提取线索ID列表（去重）
        leads_ids = list(set([str(row['leads_id']) for row in results]))
        
        # 如果没有指定filter_by，返回总数和线索ID列表
        if filter_by is None:
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
    leads_product: Optional[str] = Query(None, description="线索产品筛选，多个值用逗号分隔，如：产品1,产品2,产品3"),
    leads_type: Optional[str] = Query(None, description="线索等级筛选，多个值用逗号分隔，如：等级1,等级2,等级3"),
    first_follow_start: Optional[str] = Query(None, description="首次跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_follow_end: Optional[str] = Query(None, description="首次跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    latest_follow_start: Optional[str] = Query(None, description="最近跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    latest_follow_end: Optional[str] = Query(None, description="最近跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    next_follow_start: Optional[str] = Query(None, description="下次跟进开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    next_follow_end: Optional[str] = Query(None, description="下次跟进结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_arrive_start: Optional[str] = Query(None, description="首次到店开始时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    first_arrive_end: Optional[str] = Query(None, description="首次到店结束时间，多个区间用分号分隔，如：2024-01-01,2024-01-31;2024-03-01,2024-03-31"),
    is_arrive: Optional[str] = Query(None, description="是否到店筛选，多个值用逗号分隔，如：0,1（0-否，1-是）"),
    token: str = Depends(verify_access_token)
):
    """
    获取符合条件的线索总数和线索ID列表
    
    支持所有筛选条件的叠加使用，支持多选筛选和多时间区间筛选
    """
    try:
        # 解析多选参数
        leads_product_list = _parse_multi_values(leads_product)
        leads_type_list = _parse_multi_values(leads_type)
        is_arrive_list = _parse_multi_int_values(is_arrive)
        
        # 解析多时间区间参数
        first_follow_ranges = _parse_time_ranges(first_follow_start, first_follow_end)
        latest_follow_ranges = _parse_time_ranges(latest_follow_start, latest_follow_end)
        next_follow_ranges = _parse_time_ranges(next_follow_start, next_follow_end)
        first_arrive_ranges = _parse_time_ranges(first_arrive_start, first_arrive_end)
        
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
        
        # 产品筛选（支持多选）
        if leads_product_list:
            placeholders = ','.join(['%s'] * len(leads_product_list))
            where_conditions.append(f"dl.leads_product IN ({placeholders})")
            params.extend(leads_product_list)
        
        # 等级筛选（支持多选）
        if leads_type_list:
            placeholders = ','.join(['%s'] * len(leads_type_list))
            where_conditions.append(f"dl.leads_type IN ({placeholders})")
            params.extend(leads_type_list)
        
        # 时间区间筛选（支持多区间）
        if first_follow_ranges:
            first_follow_conditions = []
            for start_time, end_time in first_follow_ranges:
                if start_time and end_time:
                    first_follow_conditions.append("(dlf.frist_follow_time >= %s AND dlf.frist_follow_time <= %s)")
                    params.extend([start_time, end_time])
                elif start_time:
                    first_follow_conditions.append("dlf.frist_follow_time >= %s")
                    params.append(start_time)
                elif end_time:
                    first_follow_conditions.append("dlf.frist_follow_time <= %s")
                    params.append(end_time)
            if first_follow_conditions:
                where_conditions.append(f"({' OR '.join(first_follow_conditions)})")
        
        if latest_follow_ranges:
            latest_follow_conditions = []
            for start_time, end_time in latest_follow_ranges:
                if start_time and end_time:
                    latest_follow_conditions.append("(dlf.new_follow_time >= %s AND dlf.new_follow_time <= %s)")
                    params.extend([start_time, end_time])
                elif start_time:
                    latest_follow_conditions.append("dlf.new_follow_time >= %s")
                    params.append(start_time)
                elif end_time:
                    latest_follow_conditions.append("dlf.new_follow_time <= %s")
                    params.append(end_time)
            if latest_follow_conditions:
                where_conditions.append(f"({' OR '.join(latest_follow_conditions)})")
        
        if next_follow_ranges:
            next_follow_conditions = []
            for start_time, end_time in next_follow_ranges:
                if start_time and end_time:
                    next_follow_conditions.append("(dlf.next_follow_time >= %s AND dlf.next_follow_time <= %s)")
                    params.extend([start_time, end_time])
                elif start_time:
                    next_follow_conditions.append("dlf.next_follow_time >= %s")
                    params.append(start_time)
                elif end_time:
                    next_follow_conditions.append("dlf.next_follow_time <= %s")
                    params.append(end_time)
            if next_follow_conditions:
                where_conditions.append(f"({' OR '.join(next_follow_conditions)})")
        
        if first_arrive_ranges:
            first_arrive_conditions = []
            for start_time, end_time in first_arrive_ranges:
                if start_time and end_time:
                    first_arrive_conditions.append("(dlf.frist_arrive_time >= %s AND dlf.frist_arrive_time <= %s)")
                    params.extend([start_time, end_time])
                elif start_time:
                    first_arrive_conditions.append("dlf.frist_arrive_time >= %s")
                    params.append(start_time)
                elif end_time:
                    first_arrive_conditions.append("dlf.frist_arrive_time <= %s")
                    params.append(end_time)
            if first_arrive_conditions:
                where_conditions.append(f"({' OR '.join(first_arrive_conditions)})")
        
        # 是否到店筛选（支持多选）
        if is_arrive_list:
            placeholders = ','.join(['%s'] * len(is_arrive_list))
            where_conditions.append(f"dlf.is_arrive IN ({placeholders})")
            params.extend(is_arrive_list)
        
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
        
        # 只统计不重复的线索ID
        if leads_id not in product_stats[product]['leads_ids']:
            product_stats[product]['leads_ids'].append(leads_id)
            product_stats[product]['count'] += 1
    
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
        
        # 只统计不重复的线索ID
        if leads_id not in type_stats[leads_type]['leads_ids']:
            type_stats[leads_type]['leads_ids'].append(leads_id)
            type_stats[leads_type]['count'] += 1
    
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
        arrive_status = ARRIVE_STATUS_CONSTANTS["ARRIVED"] if is_arrive == 1 else ARRIVE_STATUS_CONSTANTS["NOT_ARRIVED"]
        leads_id = str(row['leads_id'])
        
        if arrive_status not in arrive_stats:
            arrive_stats[arrive_status] = {
                'count': 0,
                'leads_ids': []
            }
        
        # 只统计不重复的线索ID
        if leads_id not in arrive_stats[arrive_status]['leads_ids']:
            arrive_stats[arrive_status]['leads_ids'].append(leads_id)
            arrive_stats[arrive_status]['count'] += 1
    
    return [
        LeadsCountItem(
            category=arrive_status,
            count=stats['count'],
            leads_ids=stats['leads_ids']
        )
        for arrive_status, stats in arrive_stats.items()
    ]

def _parse_multi_values(value_str: Optional[str]) -> List[str]:
    """解析多选字符串参数"""
    if not value_str:
        return []
    return [v.strip() for v in value_str.split(',') if v.strip()]

def _parse_multi_int_values(value_str: Optional[str]) -> List[int]:
    """解析多选整数参数"""
    if not value_str:
        return []
    try:
        return [int(v.strip()) for v in value_str.split(',') if v.strip()]
    except ValueError:
        return []

def _parse_time_ranges(start_str: Optional[str], end_str: Optional[str]) -> List[tuple]:
    """解析多时间区间参数"""
    if not start_str and not end_str:
        return []
    
    # 如果只有一个参数，按原来的逻辑处理
    if start_str and not end_str:
        return [(start_str, None)]
    elif end_str and not start_str:
        return [(None, end_str)]
    
    # 解析多个区间
    start_ranges = start_str.split(';') if start_str else [None]
    end_ranges = end_str.split(';') if end_str else [None]
    
    # 确保两个列表长度一致
    max_len = max(len(start_ranges), len(end_ranges))
    start_ranges.extend([None] * (max_len - len(start_ranges)))
    end_ranges.extend([None] * (max_len - len(end_ranges)))
    
    time_ranges = []
    for start_range, end_range in zip(start_ranges, end_ranges):
        if start_range or end_range:
            # 处理单个区间内的开始和结束时间
            if start_range and ',' in start_range:
                start_parts = start_range.split(',')
                start_time = start_parts[0].strip() if start_parts[0].strip() else None
            else:
                start_time = start_range.strip() if start_range else None
            
            if end_range and ',' in end_range:
                end_parts = end_range.split(',')
                end_time = end_parts[1].strip() if len(end_parts) > 1 and end_parts[1].strip() else None
            else:
                end_time = end_range.strip() if end_range else None
            
            if start_time or end_time:
                time_ranges.append((start_time, end_time))
    
    return time_ranges

@dcc_leads_router.post("/leads/import", response_model=LeadsImportResponse)
async def import_leads_from_excel(
    file: UploadFile = File(..., description="Excel文件，支持.xlsx和.xls格式"),
    token: str = Depends(verify_access_token)
):
    """
    通过Excel文件导入线索数据
    
    支持的Excel列名：
    - leads_id: 线索ID（必填，唯一标识）
    - leads_user_name: 客户姓名
    - leads_user_phone: 客户电话
    - leads_product: 线索产品
    - leads_type: 线索等级
    - organization_id: 组织ID（可选，默认使用用户所属组织）
    - leads_create_time: 线索创建时间（可选，默认当前时间）
    
    导入规则：
    - 如果leads_id已存在，则跳过该条记录
    - 所有字段都会进行数据验证和清理
    - 支持批量导入，返回详细的导入统计信息
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 验证文件类型
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "只支持Excel文件格式(.xlsx, .xls)"
                }
            )
        
        # 获取用户组织ID
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
        
        default_organization_id = org_result[0]['dcc_user_org_id']
        
        # 读取上传的文件
        file_content = await file.read()
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        try:
            # 读取Excel文件
            df = pd.read_excel(temp_file_path)
            
            # 验证必要的列是否存在
            required_columns = ['leads_id']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "status": "error",
                        "code": 1003,
                        "message": f"Excel文件缺少必要的列: {', '.join(missing_columns)}"
                    }
                )
            
            # 字段映射 - Excel列名 -> 数据库字段名
            field_mapping = {
                'leads_id': 'leads_id',
                'leads_user_name': 'leads_user_name',
                'leads_user_phone': 'leads_user_phone',
                'leads_product': 'leads_product',
                'leads_type': 'leads_type',
                'organization_id': 'organization_id',
                'leads_create_time': 'leads_create_time'
            }
            
            success_count = 0
            error_count = 0
            skipped_count = 0
            errors = []
            imported_leads = []
            
            for idx, row in df.iterrows():
                try:
                    # 检查leads_id是否为空
                    leads_id = str(row['leads_id']).strip() if pd.notna(row['leads_id']) else ''
                    if not leads_id:
                        errors.append(f'第{idx + 1}行: leads_id不能为空')
                        error_count += 1
                        continue
                    
                    # 检查是否已存在相同的leads_id
                    existing = execute_query('SELECT id FROM dcc_leads WHERE leads_id = %s', (leads_id,))
                    
                    if existing:
                        errors.append(f'第{idx + 1}行: leads_id {leads_id} 已存在，跳过')
                        skipped_count += 1
                        continue
                    
                    # 准备插入数据
                    insert_data = {
                        'leads_id': leads_id,
                        'leads_user_name': str(row['leads_user_name']).strip() if pd.notna(row.get('leads_user_name')) else '',
                        'leads_user_phone': str(row['leads_user_phone']).strip() if pd.notna(row.get('leads_user_phone')) else '',
                        'leads_product': str(row['leads_product']).strip() if pd.notna(row.get('leads_product')) else '',
                        'leads_type': str(row['leads_type']).strip() if pd.notna(row.get('leads_type')) else '',
                        'organization_id': str(row['organization_id']).strip() if pd.notna(row.get('organization_id')) else default_organization_id,
                        'leads_create_time': row['leads_create_time'] if pd.notna(row.get('leads_create_time')) else datetime.now()
                    }
                    
                    # 插入数据
                    insert_sql = '''
                    INSERT INTO dcc_leads 
                    (organization_id, leads_id, leads_user_name, leads_user_phone, leads_create_time, leads_product, leads_type)
                    VALUES (%(organization_id)s, %(leads_id)s, %(leads_user_name)s, %(leads_user_phone)s, %(leads_create_time)s, %(leads_product)s, %(leads_type)s)
                    '''
                    
                    result = execute_update(insert_sql, insert_data)
                    success_count += 1
                    imported_leads.append({
                        'leads_id': insert_data['leads_id'],
                        'leads_user_name': insert_data['leads_user_name'],
                        'leads_user_phone': insert_data['leads_user_phone']
                    })
                    
                except Exception as e:
                    error_msg = f'第{idx + 1}行导入失败: {str(e)}'
                    errors.append(error_msg)
                    error_count += 1
            
            # 返回导入结果
            result_data = {
                'success_count': success_count,
                'error_count': error_count,
                'skipped_count': skipped_count,
                'total_rows': len(df),
                'imported_leads': imported_leads[:10],  # 只返回前10条导入的线索信息
                'errors': errors[:20]  # 只返回前20个错误信息
            }
            
            if success_count > 0:
                return LeadsImportResponse(
                    status="success",
                    code=1000,
                    message=f"导入完成: 成功 {success_count} 条, 失败 {error_count} 条, 跳过 {skipped_count} 条",
                    data=result_data
                )
            else:
                return LeadsImportResponse(
                    status="error",
                    code=1002,
                    message=f"导入失败: 没有成功导入任何线索",
                    data=result_data
                )
                
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 1002,
                "message": f"导入过程失败: {str(e)}"
            }
        )
