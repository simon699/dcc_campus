-- 为users表添加dcc_user字段
-- 如果字段不存在则添加
ALTER TABLE users ADD COLUMN IF NOT EXISTS dcc_user VARCHAR(100) DEFAULT NULL COMMENT 'DCC账号'; 
ALTER TABLE users ADD COLUMN IF NOT EXISTS dcc_user_org_id VARCHAR(100) DEFAULT NULL COMMENT 'DCC组织ID'; 

CREATE TABLE IF NOT EXISTS dcc_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(50) NOT NULL COMMENT '用户名称',
    user_password VARCHAR(50) NOT NULL COMMENT '用户密码',
    user_org_id VARCHAR(50) NOT NULL COMMENT '用户组织ID',
    user_status INT NOT NULL COMMENT '用户状态:1:启用；0:禁用',
    INDEX idx_user_name (user_name),
    INDEX idx_user_org_id (user_org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DCC用户表';




