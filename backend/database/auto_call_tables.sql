
CREATE TABLE IF NOT EXISTS auto_call_scene (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scene_id VARCHAR(50) NOT NULL COMMENT '场景ID',
    scene_name VARCHAR(50) NOT NULL COMMENT '场景名称',
    scene_detail VARCHAR(200) NOT NULL COMMENT '场景详情',
    scene_status INT NOT NULL COMMENT '场景状态:1:上线；0:下线；2:删除',
    scene_type INT NOT NULL COMMENT '场景类型:1:官方场景；2:自定义场景',
    scene_create_user_id VARCHAR(50) NOT NULL COMMENT '场景创建人ID',
    scene_create_user_name VARCHAR(50) NOT NULL COMMENT '场景创建人名称',
    scene_create_org_id VARCHAR(50) NOT NULL COMMENT '场景创建组织ID',
    scene_create_time DATETIME NOT NULL COMMENT '场景创建时间',
    bot_name VARCHAR(50) NOT NULL COMMENT '机器人名称',
    bot_sex INT  COMMENT '机器人性别:1:男；2:女;3:不确定',
    bot_age INT  COMMENT '机器人年龄',
    bot_post VARCHAR(200) COMMENT '机器人身份:多个用分号隔开',
    bot_style VARCHAR(200) COMMENT '机器人风格:多个用分号隔开',
    dialogue_target VARCHAR(1000)  COMMENT '对话目标',
    dialogue_bg VARCHAR(1000) COMMENT '对话背景',
    dialogue_skill VARCHAR(1000) COMMENT '对话技能',
    dialogue_flow VARCHAR(1000) COMMENT '对话流程',
    dialogue_constraint VARCHAR(1000) COMMENT '对话限制',
    dialogue_opening_prompt VARCHAR(1000) COMMENT '对话开场白',

    INDEX idx_scene_id (scene_id),
    INDEX idx_scene_status (scene_status),
    INDEX idx_scene_type (scene_type),
    INDEX idx_scene_create_org_id (scene_create_org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动外呼场景表';



CREATE TABLE IF NOT EXISTS scene_tags(
    id INT AUTO_INCREMENT PRIMARY KEY,
    scene_id VARCHAR(50) NOT NULL COMMENT '场景ID',
    tag_name VARCHAR(50) NOT NULL COMMENT '标签名称',
    tag_detail VARCHAR(200) NOT NULL COMMENT '标签详情',
    tags VARCHAR(1000) NOT NULL COMMENT '标签:多个用分号隔开',
    INDEX idx_scene_id (scene_id),
    INDEX idx_tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动外呼场景标签表';
