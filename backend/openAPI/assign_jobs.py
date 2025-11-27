# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
import os
import sys
import json

from typing import List, Dict, Any

from alibabacloud_tea_openapi.client import Client as OpenApiClient
from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_tea_util import models as util_models
from alibabacloud_openapi_util.client import Client as OpenApiUtilClient


class Sample:
    def __init__(self):
        pass

    @staticmethod
    def create_client() -> OpenApiClient:
        """
        使用凭据初始化账号Client
        @return: Client
        @throws Exception
        """
        # 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378659.html。
        credential = CredentialClient()
        config = open_api_models.Config(
            credential=credential
        )
        # Endpoint 请参考 https://api.aliyun.com/product/OutboundBot
        config.endpoint = f'outboundbot.cn-shanghai.aliyuncs.com'
        return OpenApiClient(config)

    @staticmethod
    def create_api_info() -> open_api_models.Params:
        """
        API 相关
        @param path: string Path parameters
        @return: OpenApi.Params
        """
        params = open_api_models.Params(
            # 接口名称,
            action='AssignJobs',
            # 接口版本,
            version='2019-12-26',
            # 接口协议,
            protocol='HTTPS',
            # 接口 HTTP 方法,
            method='POST',
            auth_type='AK',
            style='RPC',
            # 接口 PATH,
            pathname=f'/',
            # 接口请求体内容格式,
            req_body_type='json',
            # 接口响应体内容格式,
            body_type='json'
        )
        return params

    @staticmethod
    def main(
        job_group_id: str,
        jobs_json_list: List[Dict[str, Any]]
    ) -> List[str]:
        """
        分配任务到指定作业组
        
        @param job_group_id: 作业组ID
        @param jobs_json_list: JobsJson列表，每个元素是一个字典，包含extras和contacts
        @return: 返回jobs_id列表（因为分批处理）
        """
        client = Sample.create_client()
        params = Sample.create_api_info()
        instance_id = os.getenv('INSTANCE_ID')
        
        # 分批处理：每批最多20个任务，降低批次失败影响
        batch_size = 20
        all_jobs_id = []
        total_batches = (len(jobs_json_list) + batch_size - 1) // batch_size
        
        for batch_start in range(0, len(jobs_json_list), batch_size):
            batch_end = min(batch_start + batch_size, len(jobs_json_list))
            batch_jobs = jobs_json_list[batch_start:batch_end]
            batch_num = (batch_start // batch_size) + 1
            
            try:
                # 构建查询参数
                queries = {}
                queries['InstanceId'] = instance_id
                queries['JobGroupId'] = job_group_id
                
                # 动态添加JobsJson参数到查询参数中
                for i, job_json in enumerate(batch_jobs, 1):
                    queries[f'JobsJson.{i}'] = json.dumps(job_json, ensure_ascii=False)
                
                # runtime options
                runtime = util_models.RuntimeOptions()
                request = open_api_models.OpenApiRequest(
                    query=OpenApiUtilClient.query(queries)
                )
                
                # 调用API
                response = client.call_api(params, request, runtime)
                batch_jobs_id = response['body']['JobsId']
                
                # 如果返回的是单个字符串，转换为列表
                if isinstance(batch_jobs_id, str):
                    batch_jobs_id = [batch_jobs_id]
                elif not isinstance(batch_jobs_id, list):
                    batch_jobs_id = list(batch_jobs_id) if batch_jobs_id else []
                
                # 验证返回的 jobs_id 数量是否与发送的数量一致
                expected_count = len(batch_jobs)
                actual_count = len(batch_jobs_id)
                if actual_count != expected_count:
                    print(f"[assign_jobs] 警告: 第{batch_num}/{total_batches}批，期望返回{expected_count}个jobs_id，实际返回{actual_count}个")
                
                all_jobs_id.extend(batch_jobs_id)
                print(f"[assign_jobs] 第{batch_num}/{total_batches}批处理成功，发送{expected_count}个任务，返回{actual_count}个jobs_id")
                
            except Exception as e:
                # 即使某批失败，也继续处理下一批
                print(f"[assign_jobs] 错误: 第{batch_num}/{total_batches}批处理失败: {str(e)}")
                print(f"[assign_jobs] 失败的批次包含{len(batch_jobs)}个任务，索引范围: {batch_start}-{batch_end-1}")
                # 继续处理下一批，不中断整个流程
                continue
        
        # 验证总数
        total_sent = len(jobs_json_list)
        total_received = len(all_jobs_id)
        if total_received != total_sent:
            print(f"[assign_jobs] 警告: 总共发送{total_sent}个任务，但只收到{total_received}个jobs_id，可能有遗漏")
        
        return all_jobs_id

    @staticmethod
    async def main_async(
        job_group_id: str,
        jobs_json_list: List[Dict[str, Any]]
    ) -> List[str]:
        """
        异步分配任务到指定作业组
        
        @param job_group_id: 作业组ID
        @param jobs_json_list: JobsJson列表，每个元素是一个字典，包含extras和contacts
        @return: 返回jobs_id列表（因为分批处理）
        """
        client = Sample.create_client()
        params = Sample.create_api_info()
        instance_id = os.getenv('INSTANCE_ID')
        
        # 分批处理：每批最多20个任务，降低批次失败影响
        batch_size = 20
        all_jobs_id = []
        total_batches = (len(jobs_json_list) + batch_size - 1) // batch_size
        
        for batch_start in range(0, len(jobs_json_list), batch_size):
            batch_end = min(batch_start + batch_size, len(jobs_json_list))
            batch_jobs = jobs_json_list[batch_start:batch_end]
            batch_num = (batch_start // batch_size) + 1
            
            try:
                # 构建查询参数
                queries = {}
                queries['InstanceId'] = instance_id
                queries['JobGroupId'] = job_group_id
                
                # 动态添加JobsJson参数到查询参数中
                for i, job_json in enumerate(batch_jobs, 1):
                    queries[f'JobsJson.{i}'] = json.dumps(job_json, ensure_ascii=False)
                
                # runtime options
                runtime = util_models.RuntimeOptions()
                request = open_api_models.OpenApiRequest(
                    query=OpenApiUtilClient.query(queries)
                )
                
                # 调用API
                response = await client.call_api_async(params, request, runtime)
                batch_jobs_id = response.body.jobs_id
                
                # 如果返回的是单个字符串，转换为列表
                if isinstance(batch_jobs_id, str):
                    batch_jobs_id = [batch_jobs_id]
                elif not isinstance(batch_jobs_id, list):
                    batch_jobs_id = list(batch_jobs_id) if batch_jobs_id else []
                
                # 验证返回的 jobs_id 数量是否与发送的数量一致
                expected_count = len(batch_jobs)
                actual_count = len(batch_jobs_id)
                if actual_count != expected_count:
                    print(f"[assign_jobs_async] 警告: 第{batch_num}/{total_batches}批，期望返回{expected_count}个jobs_id，实际返回{actual_count}个")
                
                all_jobs_id.extend(batch_jobs_id)
                print(f"[assign_jobs_async] 第{batch_num}/{total_batches}批处理成功，发送{expected_count}个任务，返回{actual_count}个jobs_id")
                
            except Exception as e:
                # 即使某批失败，也继续处理下一批
                print(f"[assign_jobs_async] 错误: 第{batch_num}/{total_batches}批处理失败: {str(e)}")
                print(f"[assign_jobs_async] 失败的批次包含{len(batch_jobs)}个任务，索引范围: {batch_start}-{batch_end-1}")
                # 继续处理下一批，不中断整个流程
                continue
        
        # 验证总数
        total_sent = len(jobs_json_list)
        total_received = len(all_jobs_id)
        if total_received != total_sent:
            print(f"[assign_jobs_async] 警告: 总共发送{total_sent}个任务，但只收到{total_received}个jobs_id，可能有遗漏")
        
        return all_jobs_id


if __name__ == '__main__':
    # 示例用法
    jobs_data = [
        {
            'extras': [],
            'contacts': [
                {
                    'phoneNumber': '18621853427',
                    'name': '邵波',
                    'referenceId': 'task_8_lead_15467138'
                }
            ]
        },
        {
            'extras': [],
            'contacts': [
                {
                    'phoneNumber': '13120903613',
                    'name': '张浩',
                    'referenceId': 'task_8_lead_15519559'
                }
            ]
        }
    ]
    
    # 调用示例
    result = Sample.main('your_job_group_id', jobs_data)
    print(f"Jobs ID: {result}")
