-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(64) NOT NULL COMMENT '密码(加密后)',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
    organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
    dcc_user VARCHAR(100) DEFAULT NULL COMMENT 'DCC账号',
    dcc_user_org_id VARCHAR(100) DEFAULT NULL COMMENT 'DCC组织ID',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    user_role INT NOT NULL COMMENT '用户角色：1:组织管理员;2:组织员工',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- 创建初始用户，密码为admin123的SHA256哈希
INSERT INTO users (username, password, phone, organization_id, create_time, user_role) 
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

-- 筛选线索任务表
CREATE TABLE IF NOT EXISTS call_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(50) NOT NULL COMMENT '任务名称',
    organization_id VARCHAR(50) NOT NULL COMMENT '组织ID',
    create_name_id VARCHAR(50) NOT NULL COMMENT '创建人ID',
    create_name VARCHAR(50) NOT NULL COMMENT '创建人名称',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    leads_count INT NOT NULL COMMENT '线索数量',
    script_id VARCHAR(50)  COMMENT '场景ID（脚本ID）',
    task_type INT NOT NULL COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:已删除,',
    size_desc JSON COMMENT '筛选条件'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外呼任务表';

-- 筛选线索任务明细表
CREATE TABLE IF NOT EXISTS leads_task_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL COMMENT '任务ID',
    leads_id VARCHAR(50) NOT NULL COMMENT '线索ID',
    leads_name VARCHAR(50) NOT NULL COMMENT '线索名称',
    leads_phone VARCHAR(50) NOT NULL COMMENT '线索手机号',
    call_type INT NOT NULL COMMENT '电话状态：0:未开始；1:未接通；2：已接通；3:已终止',
    call_time DATETIME NOT NULL COMMENT '通话时间',
    call_job_id VARCHAR(100) NOT NULL COMMENT '电话任务ID',
    call_id VARCHAR(100) NOT NULL COMMENT '通话ID',
    call_user_id VARCHAR(100) NOT NULL COMMENT '通话录音地址',
    call_conversation JSON COMMENT '通话记录详情'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外呼任务明细表';

