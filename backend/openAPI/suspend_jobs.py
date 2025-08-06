# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
import os
import sys

from typing import List

from alibabacloud_outboundbot20191226.client import Client as OutboundBot20191226Client
from alibabacloud_credentials.client import Client as CredentialClient
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_outboundbot20191226 import models as outbound_bot_20191226_models
from alibabacloud_tea_util import models as util_models
from alibabacloud_tea_util.client import Client as UtilClient


class Sample:
    def __init__(self):
        pass

    @staticmethod
    def create_client() -> OutboundBot20191226Client:
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
        return OutboundBot20191226Client(config)

    @staticmethod
    def suspend_jobs(job_group_id: str) -> dict:
        """
        暂停任务组
        @param job_group_id: 任务组ID
        @return: 响应结果
        """
        try:
            client = Sample.create_client()
            suspend_jobs_request = outbound_bot_20191226_models.SuspendJobsRequest(
                all=True,
                instance_id=os.getenv('INSTANCE_ID'),
                job_group_id=job_group_id
            )
            runtime = util_models.RuntimeOptions()
            
            # 复制代码运行请自行打印 API 的返回值
            response = client.suspend_jobs_with_options(suspend_jobs_request, runtime)
            
            # 打印真实响应以便调试
            print(f"阿里云暂停任务API响应: {response}")
            print(f"响应body: {response.body}")
            print(f"响应状态码: {response.status_code if hasattr(response, 'status_code') else 'N/A'}")
            
            # 返回真实的阿里云API响应格式
            return {
                "RequestId": response.body.request_id if hasattr(response.body, 'request_id') else "",
                "HttpStatusCode": response.status_code if hasattr(response, 'status_code') else 200,
                "Code": "OK",
                "Success": True
            }
        except Exception as error:
            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            # 错误 message
            print(f"阿里云暂停任务API错误: {error}")
            print(error.message)
            # 诊断地址
            if hasattr(error, 'data') and error.data:
                print(error.data.get("Recommend"))
            UtilClient.assert_as_string(error.message)
            
            # 返回错误格式
            return {
                "RequestId": "",
                "HttpStatusCode": 500,
                "Code": "ERROR",
                "Success": False,
                "Message": str(error.message)
            }

    @staticmethod
    def main(
        args: List[str],
        job_group_id: str,
    ) -> None:
        client = Sample.create_client()
        suspend_jobs_request = outbound_bot_20191226_models.SuspendJobsRequest(
            all=True,
            instance_id=os.getenv('INSTANCE_ID'),
            job_group_id=job_group_id
        )
        runtime = util_models.RuntimeOptions()
        try:
            # 复制代码运行请自行打印 API 的返回值
            response = client.suspend_jobs_with_options(suspend_jobs_request, runtime)
            return response.body
        except Exception as error:
            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            # 错误 message
            print(error.message)
            # 诊断地址
            print(error.data.get("Recommend"))
            UtilClient.assert_as_string(error.message)

    @staticmethod
    async def main_async(
        args: List[str],
    ) -> None:
        client = Sample.create_client()
        suspend_jobs_request = outbound_bot_20191226_models.SuspendJobsRequest(
            all=True,
            instance_id='44f9ce96-c55c-4277-bad9-e7eaa7653644',
            job_group_id='7f47bc7b-8acd-4d81-b375-14507c65dd21'
        )
        runtime = util_models.RuntimeOptions()
        try:
            # 复制代码运行请自行打印 API 的返回值
            await client.suspend_jobs_with_options_async(suspend_jobs_request, runtime)
        except Exception as error:
            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            # 错误 message
            print(error.message)
            # 诊断地址
            print(error.data.get("Recommend"))
            UtilClient.assert_as_string(error.message)


if __name__ == '__main__':
    Sample.main(sys.argv[1:])