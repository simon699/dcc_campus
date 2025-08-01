
-- 筛选线索任务表
CREATE TABLE IF NOT EXISTS call_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(50) NOT NULL COMMENT '任务名称',
    organization_id VARCHAR(50) NOT NULL COMMENT '组织ID',
    create_name_id VARCHAR(50) NOT NULL COMMENT '创建人ID',
    create_name VARCHAR(50) NOT NULL COMMENT '创建人名称',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    leads_count INT NOT NULL COMMENT '线索数量',
    scene_id VARCHAR(50)  COMMENT '场景ID',
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
