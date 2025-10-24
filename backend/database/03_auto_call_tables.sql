-- 自动呼叫相关表结构
-- 创建自动呼叫任务表
CREATE TABLE IF NOT EXISTS auto_call_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL COMMENT '任务名称',
    task_description TEXT COMMENT '任务描述',
    scene_id VARCHAR(50) NOT NULL COMMENT '场景ID',
    script_content TEXT NOT NULL COMMENT '脚本内容',
    task_status INT NOT NULL DEFAULT 0 COMMENT '任务状态:0:待执行,1:执行中,2:已完成,3:已暂停,4:已取消',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    start_time DATETIME NULL COMMENT '开始时间',
    end_time DATETIME NULL COMMENT '结束时间',
    total_calls INT DEFAULT 0 COMMENT '总呼叫数',
    success_calls INT DEFAULT 0 COMMENT '成功呼叫数',
    failed_calls INT DEFAULT 0 COMMENT '失败呼叫数',
    INDEX idx_task_status (task_status),
    INDEX idx_scene_id (scene_id),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动呼叫任务表';

-- 创建自动呼叫记录表
CREATE TABLE IF NOT EXISTS auto_call_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL COMMENT '任务ID',
    phone_number VARCHAR(20) NOT NULL COMMENT '电话号码',
    call_status INT NOT NULL COMMENT '呼叫状态:0:未呼叫,1:呼叫中,2:已接通,3:未接通,4:忙线,5:关机',
    call_duration INT DEFAULT 0 COMMENT '通话时长(秒)',
    call_time DATETIME NULL COMMENT '呼叫时间',
    recording_url VARCHAR(500) NULL COMMENT '录音文件URL',
    conversation_content TEXT NULL COMMENT '对话内容',
    call_result VARCHAR(100) NULL COMMENT '呼叫结果',
    notes TEXT NULL COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_task_id (task_id),
    INDEX idx_phone_number (phone_number),
    INDEX idx_call_status (call_status),
    FOREIGN KEY (task_id) REFERENCES auto_call_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动呼叫记录表';
