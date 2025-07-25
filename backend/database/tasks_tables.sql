-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
    task_name VARCHAR(100) NOT NULL COMMENT '任务名称',
    task_mode INT NOT NULL COMMENT '任务方式：1=手动，2=自动',
    task_type INT NOT NULL COMMENT '任务类型：1=通知类，2=触达类',
    execution_time DATETIME COMMENT '任务执行时间（自动任务时必填）',
    status INT NOT NULL DEFAULT 1 COMMENT '任务状态：1=待执行，2=执行中，3=已完成，4=已取消',
    creator VARCHAR(50) NOT NULL COMMENT '创建人',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    -- 索引
    INDEX idx_organization_id (organization_id),
    INDEX idx_status (status),
    INDEX idx_create_time (create_time),
    INDEX idx_execution_time (execution_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';

-- 任务线索关联表
CREATE TABLE IF NOT EXISTS task_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL COMMENT '任务ID',
    lead_id INT NOT NULL COMMENT '线索ID',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES clues(id) ON DELETE CASCADE,
    -- 联合唯一索引，防止重复关联
    UNIQUE KEY uk_task_lead (task_id, lead_id),
    INDEX idx_task_id (task_id),
    INDEX idx_lead_id (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务线索关联表';