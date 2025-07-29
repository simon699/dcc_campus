-- 为users表添加dcc_user字段
-- 如果字段不存在则添加
ALTER TABLE users ADD COLUMN IF NOT EXISTS dcc_user VARCHAR(100) DEFAULT NULL COMMENT 'DCC账号'; 