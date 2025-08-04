-- 外呼任务表
CREATE TABLE IF NOT EXISTS outbound_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_group_id VARCHAR(100) NOT NULL UNIQUE COMMENT '阿里云外呼任务组ID',
    job_group_name VARCHAR(200) NOT NULL COMMENT '外呼任务组名称',
    description TEXT COMMENT '外呼任务组描述',
    script_id VARCHAR(100) COMMENT '场景ID（脚本ID）',
    strategy_json TEXT COMMENT '外呼策略配置（JSON格式）',
    lead_ids TEXT COMMENT '关联的线索ID列表（JSON格式）',
    status INT NOT NULL DEFAULT 1 COMMENT '任务状态：1=已创建，2=执行中，3=已完成，4=已暂停，5=已失败',
    creator VARCHAR(100) COMMENT '创建者',
    created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    -- 索引
    INDEX idx_job_group_id (job_group_id),
    INDEX idx_status (status),
    INDEX idx_created_time (created_time),
    INDEX idx_creator (creator)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外呼任务表';

-- 外呼任务执行记录表
CREATE TABLE IF NOT EXISTS outbound_call_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_group_id VARCHAR(100) NOT NULL COMMENT '外呼任务组ID',
    job_id VARCHAR(100) NOT NULL COMMENT '单个外呼任务ID',
    lead_id INT NOT NULL COMMENT '关联的线索ID',
    phone VARCHAR(20) NOT NULL COMMENT '拨打的电话号码',
    call_status VARCHAR(50) COMMENT '通话状态：Dialing=拨号中，Answered=已接通，Failed=失败，Busy=忙线，NoAnswer=无人接听',
    call_duration INT COMMENT '通话时长（秒）',
    call_result VARCHAR(100) COMMENT '通话结果',
    failure_reason VARCHAR(500) COMMENT '失败原因',
    call_time DATETIME COMMENT '通话时间',
    created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    -- 外键约束
    FOREIGN KEY (lead_id) REFERENCES dcc_leads(id) ON DELETE CASCADE,
    -- 索引
    INDEX idx_job_group_id (job_group_id),
    INDEX idx_job_id (job_id),
    INDEX idx_lead_id (lead_id),
    INDEX idx_call_status (call_status),
    INDEX idx_call_time (call_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外呼任务执行记录表';

-- 外呼任务统计表
CREATE TABLE IF NOT EXISTS outbound_call_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_group_id VARCHAR(100) NOT NULL COMMENT '外呼任务组ID',
    total_calls INT DEFAULT 0 COMMENT '总拨打次数',
    answered_calls INT DEFAULT 0 COMMENT '接通次数',
    failed_calls INT DEFAULT 0 COMMENT '失败次数',
    busy_calls INT DEFAULT 0 COMMENT '忙线次数',
    no_answer_calls INT DEFAULT 0 COMMENT '无人接听次数',
    total_duration INT DEFAULT 0 COMMENT '总通话时长（秒）',
    success_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '成功率（百分比）',
    avg_duration DECIMAL(5,2) DEFAULT 0.00 COMMENT '平均通话时长（秒）',
    created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    -- 索引
    INDEX idx_job_group_id (job_group_id),
    INDEX idx_created_time (created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外呼任务统计表'; 