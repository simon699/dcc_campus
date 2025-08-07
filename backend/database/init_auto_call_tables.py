import os
import pymysql
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 数据库配置
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'charset': 'utf8mb4'
}

def init_auto_call_tables():
    """初始化外呼相关的表结构"""
    # 连接到MySQL服务器
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # 选择数据库
        db_name = os.getenv('DB_NAME', 'dcc_employee_db')
        cursor.execute(f"USE `{db_name}`")
        
        # 读取外呼表SQL文件
        sql_file_path = os.path.join(os.path.dirname(__file__), 'outbound_calls_tables.sql')
        with open(sql_file_path, 'r', encoding='utf-8') as sql_file:
            # 拆分SQL语句
            sql_commands = sql_file.read().split(';')
            
            # 执行每个SQL语句
            for command in sql_commands:
                if command.strip():
                    cursor.execute(command)
                    conn.commit()
        
        print("外呼相关表结构初始化成功")
    
    except Exception as e:
        print(f"初始化外呼表过程中出错: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_auto_call_tables() 