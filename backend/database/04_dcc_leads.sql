-- DCC线索相关表结构
-- 创建DCC线索表
CREATE TABLE IF NOT EXISTS dcc_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_name VARCHAR(100) NOT NULL COMMENT '线索名称',
    phone_number VARCHAR(20) NOT NULL COMMENT '电话号码',
    company_name VARCHAR(200) NULL COMMENT '公司名称',
    position VARCHAR(100) NULL COMMENT '职位',
    industry VARCHAR(100) NULL COMMENT '行业',
    lead_source VARCHAR(100) NULL COMMENT '线索来源',
    lead_status INT NOT NULL DEFAULT 0 COMMENT '线索状态:0:新线索,1:跟进中,2:已转化,3:已放弃',
    follow_up_time DATETIME NULL COMMENT '跟进时间',
    notes TEXT NULL COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_phone_number (phone_number),
    INDEX idx_lead_status (lead_status),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DCC线索表';
