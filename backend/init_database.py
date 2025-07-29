#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库初始化脚本
用于创建和更新数据库表结构
"""

import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def get_database_connection():
    """获取数据库连接"""
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'dcc_database')
        )
        return connection
    except Error as e:
        print(f"数据库连接失败: {e}")
        return None

def execute_sql_file(connection, file_path):
    """执行SQL文件"""
    try:
        cursor = connection.cursor()
        
        with open(file_path, 'r', encoding='utf-8') as file:
            sql_content = file.read()
        
        # 分割SQL语句
        sql_statements = sql_content.split(';')
        
        for statement in sql_statements:
            statement = statement.strip()
            if statement:
                cursor.execute(statement)
                print(f"执行SQL: {statement[:50]}...")
        
        connection.commit()
        cursor.close()
        print(f"成功执行SQL文件: {file_path}")
        
    except Error as e:
        print(f"执行SQL文件失败 {file_path}: {e}")

def update_database():
    """更新数据库结构"""
    connection = get_database_connection()
    if not connection:
        return
    
    try:
        # 执行创建表的SQL
        execute_sql_file(connection, 'database/create_tables.sql')
        
        # 执行更新DCC用户字段的SQL
        execute_sql_file(connection, 'database/update_dcc_user.sql')
        
        print("数据库更新完成！")
        
    except Exception as e:
        print(f"数据库更新失败: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    print("开始更新数据库结构...")
    update_database()
