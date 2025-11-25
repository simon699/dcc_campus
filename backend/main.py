from fastapi import FastAPI
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import uvicorn
import asyncio
import threading
import subprocess
import os
import sys
from pathlib import Path

# 尝试导入 psutil，如果未安装则使用替代方案
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("⚠️  psutil 未安装，将使用替代方法检查进程状态")
from api.health import health_router
from api.login import login_router
from api.createOrganization import organization_router
from api.scene import scene_router
from api.dcc_user import dcc_user_router
from api.dcc_leads import dcc_leads_router
from api.auto_call_api import auto_call_router
from api.auth_verify import auth_verify_router
from api.config_check import router as config_check_router
from swagger_config import tags_metadata

# 存储自动启动的 Celery 进程 PID
_celery_worker_pid = None
_celery_beat_pid = None


def check_celery_worker_running():
    """检查 Celery Worker 是否正在运行"""
    try:
        # 检查 PID 文件
        backend_dir = Path(__file__).parent
        worker_pid_file = backend_dir / "logs" / "celery_worker.pid"
        
        if worker_pid_file.exists():
            try:
                with open(worker_pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                # 使用 psutil 检查（如果可用）
                if PSUTIL_AVAILABLE:
                    if psutil.pid_exists(pid):
                        process = psutil.Process(pid)
                        # 检查进程名是否包含 celery
                        if 'celery' in process.name().lower() or any('celery' in cmd.lower() for cmd in process.cmdline()):
                            return True, pid
                else:
                    # 使用 os.kill 检查进程是否存在（发送信号 0 不会杀死进程）
                    try:
                        os.kill(pid, 0)
                        return True, pid
                    except (OSError, ProcessLookupError):
                        pass
            except (ValueError, FileNotFoundError):
                pass
        
        # 如果 psutil 可用，通过进程名检查
        if PSUTIL_AVAILABLE:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'celery' in ' '.join(cmdline).lower() and 'worker' in ' '.join(cmdline).lower():
                        if 'celery_app' in ' '.join(cmdline):
                            return True, proc.info['pid']
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        
        return False, None
    except Exception as e:
        print(f"⚠️  检查 Celery Worker 状态时出错: {str(e)}")
        return False, None


def check_celery_beat_running():
    """检查 Celery Beat 是否正在运行"""
    try:
        # 检查 PID 文件
        backend_dir = Path(__file__).parent
        beat_pid_file = backend_dir / "logs" / "celery_beat.pid"
        
        if beat_pid_file.exists():
            try:
                with open(beat_pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                # 使用 psutil 检查（如果可用）
                if PSUTIL_AVAILABLE:
                    if psutil.pid_exists(pid):
                        process = psutil.Process(pid)
                        # 检查进程名是否包含 celery
                        if 'celery' in process.name().lower() or any('celery' in cmd.lower() for cmd in process.cmdline()):
                            return True, pid
                else:
                    # 使用 os.kill 检查进程是否存在（发送信号 0 不会杀死进程）
                    try:
                        os.kill(pid, 0)
                        return True, pid
                    except (OSError, ProcessLookupError):
                        pass
            except (ValueError, FileNotFoundError):
                pass
        
        # 如果 psutil 可用，通过进程名检查
        if PSUTIL_AVAILABLE:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'celery' in ' '.join(cmdline).lower() and 'beat' in ' '.join(cmdline).lower():
                        if 'celery_app' in ' '.join(cmdline):
                            return True, proc.info['pid']
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        
        return False, None
    except Exception as e:
        print(f"⚠️  检查 Celery Beat 状态时出错: {str(e)}")
        return False, None


def start_celery_worker():
    """启动 Celery Worker"""
    global _celery_worker_pid
    try:
        backend_dir = Path(__file__).parent
        logs_dir = backend_dir / "logs"
        logs_dir.mkdir(exist_ok=True)
        
        # 构建启动命令
        cmd = [
            sys.executable, "-m", "celery",
            "-A", "celery_app",
            "worker",
            "--loglevel=info",
            "--pool=solo",
            "--concurrency=1",
            f"--logfile={logs_dir / 'celery_worker.log'}",
            f"--pidfile={logs_dir / 'celery_worker.pid'}",
            "--queues=default,sync_queue,download_queue,ai_queue,query_queue,follow_queue,monitor_queue",
            "--detach"
        ]
        
        # 切换到 backend 目录执行
        result = subprocess.run(
            cmd,
            cwd=str(backend_dir),
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # 读取 PID 文件获取进程 ID
            worker_pid_file = logs_dir / "celery_worker.pid"
            if worker_pid_file.exists():
                try:
                    with open(worker_pid_file, 'r') as f:
                        _celery_worker_pid = int(f.read().strip())
                    print(f"✅ Celery Worker 已启动 (PID: {_celery_worker_pid})")
                    return True
                except (ValueError, FileNotFoundError):
                    print("⚠️  Celery Worker 已启动，但无法读取 PID 文件")
                    return True
            else:
                print("⚠️  Celery Worker 启动命令执行成功，但未找到 PID 文件")
                return True
        else:
            print(f"❌ Celery Worker 启动失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ 启动 Celery Worker 时出错: {str(e)}")
        import traceback
        print(f"   详细错误: {traceback.format_exc()}")
        return False


def start_celery_beat():
    """启动 Celery Beat"""
    global _celery_beat_pid
    try:
        backend_dir = Path(__file__).parent
        logs_dir = backend_dir / "logs"
        logs_dir.mkdir(exist_ok=True)
        
        # 构建启动命令
        cmd = [
            sys.executable, "-m", "celery",
            "-A", "celery_app",
            "beat",
            "--loglevel=info",
            f"--logfile={logs_dir / 'celery_beat.log'}",
            f"--pidfile={logs_dir / 'celery_beat.pid'}",
            "--detach"
        ]
        
        # 切换到 backend 目录执行
        result = subprocess.run(
            cmd,
            cwd=str(backend_dir),
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # 读取 PID 文件获取进程 ID
            beat_pid_file = logs_dir / "celery_beat.pid"
            if beat_pid_file.exists():
                try:
                    with open(beat_pid_file, 'r') as f:
                        _celery_beat_pid = int(f.read().strip())
                    print(f"✅ Celery Beat 已启动 (PID: {_celery_beat_pid})")
                    return True
                except (ValueError, FileNotFoundError):
                    print("⚠️  Celery Beat 已启动，但无法读取 PID 文件")
                    return True
            else:
                print("⚠️  Celery Beat 启动命令执行成功，但未找到 PID 文件")
                return True
        else:
            print(f"❌ Celery Beat 启动失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ 启动 Celery Beat 时出错: {str(e)}")
        import traceback
        print(f"   详细错误: {traceback.format_exc()}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动事件
    print("🚀 DCC数字员工服务启动中...")
    
    # 自动启动任务监控
    try:
        # 先测试 Redis 连接
        redis_config_ok = False
        REDIS_HOST = 'localhost'
        REDIS_PORT = 6379
        REDIS_DB = 0
        REDIS_PASSWORD = ''
        
        try:
            import redis
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            # 读取 Redis 配置（与 celery_app.py 保持一致）
            REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
            REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
            REDIS_DB = int(os.getenv('REDIS_DB', '0'))
            REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')
            
            redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD if REDIS_PASSWORD else None,
                socket_connect_timeout=2,
                socket_timeout=2
            )
            redis_client.ping()
            redis_config_ok = True
            print(f"✅ Redis 连接成功 ({REDIS_HOST}:{REDIS_PORT}/{REDIS_DB})")
        except ImportError:
            print("⚠️  Redis 客户端库未安装")
            print("💡 提示：请安装依赖：pip install redis")
        except Exception as e:
            # 检查是否是连接错误
            error_type = type(e).__name__
            if 'Connection' in error_type or 'ConnectionError' in str(type(e)):
                print(f"❌ Redis 连接失败: {str(e)}")
                print(f"   配置信息: {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
                print("💡 提示：请检查 Redis 服务是否运行")
                print("   macOS: brew services start redis")
                print("   Linux: sudo systemctl start redis")
                print("   或检查环境变量 REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD")
            else:
                print(f"⚠️  Redis 连接测试失败: {str(e)}")
        
        # 尝试导入 Celery 相关模块
        try:
            import celery
        except ImportError:
            print("⚠️  Celery 未安装，自动化任务监控功能不可用")
            print("💡 提示：请安装依赖：pip install -r requirements.txt")
        else:
            try:
                # 延迟导入，避免启动时的循环导入问题
                # 先导入 celery_app，再导入任务模块
                from celery_app import celery_app
                import time
                
                # 延迟导入任务模块，避免在模块级别导入时出错
                # 使用 try-except 包装，确保导入失败时不会导致服务启动失败
                try:
                    from celery_tasks.task_monitor import monitor_pending_tasks
                except ImportError as import_e:
                    print(f"⚠️  无法导入监控任务模块: {str(import_e)}")
                    print("💡 提示：请确保已安装所有依赖：pip install -r requirements.txt")
                    import traceback
                    print(f"   详细错误: {traceback.format_exc()}")
                    raise  # 重新抛出异常，让外层捕获并允许服务继续启动
                except Exception as import_e:
                    # 捕获其他可能的导入错误（如循环导入、语法错误等）
                    print(f"⚠️  导入监控任务模块时出错: {str(import_e)}")
                    import traceback
                    print(f"   详细错误: {traceback.format_exc()}")
                    raise  # 重新抛出异常，让外层捕获并允许服务继续启动
                
                # 检查 Celery Worker 和 Beat 是否运行
                worker_running, worker_pid = check_celery_worker_running()
                beat_running, beat_pid = check_celery_beat_running()
                
                # 如果 Worker 未运行，尝试自动启动
                if not worker_running:
                    print("⚠️  Celery Worker 未运行，尝试自动启动...")
                    if start_celery_worker():
                        worker_running = True
                        # 等待 Worker 启动
                        await asyncio.sleep(2)
                    else:
                        print("❌ 自动启动 Celery Worker 失败")
                else:
                    print(f"✅ Celery Worker 已在运行 (PID: {worker_pid})")
                
                # 如果 Beat 未运行，尝试自动启动
                if not beat_running:
                    print("⚠️  Celery Beat 未运行，尝试自动启动...")
                    if start_celery_beat():
                        beat_running = True
                        # 等待 Beat 启动
                        await asyncio.sleep(1)
                    else:
                        print("❌ 自动启动 Celery Beat 失败")
                else:
                    print(f"✅ Celery Beat 已在运行 (PID: {beat_pid})")
                
                # 等待一小段时间，确保 Celery 连接已建立
                await asyncio.sleep(1.0)
                
                # 检查 Celery Worker 是否可用（如果进程存在，尝试多次检测）
                celery_available = False
                max_retries = 3
                retry_delay = 2.0
                
                for retry in range(max_retries):
                    try:
                        # 确保 celery_app 已正确初始化
                        if celery_app is None:
                            raise ValueError("celery_app 未初始化")
                        
                        inspect = celery_app.control.inspect(timeout=3.0)
                        if inspect is None:
                            raise ValueError("inspect 对象为 None")
                        
                        stats = inspect.stats()
                        if stats is not None and len(stats) > 0:
                            celery_available = True
                            worker_count = len(stats)
                            worker_names = list(stats.keys())
                            print(f"✅ 检测到 {worker_count} 个 Celery Worker 正在运行: {', '.join(worker_names)}")
                            break
                        else:
                            if retry < max_retries - 1:
                                print(f"⚠️  inspect.stats() 返回空结果（第 {retry + 1}/{max_retries} 次尝试），等待 {retry_delay} 秒后重试...")
                                await asyncio.sleep(retry_delay)
                            else:
                                print("⚠️  inspect.stats() 返回空结果（Worker 可能未完全启动）")
                                # 如果进程存在但 inspect 失败，尝试直接发送任务测试
                                try:
                                    test_result = monitor_pending_tasks.apply_async()
                                    celery_available = True
                                    print(f"✅ Celery Worker 连接正常（通过任务发送测试），任务ID: {test_result.id}")
                                    break
                                except Exception as test_e:
                                    test_error = str(test_e)
                                    print(f"⚠️  任务发送测试也失败: {test_error}")
                                    # 如果进程存在，即使检测失败也认为可能可用（Worker 可能正在启动）
                                    if worker_running:
                                        print("💡 Worker 进程存在，可能正在启动中，将继续尝试...")
                                        celery_available = True  # 假设可用，让后续任务尝试
                                        break
                    except Exception as inspect_e:
                        error_msg = str(inspect_e)
                        if retry < max_retries - 1:
                            print(f"⚠️  Celery Worker 检测失败（第 {retry + 1}/{max_retries} 次尝试）: {error_msg}，等待 {retry_delay} 秒后重试...")
                            await asyncio.sleep(retry_delay)
                        else:
                            print(f"⚠️  Celery Worker 检测失败: {error_msg}")
                            # 如果进程存在但检测失败，尝试直接发送任务
                            try:
                                test_result = monitor_pending_tasks.apply_async()
                                celery_available = True
                                print(f"✅ Celery Worker 连接正常（通过任务发送测试），任务ID: {test_result.id}")
                                break
                            except Exception as test_e:
                                test_error = str(test_e)
                                # 显示详细错误信息
                                print(f"❌ Celery Worker 连接失败: {test_error}")
                                if "Redis" in test_error or "Connection" in test_error:
                                    print("   原因：Redis 连接问题")
                                    print(f"   请检查 Redis 配置: {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
                                elif "timeout" in test_error.lower():
                                    print("   原因：连接超时（Worker 可能未运行）")
                                elif "No nodes" in test_error or "no active nodes" in test_error.lower():
                                    print("   原因：没有活跃的 Worker 节点")
                                else:
                                    print(f"   详细错误: {test_error}")
                                
                                # 如果进程存在，即使检测失败也认为可能可用（Worker 可能正在启动）
                                if worker_running:
                                    print("💡 Worker 进程存在，可能正在启动中，将继续尝试...")
                                    celery_available = True  # 假设可用，让后续任务尝试
                                    break
                
                if celery_available:
                    # 立即触发一次监控任务（不等待定时任务）
                    try:
                        result = monitor_pending_tasks.delay()
                        print(f"✅ 已触发自动化任务监控（立即执行一次），任务ID: {result.id}")
                        print("💡 提示：监控任务将每5分钟自动执行一次（需要 Celery Beat 运行）")
                        print("📋 任务执行日志请查看：")
                        print("   - Celery Worker 日志: backend/logs/celery_worker.log")
                        print("   - 后端服务日志: backend.log")
                        print("")
                        # 尝试获取任务状态（非阻塞）
                        try:
                            time.sleep(0.5)  # 等待一小段时间让任务开始执行
                            task_state = result.state
                            print(f"📊 任务状态: {task_state}")
                            if task_state == 'PENDING':
                                print("   ⏳ 任务已提交，等待 Worker 处理...")
                            elif task_state == 'STARTED':
                                print("   🔄 任务正在执行中...")
                            elif task_state == 'SUCCESS':
                                print("   ✅ 任务执行成功")
                                try:
                                    task_result = result.get(timeout=1)
                                    if task_result:
                                        processed = task_result.get('processed', 0)
                                        print(f"   📈 处理了 {processed} 个任务")
                                except:
                                    pass
                            elif task_state == 'FAILURE':
                                print("   ❌ 任务执行失败")
                        except Exception as state_e:
                            print(f"   ⚠️  无法获取任务状态: {str(state_e)}")
                        print("")
                    except Exception as e:
                        print(f"⚠️  自动化任务监控触发失败: {str(e)}")
                        import traceback
                        print(f"   详细错误: {traceback.format_exc()}")
                else:
                    print("⚠️  Celery Worker 未运行，自动化任务监控无法执行")
                    print("💡 提示：请先启动 Celery Worker 和 Beat：")
                    print("   cd backend && ./start_celery.sh")
                    print("   或者手动启动：")
                    print("   celery -A celery_app worker --loglevel=info")
                    print("   celery -A celery_app beat --loglevel=info")
                    print("✅ 服务将继续启动，但自动化任务监控功能不可用")
            except ImportError as e:
                print(f"⚠️  无法导入监控任务模块: {str(e)}")
                print("💡 提示：请确保已安装所有依赖：pip install -r requirements.txt")
                import traceback
                print(f"   详细错误: {traceback.format_exc()}")
                print("✅ 服务将继续启动，但自动化任务监控功能不可用")
                # 不抛出异常，允许服务继续启动
            except Exception as e:
                print(f"⚠️  启动自动化任务监控失败: {str(e)}")
                print("💡 提示：请确保已安装 Celery 并配置 Redis")
                print("   安装命令：pip install celery[redis] redis")
                import traceback
                print(f"   详细错误: {traceback.format_exc()}")
                print("✅ 服务将继续启动，但自动化任务监控功能不可用")
                # 不抛出异常，允许服务继续启动
    except Exception as e:
        print(f"⚠️  启动过程中出现错误: {str(e)}")
    
    yield
    
    # 关闭事件
    print("🛑 DCC数字员工服务正在关闭...")
    
    # 清理自动启动的 Celery 进程（可选）
    # 注意：由于使用了 --detach，这些进程是独立的，通常不需要手动清理
    # 如果需要清理，可以取消下面的注释
    # try:
    #     global _celery_worker_pid, _celery_beat_pid
    #     if _celery_worker_pid:
    #         try:
    #             process = psutil.Process(_celery_worker_pid)
    #             process.terminate()
    #             print(f"✅ 已停止 Celery Worker (PID: {_celery_worker_pid})")
    #         except (psutil.NoSuchProcess, psutil.AccessDenied):
    #             pass
    #     if _celery_beat_pid:
    #         try:
    #             process = psutil.Process(_celery_beat_pid)
    #             process.terminate()
    #             print(f"✅ 已停止 Celery Beat (PID: {_celery_beat_pid})")
    #         except (psutil.NoSuchProcess, psutil.AccessDenied):
    #             pass
    # except Exception as e:
    #     print(f"⚠️  清理 Celery 进程时出错: {str(e)}")


app = FastAPI(
    title="DCC数字员工服务API",
    description="""
    DCC数字员工后端服务API文档
    
    ## 功能模块
    
    * **健康检查** - 服务状态检查
    * **用户认证** - 用户登录和认证相关接口
    * **组织管理** - 组织创建和管理
    * **产品管理** - 产品分类和管理（需要access-token验证）
    * **线索管理** - 客户线索创建、管理和Excel导入（需要access-token验证）
    * **跟进管理** - 线索跟进记录创建和管理（需要access-token验证）
    * **任务管理** - 任务创建和管理（需要access-token验证）
    * **外呼任务管理** - 外呼任务创建和查询（需要access-token验证）
      
      任务列表请使用分页接口：`GET /api/task_list?page=1&page_size=20`（返回 `data.items` 与 `data.pagination`，支持滚动加载）。
      原 `/api/tasks` 已废弃，不再对外提供。
    
    ## 身份验证
    
    产品管理、线索管理和跟进管理接口需要在请求头中提供access-token进行身份验证：
    
    ```
    Headers:
    access-token: your-access-token-here
    ```
    
    默认访问令牌：`dcc-api-token-2024`
    
    ## 状态码说明
    
    * **1000** - 操作成功
    * **1001** - 数据重复/已存在
    * **1002** - 操作失败/系统错误
    * **1003** - 参数验证失败
    * **1004** - 数据不存在
    * **1005** - 权限不足/访问令牌无效
    * **2000** - 跟进操作成功
    * **2001** - 线索不存在
    * **2002** - 跟进操作失败
    * **2003** - 跟进记录不存在
    * **2004** - 任务不存在或无权限访问
    * **2005** - 获取任务信息失败

    """,
    version="1.0.0",
    contact={
        "name": "DCC开发团队",
        "email": "dev@dcc.com",
    },
    license_info={
        "name": "MIT",
    },
    openapi_tags=tags_metadata,
    docs_url=None,  # 禁用默认的Swagger UI
    redoc_url=None,  # 禁用默认的ReDoc
    lifespan=lifespan,  # 使用新的 lifespan 事件处理器
)

# 统一日志到文件 backend.log + 控制台
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[
        logging.FileHandler('backend.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，也可以指定特定的来源如 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # 明确允许所有方法包括 OPTIONS
    allow_headers=["*"],  # 允许所有头部
)

# 根路径路由
@app.get("/")
async def root():
    """根路径，返回 API 信息"""
    return {
        "message": "DCC数字员工服务API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
        "health": "/api/health"
    }

# 自定义文档路由
@app.get("/docs", response_class=HTMLResponse)
async def custom_swagger_ui_html():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DCC数字员工服务API - Swagger UI</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" type="text/css" href="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui-bundle.js"></script>
        <script src="https://cdn.bootcdn.net/ajax/libs/swagger-ui/5.9.0/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = function() {
                const ui = SwaggerUIBundle({
                    url: '/openapi.json',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "StandaloneLayout"
                });
            };
        </script>
    </body>
    </html>
    """)

@app.get("/redoc", response_class=HTMLResponse)
async def custom_redoc_html():
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DCC数字员工服务API - ReDoc</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
            }
        </style>
    </head>
    <body>
        <redoc spec-url="/openapi.json"></redoc>
        <script src="https://cdn.bootcdn.net/ajax/libs/redoc/2.0.0/redoc.standalone.js"></script>
    </body>
    </html>
    """)

# 注册所有路由
app.include_router(health_router, prefix="/api")
app.include_router(login_router, prefix="/api")
app.include_router(organization_router, prefix="/api")
app.include_router(scene_router, prefix="/api")
app.include_router(dcc_user_router, prefix="/api")
app.include_router(dcc_leads_router, prefix="/api")
app.include_router(auto_call_router, prefix="/api")
app.include_router(auth_verify_router, prefix="/api")
app.include_router(config_check_router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
