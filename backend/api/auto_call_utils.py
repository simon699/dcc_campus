"""
自动外呼任务公共工具函数
"""
import json
from typing import List, Optional, Tuple, Any, Dict
from datetime import datetime
from database.db import execute_query, execute_update


def parse_time_ranges(start_str: Optional[str], end_str: Optional[str]) -> List[Tuple[Optional[str], Optional[str]]]:
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


def get_attr_value(obj, *attr_names, default=None):
    """尝试多个属性名获取值（兼容驼峰和下划线命名）"""
    for attr_name in attr_names:
        if hasattr(obj, attr_name):
            value = getattr(obj, attr_name, default)
            if value is not None:
                return value
        # 尝试通过 getattr 获取属性（处理大小写不敏感）
        try:
            value = getattr(obj, attr_name.lower(), None)
            if value is not None:
                return value
        except:
            pass
    return default


def safe_getattr(obj, *names, default=None):
    """安全获取对象属性（兼容多种命名方式）"""
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name, default)
            if value is not None:
                return value
        try:
            value = getattr(obj, name.lower(), None)
            if value is not None:
                return value
        except:
            pass
    return default


def normalize_interest(value: Any) -> int:
    """标准化意向值：0=无法判断, 1=有意向, 2=无意向"""
    if isinstance(value, int):
        return value if value in (0, 1, 2) else 0
    if isinstance(value, bool):
        return 1 if value else 2
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ('0', '未知', '不确定', '无法判断'):
            return 0
        if v in ('1', 'true', '有意', '有意向'):
            return 1
        if v in ('2', 'false', '无意', '无意向', '没意向', '没有意向'):
            return 2
    return 0


def format_datetime(dt: Any) -> str:
    """格式化日期时间为字符串"""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    if hasattr(dt, 'strftime'):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)


def parse_json_safe(data: Any, default: Any = None) -> Any:
    """安全解析JSON数据"""
    if data is None:
        return default
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            return json.loads(data)
        except:
            return default
    return default


