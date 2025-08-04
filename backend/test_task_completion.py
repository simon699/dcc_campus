#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试任务完成状态自动检查功能
"""

import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.db import execute_query, execute_update
from api.auto_call import check_and_update_task_completion

async def test_task_completion():
    """
    测试任务完成状态自动检查功能
    """
    print("开始测试任务完成状态自动检查功能...")
    
    # 1. 创建一个测试任务
    print("\n1. 创建测试任务...")
    test_task_query = """
        INSERT INTO call_tasks 
        (task_name, organization_id, create_name_id, create_name, create_time, leads_count, script_id, task_type, size_desc)
        VALUES 
        ('测试任务-自动完成检查', 'test_org_001', 'test_user_001', '测试用户', NOW(), 3, 'test_script_001', 2, '{}')
    """
    execute_update(test_task_query)
    
    # 获取刚创建的任务ID
    task_id_query = """
        SELECT id FROM call_tasks 
        WHERE task_name = '测试任务-自动完成检查' 
        ORDER BY create_time DESC 
        LIMIT 1
    """
    task_result = execute_query(task_id_query)
    if not task_result:
        print("❌ 创建测试任务失败")
        return
    
    task_id = task_result[0]['id']
    print(f"✅ 创建测试任务成功，任务ID: {task_id}")
    
    # 2. 创建测试线索
    print("\n2. 创建测试线索...")
    test_leads_query = """
        INSERT INTO dcc_leads 
        (leads_user_name, leads_user_phone, organization_id, leads_id, leads_product, leads_type)
        VALUES 
        ('测试线索1', '13800138001', 'test_org_001', 'test_lead_001', '测试产品', 'A级'),
        ('测试线索2', '13800138002', 'test_org_001', 'test_lead_002', '测试产品', 'A级'),
        ('测试线索3', '13800138003', 'test_org_001', 'test_lead_003', '测试产品', 'A级')
    """
    execute_update(test_leads_query)
    
    # 获取刚创建的线索ID
    leads_query = """
        SELECT id FROM dcc_leads 
        WHERE leads_user_name LIKE '测试线索%' 
        ORDER BY leads_create_time DESC 
        LIMIT 3
    """
    leads_result = execute_query(leads_query)
    if len(leads_result) < 3:
        print("❌ 创建测试线索失败")
        return
    
    lead_ids = [lead['id'] for lead in leads_result]
    print(f"✅ 创建测试线索成功，线索ID: {lead_ids}")
    
    # 3. 创建任务明细
    print("\n3. 创建任务明细...")
    for i, lead_id in enumerate(lead_ids):
        # 获取线索信息
        lead_info_query = """
            SELECT leads_user_name, leads_user_phone FROM dcc_leads WHERE id = %s
        """
        lead_info_result = execute_query(lead_info_query, (lead_id,))
        if not lead_info_result:
            print(f"❌ 获取线索信息失败: {lead_id}")
            continue
            
        lead_info = lead_info_result[0]
        task_detail_query = """
            INSERT INTO leads_task_list 
            (task_id, leads_id, leads_name, leads_phone, call_type, call_time, call_job_id, call_id, call_user_id, call_conversation)
            VALUES 
            (%s, %s, %s, %s, 0, NOW(), 'test_job_%s', 'test_call_%s', 'test_user_001', '{}')
        """
        execute_update(task_detail_query, (
            task_id, lead_id, lead_info['leads_user_name'], lead_info['leads_user_phone'], 
            f'{i+1}', f'{i+1}'
        ))
    
    print("✅ 创建任务明细成功")
    
    # 4. 创建外呼记录（部分接通）
    print("\n4. 创建外呼记录（部分接通）...")
    job_group_id = "test_job_group_001"
    
    # 第一个线索：已接通
    call_record1_query = """
        INSERT INTO outbound_call_records 
        (job_group_id, job_id, lead_id, phone, call_status, call_duration, call_result, call_time)
        VALUES 
        (%s, 'test_job_1', %s, '13800138001', 'Connected', 120, '通话成功', NOW())
    """
    execute_update(call_record1_query, (job_group_id, lead_ids[0]))
    
    # 第二个线索：已接通
    call_record2_query = """
        INSERT INTO outbound_call_records 
        (job_group_id, job_id, lead_id, phone, call_status, call_duration, call_result, call_time)
        VALUES 
        (%s, 'test_job_2', %s, '13800138002', 'Succeeded', 180, '通话成功', NOW())
    """
    execute_update(call_record2_query, (job_group_id, lead_ids[1]))
    
    # 第三个线索：未接通
    call_record3_query = """
        INSERT INTO outbound_call_records 
        (job_group_id, job_id, lead_id, phone, call_status, call_duration, call_result, call_time)
        VALUES 
        (%s, 'test_job_3', %s, '13800138003', 'Failed', 0, '通话失败', NOW())
    """
    execute_update(call_record3_query, (job_group_id, lead_ids[2]))
    
    print("✅ 创建外呼记录成功（2个接通，1个失败）")
    
    # 5. 检查任务状态（应该未完成）
    print("\n5. 检查任务状态（应该未完成）...")
    task_status_query = """
        SELECT task_type FROM call_tasks WHERE id = %s
    """
    task_status_result = execute_query(task_status_query, (task_id,))
    current_status = task_status_result[0]['task_type']
    print(f"当前任务状态: {current_status} (2=开始外呼)")
    
    # 6. 调用自动检查函数
    print("\n6. 调用自动检查函数...")
    await check_and_update_task_completion(job_group_id)
    
    # 7. 再次检查任务状态
    print("\n7. 再次检查任务状态...")
    task_status_result = execute_query(task_status_query, (task_id,))
    new_status = task_status_result[0]['task_type']
    print(f"检查后任务状态: {new_status}")
    
    if new_status == 2:
        print("✅ 任务状态正确：部分通话未接通，任务未完成")
    else:
        print("❌ 任务状态异常：应该保持为未完成状态")
    
    # 8. 更新第三个线索为已接通
    print("\n8. 更新第三个线索为已接通...")
    update_call_record_query = """
        UPDATE outbound_call_records 
        SET call_status = 'Connected', call_duration = 90, call_result = '通话成功'
        WHERE lead_id = %s
    """
    execute_update(update_call_record_query, (lead_ids[2],))
    print("✅ 更新第三个线索为已接通")
    
    # 9. 再次调用自动检查函数
    print("\n9. 再次调用自动检查函数...")
    await check_and_update_task_completion(job_group_id)
    
    # 10. 最终检查任务状态
    print("\n10. 最终检查任务状态...")
    task_status_result = execute_query(task_status_query, (task_id,))
    final_status = task_status_result[0]['task_type']
    print(f"最终任务状态: {final_status}")
    
    if final_status == 3:
        print("✅ 任务状态正确：所有通话都已接通，任务已完成")
    else:
        print("❌ 任务状态异常：应该更新为完成状态")
    
    # 11. 清理测试数据
    print("\n11. 清理测试数据...")
    cleanup_queries = [
        "DELETE FROM outbound_call_records WHERE job_group_id = 'test_job_group_001'",
        "DELETE FROM leads_task_list WHERE task_id = %s" % task_id,
        "DELETE FROM call_tasks WHERE id = %s" % task_id,
        "DELETE FROM dcc_leads WHERE leads_name LIKE '测试线索%'"
    ]
    
    for query in cleanup_queries:
        execute_update(query)
    
    print("✅ 测试数据清理完成")
    print("\n🎉 任务完成状态自动检查功能测试完成！")

if __name__ == "__main__":
    asyncio.run(test_task_completion()) 