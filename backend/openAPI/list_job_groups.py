# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
import os
import sys

from typing import List

from alibabacloud_outboundbot20191226.client import Client as OutboundBot20191226Client
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
        使用AK&SK初始化账号Client
        @return: Client
        @throws Exception
        """
        # 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考。
        # 建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378659.html。
        config = open_api_models.Config(
            # 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID。,
            access_key_id=os.getenv('ALIBABA_CLOUD_ACCESS_KEY_ID'),
            # 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_SECRET。,
            access_key_secret=os.getenv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')
        )
        # Endpoint 请参考 https://api.aliyun.com/product/OutboundBot
        config.endpoint = f'outboundbot.cn-shanghai.aliyuncs.com'
        return OutboundBot20191226Client(config)

    @staticmethod
    def main(
        args: List[str],
        page_number: int,
        page_size: int,
        instance_id: str = os.getenv('INSTANCE_ID')
    ) -> None:
        client = Sample.create_client()
        
        # 准备请求参数
        params = {
            "instance_id": instance_id,
            "page_number": page_number,
            "page_size": page_size
        }
        
        print(params)  
        list_job_groups_request = outbound_bot_20191226_models.ListJobGroupsRequest(**params)
        
        runtime = util_models.RuntimeOptions()
        try:
            # 复制代码运行请自行打印 API 的返回值
            response = client.list_job_groups_with_options(list_job_groups_request, runtime)
            return response.body.job_groups
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
        list_job_groups_request = outbound_bot_20191226_models.ListJobGroupsRequest(
            instance_id=os.getenv('INSTANCE_ID'),
            page_number=1,
            page_size=20
        )
        runtime = util_models.RuntimeOptions()
        try:
            # 复制代码运行请自行打印 API 的返回值
            await client.list_job_groups_with_options_async(list_job_groups_request, runtime)
        except Exception as error:
            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            # 错误 message
            print(error.message)
            # 诊断地址
            print(error.data.get("Recommend"))
            UtilClient.assert_as_string(error.message)


if __name__ == '__main__':
    Sample.main(sys.argv[1:])