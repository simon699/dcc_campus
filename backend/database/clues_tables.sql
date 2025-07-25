-- 修正后的线索表结构

CREATE TABLE IF NOT EXISTS clues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
    client_name VARCHAR(50) NOT NULL COMMENT '姓名',
    phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号（唯一）',
    source VARCHAR(50) NOT NULL COMMENT '线索来源',
    product VARCHAR(50) NOT NULL COMMENT '意向产品',
    create_name VARCHAR(50) NOT NULL COMMENT '创建人',
    clues_status INT NOT NULL DEFAULT 1 COMMENT '状态：1:未跟进；2:跟进中；3:已成单；0:已战败',
    client_level INT NOT NULL DEFAULT 5 COMMENT '客户等级：1:H 级；2:A 级；3:B 级；4:C 级；5:N 级；6:O 级;7:F 级',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    -- 组织ID索引,用于按组织快速查询
    INDEX idx_organization_id (organization_id),
    -- 线索状态索引,用于筛选不同状态的线索
    INDEX idx_clues_status (clues_status),
    -- 客户等级索引,用于按客户等级分类查询
    INDEX idx_client_level (client_level),
    -- 创建时间索引,用于按时间范围查询和排序
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索信息表';

-- 修正后的线索跟进表
CREATE TABLE IF NOT EXISTS follows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clues_id INT NOT NULL COMMENT '线索ID',
    follow_type INT NOT NULL COMMENT '跟进类型：1:手动跟进；2:AI电话跟进',
    follow_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '跟进时间',
    follower VARCHAR(20) COMMENT '跟进人',
    next_follow_time DATETIME COMMENT '下次跟进时间',
    plan_visit_time DATETIME COMMENT '计划到店时间',
    remark VARCHAR(500) COMMENT '备注',
    -- 新增字段：跟进记录中的线索状态快照
    clues_status INT COMMENT '线索状态快照：1:未跟进；2:跟进中；3:已成单；0:已战败（记录跟进时的状态）',
    client_level INT COMMENT '客户等级快照：1:H级；2:A级；3:B级；4:C级；5:N级；6:O级；7:F级（记录跟进时的等级）',
    product VARCHAR(50) COMMENT '意向产品快照（记录跟进时的产品信息）',
    FOREIGN KEY (clues_id) REFERENCES clues(id) ON DELETE CASCADE,
    INDEX idx_clues_id (clues_id),
    INDEX idx_follow_time (follow_time),
    INDEX idx_next_follow_time (next_follow_time),
    -- 新增索引
    INDEX idx_clues_status (clues_status),
    INDEX idx_client_level (client_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索跟进表（包含跟进时的线索状态快照）';

-- 产品分类表（已存在，保持不变）
CREATE TABLE IF NOT EXISTS product_category (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INT,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    FOREIGN KEY (parent_id) REFERENCES product_category(id) ON DELETE CASCADE,
    INDEX idx_parent_id (parent_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品分类表';