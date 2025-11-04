import os
import sys
import json
from datetime import datetime

# 复用数据库工具
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database.db import execute_query, execute_update  # noqa: E402

# 引入阿里云 OpenAPI 封装
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
from list_jobs_by_group import Sample as ListJobsByGroupSample  # noqa: E402
from list_jobs import Sample as ListJobsSample  # noqa: E402

# 直接复用已有的 AI 跟进逻辑
# 允许直接运行脚本时以包路径导入（确保 auto_call_api 内相对导入可用）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)
from backend.api.auto_call_api import get_leads_follow_id  # noqa: E402


def _extract_phone_from_job(job) -> str:
    """尽可能鲁棒地从 ListJobsByGroup 返回的 job 结构中取手机号。"""
    # 可能的字段：Contacts/contacts/ContactList，内部 phoneNumber/PhoneNumber
    candidates = [
        job.get('Contacts'),
        job.get('contacts'),
        job.get('ContactList'),
        job.get('contact_list'),
    ]
    for lst in candidates:
        if isinstance(lst, list) and lst:
            contact = lst[0] or {}
            phone = (
                contact.get('PhoneNumber')
                or contact.get('phoneNumber')
                or contact.get('Number')
                or contact.get('number')
            )
            if phone:
                return str(phone).strip()
    # 有些返回把联系人放在 Extras/extra 中
    extras = job.get('Extras') or job.get('extras') or []
    if isinstance(extras, list):
        for item in extras:
            if isinstance(item, dict):
                for k in ('phone', 'Phone', 'phoneNumber', 'PhoneNumber'):
                    if item.get(k):
                        return str(item[k]).strip()
    return ''


def _update_call_job_id_by_phone(task_id: int, phone: str, job_id: str) -> int:
    """根据手机号更新 leads_task_list.call_job_id。返回受影响行数。"""
    if not phone:
        return 0
    sql = (
        "UPDATE leads_task_list SET call_job_id=%s "
        "WHERE task_id=%s AND leads_phone=%s"
    )
    return execute_update(sql, (job_id, task_id, phone))


def _update_job_detail_from_list_jobs(task_id: int, job_id: str) -> None:
    """调用 ListJobs 获取明细并回写 leads_task_list 的通话字段。"""
    jobs_data = ListJobsSample.main([], job_ids=[job_id])
    if not jobs_data:
        return
    # ListJobs 返回列表，每个元素是一个 job
    job = next((j for j in jobs_data if j.get('JobId') == job_id), jobs_data[0])

    job_status = job.get('Status', '')
    tasks = job.get('Tasks', []) or []
    if not tasks:
        # 也回写状态，避免缺失
        execute_update(
            "UPDATE leads_task_list SET call_status=%s WHERE task_id=%s AND call_job_id=%s",
            (job_status, task_id, job_id),
        )
        return

    last_task = tasks[-1]
    status = last_task.get('Status', '')
    planned_time = last_task.get('PlanedTime')
    actual_time = last_task.get('ActualTime')
    call_task_id = last_task.get('TaskId', '')
    conversation = last_task.get('Conversation', None)
    calling_number = last_task.get('CallingNumber', '')

    plan_time = None
    if planned_time:
        try:
            plan_time = datetime.fromtimestamp(int(planned_time) / 1000)
        except Exception:
            plan_time = None

    # 录音等可后续批量补，不在此强制获取
    execute_update(
        (
            "UPDATE leads_task_list SET call_status=%s, planed_time=%s, call_task_id=%s, "
            "call_conversation=%s, calling_number=%s WHERE task_id=%s AND call_job_id=%s"
        ),
        (
            job_status or status,
            plan_time,
            call_task_id,
            json.dumps(conversation, ensure_ascii=False) if conversation else None,
            calling_number,
            task_id,
            job_id,
        ),
    )


def sync_task_jobs(task_id: int = 54, page_size: int = 100):
    """
    步骤：
    1) 从 call_tasks 取 job_group_id；
    2) 分页调用 ListJobsByGroup，拿到 job_id 与手机号，按手机号更新 leads_task_list.call_job_id；
    3) 逐个 job_id 调用 ListJobs，更新通话字段；
    4) 触发 AI 分析（get_leads_follow_id），回写是否有意向与备注。
    """
    rows = execute_query(
        "SELECT job_group_id FROM call_tasks WHERE id=%s",
        (task_id,),
    )
    if not rows or not rows[0].get('job_group_id'):
        print(f"[sync] 任务 {task_id} 未找到 job_group_id")
        return
    job_group_id = rows[0]['job_group_id']

    print(f"[sync] task_id={task_id}, job_group_id={job_group_id}")

    page = 1
    job_list = []
    while True:
        jobs = ListJobsByGroupSample.main([], job_group_id, page, page_size)
        if not jobs:
            break
        
        for j in jobs.list:
            job_id = j.job_id
            job_status = j.status
            phone = j.contacts[0].phone_number
            job_list.append({
                'job_id': job_id,
                'job_status': job_status,
                'phone': phone,
            })
        # 如果返回数量小于 page_size，认为没有更多页
        if len(jobs.list) < page_size:
            break
        page += 1

    print(f"[sync] 共收集 job 数量: {len(job_list)}")

    for job in job_list:
        _update_call_job_id_by_phone(task_id, job['phone'], job['job_id'])
        _update_job_detail_from_list_jobs(task_id, job['job_id'])
        get_leads_follow_id(job['job_id'])


if __name__ == '__main__':
    # 默认同步任务 54，如需其他任务，可传入环境变量 TASK_ID 或修改此处
    tid = int(os.getenv('TASK_ID', '54'))
    sync_task_jobs(task_id=tid)


