# -*- coding: utf-8 -*-
# This file is auto-generated, don't edit it. Thanks.
import os
import sys

from typing import List

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
            action='ListJobs',
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
        args: List[str],
        job_ids: List[str]
    ) -> None:
        client = Sample.create_client()
        params = Sample.create_api_info()
        # query params
        queries = {}
        queries['InstanceId'] = os.getenv('INSTANCE_ID')
        for i, job_id in enumerate(job_ids, 1):
            queries[f'JobId.{i}'] = job_id
        # runtime options
        runtime = util_models.RuntimeOptions()
        request = open_api_models.OpenApiRequest(
            query=OpenApiUtilClient.query(queries)
        )
        # 复制代码运行请自行打印 API 的返回值
        # 返回值实际为 Map 类型，可从 Map 中获得三类数据：响应体 body、响应头 headers、HTTP 返回的状态码 statusCode。
        response = client.call_api(params, request, runtime)
        return response['body']['Jobs']
    @staticmethod
    async def main_async(
        args: List[str],
    ) -> None:
        client = Sample.create_client()
        params = Sample.create_api_info()
        # query params
        queries = {}
        queries['InstanceId'] = '44f9ce96-c55c-4277-bad9-e7eaa7653644'
        queries['JobId.1'] = '1754361186153-4493-885b-86b85052aae9'
        queries['JobId.2'] = '1754361186153-4706-a958-d7043a44637e'
        queries['JobId.3'] = '1754361186153-4804-bc4c-42c9abb21f4b'
        # runtime options
        runtime = util_models.RuntimeOptions()
        request = open_api_models.OpenApiRequest(
            query=OpenApiUtilClient.query(queries)
        )
        # 复制代码运行请自行打印 API 的返回值
        # 返回值实际为 Map 类型，可从 Map 中获得三类数据：响应体 body、响应头 headers、HTTP 返回的状态码 statusCode。
        await client.call_api_async(params, request, runtime)


if __name__ == '__main__':
    Sample.main(sys.argv[1:])