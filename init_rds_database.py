#!/usr/bin/env python3
"""
阿里云RDS数据库初始化脚本
用于在RDS上创建数据库和表结构
"""

import pymysql
import os
import sys
from pathlib import Path

# 添加backend目录到Python路径
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from config import config

def create_database():
    """创建数据库"""
    try:
        # 连接到MySQL服务器（不指定数据库）
        connection = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # 创建数据库
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {config.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"✅ 数据库 {config.DB_NAME} 创建成功")
            
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ 创建数据库失败: {e}")
        return False

def create_tables():
    """创建表结构"""
    try:
        # 连接到指定数据库
        connection = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # 读取并执行SQL文件
            sql_files = [
                "backend/database/01_create_tables.sql",
                "backend/database/02_call_tasks.sql", 
                "backend/database/03_auto_call_tables.sql",
                "backend/database/04_dcc_leads.sql"
            ]
            
            for sql_file in sql_files:
                sql_path = Path(__file__).parent / sql_file
                if sql_path.exists():
                    print(f"📄 执行SQL文件: {sql_file}")
                    with open(sql_path, 'r', encoding='utf-8') as f:
                        sql_content = f.read()
                        
                    # 分割SQL语句并执行
                    sql_statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
                    for statement in sql_statements:
                        if statement:
                            cursor.execute(statement)
                    
                    print(f"✅ {sql_file} 执行完成")
                else:
                    print(f"⚠️  SQL文件不存在: {sql_file}")
            
            connection.commit()
            print("✅ 所有表创建完成")
            
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ 创建表失败: {e}")
        return False

def test_connection():
    """测试数据库连接"""
    try:
        connection = pymysql.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()
            print(f"✅ 数据库连接成功，版本: {version[0]}")
            
        connection.close()
        return True
        
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

def main():
    """主函数"""
    print("🚀 开始初始化阿里云RDS数据库...")
    print(f"📊 数据库配置:")
    print(f"   主机: {config.DB_HOST}")
    print(f"   端口: {config.DB_PORT}")
    print(f"   用户: {config.DB_USER}")
    print(f"   数据库: {config.DB_NAME}")
    print()
    
    # 测试连接
    if not test_connection():
        print("❌ 无法连接到数据库，请检查配置")
        return False
    
    # 创建数据库
    if not create_database():
        print("❌ 数据库创建失败")
        return False
    
    # 创建表
    if not create_tables():
        print("❌ 表创建失败")
        return False
    
    print("🎉 数据库初始化完成！")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
