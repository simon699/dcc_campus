#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DCC线索数据Excel导入脚本
支持从Excel文件导入线索数据到dcc_leads表

处理逻辑：
1. 如果Excel中有leads_id字段且不为空，直接使用该值
2. 如果leads_id为空或不存在，则使用数据库自增的id作为leads_id
3. 自动检查leads_id重复，避免重复导入
"""

import pandas as pd
import sys
import os
from datetime import datetime
from database.db import execute_update, execute_query

def import_leads_from_excel(excel_file_path, organization_id='ORG001'):
    """
    从Excel文件导入线索数据
    
    Args:
        excel_file_path: Excel文件路径
        organization_id: 组织ID，默认为ORG001
    
    Returns:
        dict: 导入结果统计
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(excel_file_path):
            return {
                'success': False,
                'message': f'文件不存在: {excel_file_path}',
                'success_count': 0,
                'error_count': 0
            }
        
        # 读取Excel文件
        df = pd.read_excel(excel_file_path)
        
        print(f'读取Excel文件: {excel_file_path}')
        print(f'数据行数: {len(df)}')
        print(f'列名: {list(df.columns)}')
        
        # 字段映射 - Excel列名 -> 数据库字段名（根据dcc_leads.sql文件）
        field_mapping = {
            'id': 'id',
            'organization_id': 'organization_id', 
            'leads_id': 'leads_id',
            'leads_user_name': 'leads_user_name',
            'leads_user_phone': 'leads_user_phone',
            'leads_create_time': 'leads_create_time',
            'leads_product': 'leads_product',
            'leads_type': 'leads_type'
        }
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # 处理leads_id字段
                leads_id = None
                if pd.notna(row['leads_id']) and str(row['leads_id']).strip():
                    leads_id = str(row['leads_id']).strip()
                    # 检查是否已存在相同的leads_id
                    existing = execute_query('SELECT id FROM dcc_leads WHERE leads_id = %s', (leads_id,))
                    if existing:
                        print(f'跳过行 {idx + 1}: leads_id {leads_id} 已存在')
                        skipped_count += 1
                        continue
                
                # 准备基础插入数据
                base_insert_data = {
                    'leads_user_name': str(row['leads_user_name']) if pd.notna(row['leads_user_name']) else '',
                    'leads_user_phone': str(row['leads_user_phone']) if pd.notna(row['leads_user_phone']) else '',
                    'leads_product': str(row['leads_product']) if pd.notna(row['leads_product']) else '',
                    'leads_type': str(row['leads_type']) if pd.notna(row['leads_type']) else '',
                    'organization_id': str(row['organization_id']) if pd.notna(row['organization_id']) else organization_id,
                    'leads_create_time': row['leads_create_time'] if pd.notna(row['leads_create_time']) else datetime.now()
                }
                
                if leads_id:
                    # 如果有leads_id，直接插入
                    insert_data = base_insert_data.copy()
                    insert_data['leads_id'] = leads_id
                    
                    insert_sql = '''
                    INSERT INTO dcc_leads 
                    (organization_id, leads_id, leads_user_name, leads_user_phone, leads_create_time, leads_product, leads_type)
                    VALUES (%(organization_id)s, %(leads_id)s, %(leads_user_name)s, %(leads_user_phone)s, %(leads_create_time)s, %(leads_product)s, %(leads_type)s)
                    '''
                    
                    result = execute_update(insert_sql, insert_data)
                    final_leads_id = leads_id
                else:
                    # 如果没有leads_id，先插入数据获取自增ID
                    insert_sql_without_leads_id = '''
                    INSERT INTO dcc_leads 
                    (organization_id, leads_user_name, leads_user_phone, leads_create_time, leads_product, leads_type)
                    VALUES (%(organization_id)s, %(leads_user_name)s, %(leads_user_phone)s, %(leads_create_time)s, %(leads_product)s, %(leads_type)s)
                    '''
                    
                    result = execute_update(insert_sql_without_leads_id, base_insert_data)
                    
                    # 使用自增ID作为leads_id
                    final_leads_id = str(result)
                    
                    # 更新leads_id字段
                    update_sql = "UPDATE dcc_leads SET leads_id = %s WHERE id = %s"
                    execute_update(update_sql, (final_leads_id, result))
                    
                    print(f'行 {idx + 1}: 使用自增ID {result} 作为 leads_id')
                
                print(f'成功导入行 {idx + 1}: ID {result}, leads_id {final_leads_id}, 姓名: {base_insert_data["leads_user_name"]}, 电话: {base_insert_data["leads_user_phone"]}')
                success_count += 1
                
            except Exception as e:
                error_msg = f'导入行 {idx + 1} 失败: {str(e)}'
                print(error_msg)
                errors.append(error_msg)
                error_count += 1
        
        # 返回导入结果
        result = {
            'success': True,
            'message': f'导入完成: 成功 {success_count} 条, 失败 {error_count} 条, 跳过 {skipped_count} 条',
            'success_count': success_count,
            'error_count': error_count,
            'skipped_count': skipped_count,
            'errors': errors
        }
        
        print(f'\n导入结果: {result["message"]}')
        
        # 查询导入后的总数据量
        total_count = execute_query('SELECT COUNT(*) as count FROM dcc_leads')
        print(f'数据库中总共有 {total_count[0]["count"]} 条线索记录')
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'message': f'导入过程失败: {str(e)}',
            'success_count': 0,
            'error_count': 0,
            'errors': [str(e)]
        }

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print('使用方法: python import_leads.py <excel_file_path> [organization_id]')
        print('示例: python import_leads.py ../dcc_leads.xlsx ORG001')
        return
    
    excel_file = sys.argv[1]
    organization_id = sys.argv[2] if len(sys.argv) > 2 else 'ORG001'
    
    result = import_leads_from_excel(excel_file, organization_id)
    
    if result['success']:
        print(f'\n✅ 导入成功!')
    else:
        print(f'\n❌ 导入失败: {result["message"]}')

if __name__ == '__main__':
    main()
