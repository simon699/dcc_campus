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

def init_database():
    """初始化数据库和表结构"""
    # 连接到MySQL服务器（不指定数据库）
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # 创建数据库（如果不存在）
        db_name = os.getenv('DB_NAME', 'dcc_employee')
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"数据库 '{db_name}' 创建成功或已存在")
        
        # 选择数据库
        cursor.execute(f"USE `{db_name}`")
        
        # 读取SQL文件
        sql_file_path = os.path.join(os.path.dirname(__file__), 'create_tables.sql')
        with open(sql_file_path, 'r', encoding='utf-8') as sql_file:
            # 拆分SQL语句
            sql_commands = sql_file.read().split(';')
            
            # 执行每个SQL语句
            for command in sql_commands:
                if command.strip():
                    cursor.execute(command)
                    conn.commit()
        
        print("表结构初始化成功")
    
    except Exception as e:
        print(f"初始化过程中出错: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_database() 