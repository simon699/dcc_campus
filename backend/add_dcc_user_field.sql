-- 为users表添加dcc_user字段
ALTER TABLE users ADD COLUMN dcc_user VARCHAR(100) DEFAULT NULL COMMENT 'DCC账号'; 