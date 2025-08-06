import os
from http import HTTPStatus
from dashscope import Application


def ali_bailian_api(prompt):

    response = Application.call(
        # 若没有配置环境变量，可用百炼API Key将下行替换为：api_key="sk-xxx"。但不建议在生产环境中直接将API Key硬编码到代码中，以减少API Key泄露风险。
        api_key=os.getenv("DASHSCOPE_API_KEY"),
        app_id=os.getenv("ALIBAILIAN_APP_ID"),
        prompt=prompt)

    return response.output.text