-- DCC数据库初始化脚本
-- 创建时间: 2024
-- 描述: 初始化DCC数字员工系统数据库表结构

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(64) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    organization_id VARCHAR(20) NOT NULL,
    dcc_user VARCHAR(100) DEFAULT NULL,
    dcc_user_org_id VARCHAR(100) DEFAULT NULL,
    create_time DATETIME NOT NULL,
    user_role INT NOT NULL,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建DCC用户表
CREATE TABLE IF NOT EXISTS dcc_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL COMMENT '用户名称',
    user_password VARCHAR(50) NOT NULL COMMENT '用户密码',
    user_org_id VARCHAR(50) NOT NULL COMMENT '用户组织ID',
    user_status INT NOT NULL DEFAULT 1 COMMENT '用户状态:1:启用；0:禁用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_name (user_name),
    INDEX idx_user_org_id (user_org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DCC用户表';

-- 创建组织表
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    organization_id VARCHAR(20) NOT NULL UNIQUE,
    organization_type INT NOT NULL,
    create_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入初始管理员用户，密码是SHA256 hash of admin123
INSERT INTO users (username, password, phone, organization_id, create_time, user_role) 
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '13800000000', 'ORG001', NOW(), 1)
ON DUPLICATE KEY UPDATE id=id;
