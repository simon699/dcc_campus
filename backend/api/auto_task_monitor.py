import asyncio
import json
import threading
from datetime import datetime, timedelta
from typing import Dict, Any
from database.db import execute_query, execute_update
from .auth import verify_access_token
from openAPI.ali_bailian_api import ali_bailian_api

class AutoTaskMonitor:
    """自动化任务监控器"""
    
    def __init__(self):
        self.is_running = False
        self.monitor_thread = None
    
    async def start_monitoring(self):
        """开始监控任务"""
        if self.is_running:
            return
        
        self.is_running = True
        print("自动化任务监控器已启动")
        
        while self.is_running:
            try:
                await self.check_and_update_tasks()
                # 每5分钟检查一次
                await asyncio.sleep(300)
            except Exception as e:
                print(f"自动化任务监控出错: {str(e)}")
                await asyncio.sleep(60)  # 出错后等待1分钟再继续
    
    async def stop_monitoring(self):
        """停止监控任务"""
        self.is_running = False
        print("自动化任务监控器已停止")
    
    async def check_and_update_tasks(self):
        """检查并更新任务状态"""
        try:
            # 查询所有需要检查的任务 - 只有task_type=2（开始外呼）的任务才检查
            query = """
                SELECT DISTINCT ct.id, ct.task_name, ct.task_type
                FROM call_tasks ct
                INNER JOIN leads_task_list ltl ON ct.id = ltl.task_id
                WHERE ct.task_type = 2  -- 只有开始外呼状态的任务才检查
                AND EXISTS (
                    SELECT 1 FROM leads_task_list 
                    WHERE task_id = ct.id AND leads_follow_id IS NULL
                )
            """
            
            tasks = execute_query(query)
            
            for task in tasks:
                task_id = task['id']
                task_name = task['task_name']
                task_type = task['task_type']
                
                print(f"检查任务: {task_name} (ID: {task_id})")
                
                # 检查该任务下是否还有leads_follow_id为空的记录
                check_query = """
                    SELECT COUNT(*) as empty_count, COUNT(*) as total_count
                    FROM leads_task_list 
                    WHERE task_id = %s
                """
                
                count_result = execute_query(check_query, (task_id,))
                if count_result:
                    total_count = count_result[0]['total_count']
                    
                    # 查询leads_follow_id为空的记录数
                    empty_query = """
                        SELECT COUNT(*) as empty_count
                        FROM leads_task_list 
                        WHERE task_id = %s AND leads_follow_id IS NULL
                    """
                    empty_result = execute_query(empty_query, (task_id,))
                    empty_count = empty_result[0]['empty_count'] if empty_result else 0
                    
                    if empty_count == 0:
                        # 所有记录的leads_follow_id都不为空，更新任务状态为4
                        update_query = """
                            UPDATE call_tasks 
                            SET task_type = 4 
                            WHERE id = %s
                        """
                        execute_update(update_query, (task_id,))
                        print(f"任务 {task_name} (ID: {task_id}) 所有线索跟进完成，状态更新为4")
                    else:
                        # 还有leads_follow_id为空的记录，调用查询接口更新
                        await self.update_task_execution(task_id)
                        
        except Exception as e:
            print(f"检查任务状态时出错: {str(e)}")
    
    async def update_task_execution(self, task_id):
        """更新任务执行状态"""
        try:
            # 查询该任务下leads_follow_id为空的记录
            query = """
                SELECT call_job_id, leads_name, leads_phone
                FROM leads_task_list 
                WHERE task_id = %s AND leads_follow_id IS NULL
                AND call_job_id IS NOT NULL AND call_job_id != ''
            """
            
            leads_result = execute_query(query, (task_id,))
            
            if not leads_result:
                return
            
            # 提取所有call_job_id
            call_job_ids = [lead['call_job_id'] for lead in leads_result if lead['call_job_id']]
            
            if not call_job_ids:
                return
            
            # 调用list_jobs接口获取任务执行状态
            import sys
            import os
            sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'openAPI'))
            from list_jobs import Sample as ListJobsSample
            from download_recording import Sample as DownloadRecordingSample
            
            try:
                jobs_data = ListJobsSample.main([], job_ids=call_job_ids)
                
                if not jobs_data:
                    return
                
                # 处理每个任务的结果
                for job_data in jobs_data:
                    job_id = job_data.get('JobId')
                    tasks = job_data.get('Tasks', [])
                    job_status = job_data.get('Status', '')
                    
                    if tasks and job_status == 'Succeeded':
                        # 获取最后一个任务的信息
                        last_task = tasks[-1]
                        status = last_task.get('Status', '')
                        planned_time = last_task.get('PlanedTime', None)
                        call_id = last_task.get('CallId', '')
                        conversation = last_task.get('Conversation', '')
                        actual_time = last_task.get('ActualTime', None)
                        calling_number = last_task.get('CallingNumber', '')
                        
                        # 转换时间戳
                        plan_time = None
                        call_time = None
                        
                        if planned_time:
                            try:
                                plan_time = datetime.fromtimestamp(int(planned_time) / 1000)
                            except:
                                plan_time = None
                        
                        if actual_time:
                            try:
                                call_time = datetime.fromtimestamp(int(actual_time) / 1000)
                            except:
                                call_time = None
                        
                        # 检查当前recording_url状态
                        current_recording_url = None
                        try:
                            check_recording_query = """
                                SELECT recording_url 
                                FROM leads_task_list 
                                WHERE task_id = %s AND call_job_id = %s
                            """
                            recording_result = execute_query(check_recording_query, (task_id, job_id))
                            if recording_result:
                                current_recording_url = recording_result[0].get('recording_url')
                        except Exception as e:
                            print(f"检查当前recording_url失败 - job_id: {job_id}, 错误: {str(e)}")
                        
                        # 获取录音URL - 优先获取新的录音URL
                        recording_url = None
                        if call_id:
                            try:
                                new_recording_url = DownloadRecordingSample.main([], task_id=call_id)
                                if new_recording_url:
                                    recording_url = new_recording_url
                                    print(f"获取录音URL成功 - call_id: {call_id}, recording_url: {recording_url}")
                                else:
                                    print(f"获取录音URL失败 - call_id: {call_id}, 返回值为None")
                                    # 如果获取失败但有旧的URL，保持旧值
                                    if current_recording_url:
                                        recording_url = current_recording_url
                                        print(f"保持原有录音URL: {recording_url}")
                            except Exception as e:
                                print(f"获取录音URL失败 - call_id: {call_id}, 错误: {str(e)}")
                                # 如果获取失败但有旧的URL，保持旧值
                                if current_recording_url:
                                    recording_url = current_recording_url
                                    print(f"保持原有录音URL: {recording_url}")
                        elif current_recording_url:
                            recording_url = current_recording_url
                        
                        # 更新leads_task_list表
                        update_query = """
                            UPDATE leads_task_list 
                            SET call_status = %s,
                                planed_time = %s,
                                call_task_id = %s,
                                call_conversation = %s,
                                calling_number = %s,
                                recording_url = %s
                            WHERE task_id = %s AND call_job_id = %s
                        """
                        
                        try:
                            print(f"准备更新数据库 - job_id: {job_id}, recording_url: {recording_url}, calling_number: {calling_number}")
                            update_params = (
                                status,
                                plan_time,
                                call_id,
                                json.dumps(conversation) if conversation else None,
                                calling_number,
                                recording_url,
                                task_id,
                                job_id
                            )
                            print(f"更新参数: {update_params}")
                            affected_rows = execute_update(update_query, update_params)
                            print(f"数据库更新成功 - job_id: {job_id}, 影响行数: {affected_rows}")
                            
                            # 创建跟进记录
                            await self.create_leads_follow(job_id)
                            
                        except Exception as e:
                            print(f"更新任务 {job_id} 失败: {str(e)}")
                            print(f"更新查询: {update_query}")
                            try:
                                print(f"更新参数: {update_params}")
                            except NameError:
                                print("更新参数未定义")
                
            except Exception as e:
                print(f"获取外呼任务状态失败: {str(e)}")
                
        except Exception as e:
            print(f"更新任务执行状态时出错: {str(e)}")
    
    async def create_leads_follow(self, call_job_id):
        """创建线索跟进记录"""
        try:
            # 检查是否已存在跟进记录
            check_query = """
                SELECT leads_follow_id 
                FROM leads_task_list 
                WHERE call_job_id = %s
            """
            follow_result = execute_query(check_query, (call_job_id,))
            
            if follow_result and follow_result[0].get('leads_follow_id') is not None:
                print(f"任务 {call_job_id} 的leads_follow_id已存在，跳过跟进记录创建")
                return
            
            # 调用get_leads_follow_id函数创建跟进记录
            # 为了避免循环导入，直接在这里实现跟进记录创建逻辑
            result = await self.create_leads_follow_direct(call_job_id)
            
            if result.get('status') == 'success':
                print(f"任务 {call_job_id} 的跟进记录创建成功")
            else:
                print(f"任务 {call_job_id} 的跟进记录创建失败: {result.get('message')}")
                
        except Exception as e:
            print(f"创建线索跟进记录时出错: {str(e)}")
    
    async def create_leads_follow_direct(self, call_job_id):
        """直接创建线索跟进记录（避免循环导入）"""
        try:
            # 1. 根据call_job_id查找leads_task_list中的call_conversation和leads_id
            query = """
                SELECT call_conversation, leads_id, leads_name, leads_phone, leads_follow_id
                FROM leads_task_list 
                WHERE call_job_id = %s
            """
            
            result = execute_query(query, (call_job_id,))
            
            if not result:
                return {
                    "status": "error",
                    "code": 4001,
                    "message": f"未找到call_job_id为{call_job_id}的记录"
                }
            
            task_data = result[0]
            call_conversation = task_data.get('call_conversation')
            leads_id = task_data.get('leads_id')
            leads_name = task_data.get('leads_name')
            leads_phone = task_data.get('leads_phone')
            leads_follow_id = task_data.get('leads_follow_id')
            
            # 检查leads_follow_id是否已存在
            if leads_follow_id is not None:
                return {
                    "status": "error",
                    "code": 4003,
                    "message": f"call_job_id为{call_job_id}的记录已存在跟进记录，无需重复创建"
                }
            
            if not call_conversation:
                return {
                    "status": "error", 
                    "code": 4002,
                    "message": f"call_job_id为{call_job_id}的记录中没有通话记录"
                }
            
            # 2. 将call_conversation作为prompt调用AI接口
            try:
                # 如果call_conversation是JSON字符串，需要解析
                if isinstance(call_conversation, str):
                    conversation_data = json.loads(call_conversation)
                else:
                    conversation_data = call_conversation
                
                # 构建prompt
                prompt = f"""
                请分析以下汽车销售通话记录，并返回JSON格式的分析结果：
                
                通话记录：
                {json.dumps(conversation_data, ensure_ascii=False, indent=2)}
                
                请分析客户意向并返回以下格式的JSON：
                {{
                    "leads_remark": "客户意向分析结果",
                    "next_follow_time": "建议下次跟进时间（格式：YYYY-MM-DD HH:MM:SS）",
                    "is_interested": 意向判断结果
                }}
                
                意向判断规则：
                - 如果无法判断客户意向，返回0
                - 如果客户有意向，返回1
                - 如果客户无意向，返回2
                """
                
                # 调用AI接口
                ai_response = ali_bailian_api(prompt)
                
                # 解析AI返回的JSON
                try:
                    # 处理AI返回的Markdown代码块格式
                    ai_response_clean = ai_response.strip()
                    if ai_response_clean.startswith('```json'):
                        # 移除开头的 ```json
                        ai_response_clean = ai_response_clean[7:]
                    if ai_response_clean.endswith('```'):
                        # 移除结尾的 ```
                        ai_response_clean = ai_response_clean[:-3]
                    
                    # 清理可能的换行符和多余空格
                    ai_response_clean = ai_response_clean.strip()
                    
                    ai_result = json.loads(ai_response_clean)
                    leads_remark = ai_result.get('leads_remark', '')
                    next_follow_time_str = ai_result.get('next_follow_time', '')
                    is_interested = ai_result.get('is_interested', 0)
                    
                    # 解析下次跟进时间
                    next_follow_time = None
                    if next_follow_time_str:
                        try:
                            next_follow_time = datetime.strptime(next_follow_time_str, '%Y-%m-%d %H:%M:%S')
                        except:
                            # 如果时间格式不正确，设置为当前时间加1天
                            next_follow_time = datetime.now()
                    
                except json.JSONDecodeError:
                    # 如果AI返回的不是标准JSON，使用默认值
                    leads_remark = "AI分析结果解析失败，需要人工跟进"
                    next_follow_time = datetime.now()
                    is_interested = 0
                    
            except Exception as e:
                # AI调用失败，使用默认值
                leads_remark = f"AI分析失败: {str(e)}，需要人工跟进"
                next_follow_time = datetime.now()
                is_interested = 0
            
            # 3. 将数据写入dcc_leads_follow表
            # 注意：dcc_leads_follow表的leads_id字段是int类型，需要转换
            insert_query = """
                INSERT INTO dcc_leads_follow 
                (leads_id, follow_time, leads_remark, frist_follow_time, new_follow_time, next_follow_time)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            current_time = datetime.now()
            # 将leads_id转换为整数，因为dcc_leads_follow表的leads_id字段是int类型
            try:
                leads_id_int = int(leads_id) if leads_id else None
            except (ValueError, TypeError):
                # 如果转换失败，尝试从dcc_leads表获取对应的id
                get_id_query = "SELECT id FROM dcc_leads WHERE leads_id = %s"
                id_result = execute_query(get_id_query, (leads_id,))
                if id_result:
                    leads_id_int = id_result[0]['id']
                else:
                    raise ValueError(f"无法找到leads_id为{leads_id}的记录")
            
            follow_id = execute_update(insert_query, (
                leads_id_int,
                current_time,
                leads_remark,
                current_time,
                current_time,
                next_follow_time
            ))
            
            # 4. 更新leads_task_list表中的leads_follow_id和is_interested
            update_query = """
                UPDATE leads_task_list 
                SET leads_follow_id = %s, is_interested = %s
                WHERE call_job_id = %s
            """
            
            execute_update(update_query, (follow_id, is_interested, call_job_id))
            
            return {
                "status": "success",
                "code": 200,
                "message": "跟进记录创建成功",
                "data": {
                    "follow_id": follow_id,
                    "leads_id": leads_id,
                    "leads_name": leads_name,
                    "leads_phone": leads_phone,
                    "leads_remark": leads_remark,
                    "is_interested": is_interested,
                    "next_follow_time": next_follow_time.strftime('%Y-%m-%d %H:%M:%S') if next_follow_time else None,
                    "create_time": current_time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "code": 5000,
                "message": f"创建跟进记录失败: {str(e)}"
            }

# 全局监控器实例
auto_task_monitor = AutoTaskMonitor()

async def start_auto_check_after_creation(task_id: int):
    """在创建任务后启动自动检查"""
    try:
        # 等待2秒后开始检查
        await asyncio.sleep(2)
        await auto_task_monitor.update_task_execution(task_id)
    except Exception as e:
        print(f"创建任务后自动检查失败: {str(e)}") 