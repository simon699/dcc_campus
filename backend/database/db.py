import pymysql
from pymysql.cursors import DictCursor
from contextlib import contextmanager
from dbutils.pooled_db import PooledDB
from config import config

# 数据库配置
DB_CONFIG = {
    'host': config.DB_HOST,
    'port': config.DB_PORT,
    'user': config.DB_USER,
    'password': config.DB_PASSWORD,
    'db': config.DB_NAME,
    'charset': 'utf8mb4',
    'cursorclass': DictCursor
}

# 创建连接池
pool = PooledDB(
    creator=pymysql,
    maxconnections=10,  # 连接池最大连接数
    mincached=2,        # 初始化连接数
    maxcached=5,        # 最大空闲连接数
    blocking=True,      # 连接池中如果没有可用连接，是否阻塞等待
    **DB_CONFIG
)

@contextmanager
def get_connection():
    """获取数据库连接的上下文管理器"""
    conn = pool.connection()
    try:
        yield conn
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def execute_query(query, params=None):
    """执行查询语句并返回结果"""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params or ())
            result = cursor.fetchall()
        conn.commit()
        return result

def execute_update(query, params=None):
    """执行更新、插入或删除操作"""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            affected_rows = cursor.execute(query, params or ())
            # 如果是INSERT操作，返回插入的ID
            if query.strip().upper().startswith('INSERT'):
                last_id = cursor.lastrowid
                conn.commit()
                return last_id
        conn.commit()
        return affected_rows

def execute_many(query, params_list):
    """批量执行SQL语句"""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            affected_rows = cursor.executemany(query, params_list)
        conn.commit()
        return affected_rows
