-- 为dcc_leads表添加状态字段
ALTER TABLE `dcc_leads` 
ADD COLUMN `leads_status` int NOT NULL DEFAULT '0' COMMENT '线索状态：0=未处理，1=已分配，2=外呼中，3=已完成，4=已失败' AFTER `leads_type`,
ADD COLUMN `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER `leads_status`;

-- 添加状态字段的索引
ALTER TABLE `dcc_leads` 
ADD KEY `idx_leads_status` (`leads_status`); 