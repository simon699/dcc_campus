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
        self,
        args: List[str],
        job_group_name: str,
        job_group_description: str,
        StrategyJson = None,
        script_id:str = None,
    ) -> None:
        client = self.create_client()
        # 基础校验，避免后续返回 None 导致调用方属性访问报错
        instance_id = os.getenv('INSTANCE_ID')
        if not instance_id:
            raise ValueError("缺少环境变量 INSTANCE_ID")
        if not script_id:
            raise ValueError("缺少脚本ID script_id")
        if not job_group_name:
            raise ValueError("缺少任务组名称 job_group_name")
        
        # 基本请求参数
        request_params = {
            "instance_id": instance_id,
            "job_group_name": job_group_name,
            "job_group_description": job_group_description,
            "script_id": script_id
        }
        
        # 如果有策略JSON，添加到请求参数中
        if StrategyJson:
            # 将策略JSON转换为字符串
            import json
            dic = {
                "maxAttemptsPerDay":1, #每日最多尝试呼叫次数，必传
                "minAttemptInterval":120, #未接通重试间隔时间，单位分钟，必传
                "RepeatBy":"once", #once不指定。week每周重复，month每月重复，不传该字段默认是立即执行，如果为立即执行，则下面的字段都可以不上传；
            }
            StrategyJson.update(dic)
            strategy_json_str = json.dumps(StrategyJson)
            request_params["strategy_json"] = strategy_json_str
        
        create_job_group_request = outbound_bot_20191226_models.CreateJobGroupRequest(**request_params)
        
        runtime = util_models.RuntimeOptions()
        try:
            response = client.create_job_group_with_options(create_job_group_request, runtime)
            job_group = response.body.job_group
            if not job_group or not getattr(job_group, 'job_group_id', None):
                raise RuntimeError("创建任务组未返回 job_group_id")
            return job_group
        except Exception as error:
            # 转换为明确可见的异常给上层捕获
            # 兼容 Tea 异常结构，尽最大可能给出可读信息
            message = getattr(error, 'message', str(error))
            recommend = ''
            try:
                data = getattr(error, 'data', None)
                if isinstance(data, dict):
                    recommend = data.get('Recommend') or ''
            except Exception:
                pass
            detail = message if not recommend else f"{message} | {recommend}"
            raise RuntimeError(detail)

    @staticmethod
    async def main_async(
        args: List[str],
        job_group_name: str,
        script_id:str,
    ) -> None:
        client = Sample.create_client()
        create_job_group_request = outbound_bot_20191226_models.CreateJobGroupRequest(
            instance_id=os.getenv('INSTANCE_ID'),
            script_id=script_id,
            job_group_name=job_group_name
        )
        runtime = util_models.RuntimeOptions()
        try:
            # 复制代码运行请自行打印 API 的返回值
            await client.create_job_group_with_options_async(create_job_group_request, runtime)
        except Exception as error:
            # 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            # 错误 message
            print(error.message)
            # 诊断地址
            print(error.data.get("Recommend"))
            UtilClient.assert_as_string(error.message)


if __name__ == '__main__':
    Sample.main(sys.argv[1:])