def build_leads_query(size_desc: Any, organization_id: str) -> Tuple[str, List[Any]]:
    """构建线索查询SQL和参数"""
    # 构建基础查询
    base_query = """
        SELECT DISTINCT l.leads_id, l.leads_user_name, l.leads_user_phone 
        FROM dcc_leads l
    """
    
    # 构建WHERE条件
    where_conditions = ["l.organization_id = %s"]
    query_params = [organization_id]
    
    # 添加产品筛选条件
    if size_desc.leads_product:
        leads_product_placeholders = ','.join(['%s'] * len(size_desc.leads_product))
        where_conditions.append(f"l.leads_product IN ({leads_product_placeholders})")
        query_params.extend(size_desc.leads_product)
    
    # 添加等级筛选条件
    if size_desc.leads_type:
        leads_type_placeholders = ','.join(['%s'] * len(size_desc.leads_type))
        where_conditions.append(f"l.leads_type IN ({leads_type_placeholders})")
        query_params.extend(size_desc.leads_type)
    
    # 添加时间筛选条件
    has_time_conditions = (
        size_desc.first_follow_start or size_desc.first_follow_end or 
        size_desc.latest_follow_start or size_desc.latest_follow_end or
        size_desc.next_follow_start or size_desc.next_follow_end or
        size_desc.is_arrive is not None
    )
    
    if has_time_conditions:
        # 需要JOIN dcc_leads_follow表
        base_query = """
            SELECT DISTINCT l.leads_id, l.leads_user_name, l.leads_user_phone 
            FROM dcc_leads l
            LEFT JOIN dcc_leads_follow f ON l.leads_id = f.leads_id
        """
        
        # 解析多时间区间
        first_follow_ranges = parse_time_ranges(size_desc.first_follow_start, size_desc.first_follow_end)
        latest_follow_ranges = parse_time_ranges(size_desc.latest_follow_start, size_desc.latest_follow_end)
        next_follow_ranges = parse_time_ranges(size_desc.next_follow_start, size_desc.next_follow_end)
        
        # 构建时间筛选条件
        time_condition_parts = []
        
        # 首次跟进时间筛选
        if first_follow_ranges:
            first_follow_conditions = []
            for start_time, end_time in first_follow_ranges:
                if start_time and end_time:
                    # 结束时间使用 < DATE_ADD(end_time, INTERVAL 1 DAY) 来匹配该日期的所有时间
                    first_follow_conditions.append("(f.frist_follow_time >= %s AND f.frist_follow_time < DATE_ADD(%s, INTERVAL 1 DAY))")
                    query_params.extend([start_time, end_time])
                elif start_time:
                    first_follow_conditions.append("f.frist_follow_time >= %s")
                    query_params.append(start_time)
                elif end_time:
                    first_follow_conditions.append("f.frist_follow_time < DATE_ADD(%s, INTERVAL 1 DAY)")
                    query_params.append(end_time)
            if first_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(first_follow_conditions)})")
        
        # 最近跟进时间筛选
        if latest_follow_ranges:
            latest_follow_conditions = []
            for start_time, end_time in latest_follow_ranges:
                if start_time and end_time:
                    # 结束时间使用 < DATE_ADD(end_time, INTERVAL 1 DAY) 来匹配该日期的所有时间
                    latest_follow_conditions.append("(f.new_follow_time >= %s AND f.new_follow_time < DATE_ADD(%s, INTERVAL 1 DAY))")
                    query_params.extend([start_time, end_time])
                elif start_time:
                    latest_follow_conditions.append("f.new_follow_time >= %s")
                    query_params.append(start_time)
                elif end_time:
                    latest_follow_conditions.append("f.new_follow_time < DATE_ADD(%s, INTERVAL 1 DAY)")
                    query_params.append(end_time)
            if latest_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(latest_follow_conditions)})")
        
        # 下次跟进时间筛选
        if next_follow_ranges:
            next_follow_conditions = []
            for start_time, end_time in next_follow_ranges:
                if start_time and end_time:
                    # 结束时间使用 < DATE_ADD(end_time, INTERVAL 1 DAY) 来匹配该日期的所有时间
                    next_follow_conditions.append("(f.next_follow_time >= %s AND f.next_follow_time < DATE_ADD(%s, INTERVAL 1 DAY))")
                    query_params.extend([start_time, end_time])
                elif start_time:
                    next_follow_conditions.append("f.next_follow_time >= %s")
                    query_params.append(start_time)
                elif end_time:
                    next_follow_conditions.append("f.next_follow_time < DATE_ADD(%s, INTERVAL 1 DAY)")
                    query_params.append(end_time)
            if next_follow_conditions:
                time_condition_parts.append(f"({' OR '.join(next_follow_conditions)})")
        
        # 是否到店筛选
        if size_desc.is_arrive:
            placeholders = ','.join(['%s'] * len(size_desc.is_arrive))
            time_condition_parts.append(f"f.is_arrive IN ({placeholders})")
            query_params.extend(size_desc.is_arrive)
        
        # 添加时间筛选条件到WHERE条件中
        if time_condition_parts:
            where_conditions.append(" AND ".join(time_condition_parts))
    
    # 构建完整的查询语句
    leads_query = f"{base_query} WHERE {' AND '.join(where_conditions)}"
    return leads_query, query_params


def validate_user_token(token: Dict[str, Any]) -> Tuple[str, str]:
    """验证用户token并返回user_id和organization_id"""
    user_id = token.get("user_id")
    if not user_id:
        raise ValueError("令牌中缺少用户ID信息")
    
    org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
    org_result = execute_query(org_query, (user_id,))
    
    if not org_result or not org_result[0].get('dcc_user_org_id'):
        raise ValueError("用户未绑定组织或组织ID无效")
    
    organization_id = org_result[0]['dcc_user_org_id']
    return user_id, organization_id


def validate_user_token_with_username(token: Dict[str, Any]) -> Tuple[str, str, str]:
    """验证用户token并返回user_id、organization_id和username"""
    user_id = token.get("user_id")
    if not user_id:
        raise ValueError("令牌中缺少用户ID信息")
    
    org_query = "SELECT dcc_user_org_id, username FROM users WHERE id = %s"
    org_result = execute_query(org_query, (user_id,))
    
    if not org_result or not org_result[0].get('dcc_user_org_id'):
        raise ValueError("用户未绑定组织或组织ID无效")
    
    organization_id = org_result[0]['dcc_user_org_id']
    username = org_result[0].get('username', '')
    return user_id, organization_id, username

