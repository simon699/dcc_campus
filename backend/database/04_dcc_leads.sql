CREATE TABLE `dcc_leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` varchar(20) NOT NULL COMMENT '组织ID',
  `leads_id` varchar(20) NOT NULL COMMENT '线索ID',
  `leads_user_name` varchar(50) NOT NULL COMMENT '线索用户名称',
  `leads_user_phone` varchar(20) NOT NULL COMMENT '线索用户手机号',
  `leads_create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '线索创建时间',
  `leads_product` varchar(100) NOT NULL COMMENT '线索产品',
  `leads_type` varchar(100) NOT NULL COMMENT '线索等级',
  PRIMARY KEY (`id`),
  KEY `idx_organization_id` (`organization_id`),
  KEY `idx_leads_id` (`leads_id`),
  KEY `idx_leads_user_phone` (`leads_user_phone`),
  KEY `idx_leads_create_time` (`leads_create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=15095 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='DCC线索表';


CREATE TABLE `dcc_leads_follow` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leads_id` int NOT NULL COMMENT '线索ID',
  `follow_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '跟进时间',
  `leads_remark` varchar(1000) DEFAULT NULL COMMENT '跟进备注',
  `frist_follow_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '首次跟进时间',
  `new_follow_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '最新跟进时间',
  `next_follow_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '下次跟进时间',
  `is_arrive` int NOT NULL DEFAULT '0' COMMENT '是否到店:0:否；1:是',
  `frist_arrive_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '首次到店时间',
  PRIMARY KEY (`id`),
  KEY `idx_leads_id` (`leads_id`),
  KEY `idx_follow_time` (`follow_time`),
  KEY `idx_frist_follow_time` (`frist_follow_time`),
  KEY `idx_new_follow_time` (`new_follow_time`),
  KEY `idx_next_follow_time` (`next_follow_time`)
) ENGINE=InnoDB AUTO_INCREMENT=17509 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='DCC线索跟进表';
