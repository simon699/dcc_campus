-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(64) NOT NULL COMMENT '密码(加密后)',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
    organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    user_role INT NOT NULL COMMENT '用户角色：1:组织管理员;2:组织员工',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- 创建初始用户，密码为admin123的SHA256哈希
INSERT INTO users (username, password, phone, ogranization_id, create_time, user_role) 
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '13800000000', 'ORG001', NOW(), 1)
ON DUPLICATE KEY UPDATE id=id; 


-- 创建组织表
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '公司名称',
    organization_id VARCHAR(20) NOT NULL UNIQUE COMMENT '组织ID',
    organization_type INT NOT NULL COMMENT '组织类型，1:已认证；2:未认证',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    end_time DATETIME NOT NULL COMMENT '到期时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';

