#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化任务监控启动脚本
"""

import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.auto_task_monitor import auto_task_monitor

async def main():
    """主函数"""
    print("启动自动化任务监控...")
    
    try:
        # 启动监控
        await auto_task_monitor.start_monitoring()
    except KeyboardInterrupt:
        print("\n收到中断信号，正在停止监控...")
        await auto_task_monitor.stop_monitoring()
    except Exception as e:
        print(f"监控过程中出现错误: {str(e)}")
        await auto_task_monitor.stop_monitoring()

if __name__ == "__main__":
    asyncio.run(main()) 