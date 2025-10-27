-- Call tasks table
CREATE TABLE `call_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_name` varchar(50) NOT NULL COMMENT '任务名称',
  `organization_id` varchar(50) NOT NULL COMMENT '组织ID',
  `create_name_id` varchar(50) NOT NULL COMMENT '创建人ID',
  `create_name` varchar(50) NOT NULL COMMENT '创建人名称',
  `create_time` datetime NOT NULL COMMENT '创建时间',
  `leads_count` int NOT NULL COMMENT '线索数量',
  `script_id` varchar(50) DEFAULT NULL COMMENT '场景ID（脚本ID）',
  `task_type` int NOT NULL COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:跟进完成；5:已暂停;',
  `size_desc` json DEFAULT NULL COMMENT '筛选条件',
  `job_group_id` varchar(100) DEFAULT NULL,
  `updated_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='外呼任务表';
-- Call task details table


CREATE TABLE `leads_task_list` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL COMMENT '任务ID',
  `leads_id` varchar(50) NOT NULL COMMENT '线索ID',
  `leads_name` varchar(50) NOT NULL COMMENT '线索名称',
  `leads_phone` varchar(50) NOT NULL COMMENT '线索手机号',
  `call_time` datetime NOT NULL COMMENT '任务创建时间',
  `call_job_id` varchar(100) NOT NULL COMMENT '电话任务ID',
  `call_conversation` json DEFAULT NULL COMMENT '通话记录详情',
  `call_status` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'list_jobs 获取到的 tasks 的stauts',
  `planed_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '任务执行时间',
  `updated_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '数据更新时间',
  `recording_url` varchar(500) DEFAULT NULL COMMENT '录音文件URL',
  `call_task_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '通话ID，通过通话ID，获取录音文件',
  `calling_number` varchar(50) DEFAULT NULL COMMENT '主叫号码',
  `leads_follow_id` int DEFAULT NULL COMMENT '线索跟进ID',
  `is_interested` int DEFAULT NULL COMMENT '是否有意向，如果无法判断，则返回0，有意向返回1；无意向返回2',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1673 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='外呼任务明细表';
