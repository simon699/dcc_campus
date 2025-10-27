#!/bin/bash

# DCC数字员工系统 - 完整数据库结构修复脚本
# 将所有SQL文件中的表和字段都创建到RDS中

set -e

echo "🔧 DCC数字员工系统 - 完整数据库结构修复"
echo "================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量配置..."
    if [ ! -f ".env" ]; then
        log_error "未找到.env文件，请先配置环境变量"
        exit 1
    fi
    source .env
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        log_error ".env文件中缺少数据库连接信息"
        exit 1
    fi
    log_success "环境变量配置检查通过"
}

# 检查数据库连接
check_db_connection() {
    log_info "检查数据库连接..."
    if docker run --rm --network host mysql:8.0 mysqladmin ping -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" >/dev/null 2>&1; then
        log_success "数据库连接成功"
    else
        log_error "数据库连接失败，请检查.env配置、RDS状态和网络连通性"
        exit 1
    fi
}

# 执行SQL命令
execute_sql() {
    local sql="$1"
    local description="$2"
    
    log_info "执行: $description"
    echo "$sql" | docker run --rm --network host -i mysql:8.0 \
        -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "$description 执行完成"
    else
        log_error "$description 执行失败"
        return 1
    fi
}

# 创建基础表结构
create_basic_tables() {
    log_info "创建基础表结构..."
    
    # 1. 用户表 (users)
    execute_sql "
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(64) NOT NULL,
            phone VARCHAR(20) NOT NULL UNIQUE,
            organization_id VARCHAR(20) NOT NULL DEFAULT 'DEFAULT_ORG',
            dcc_user VARCHAR(100) DEFAULT NULL,
            dcc_user_org_id VARCHAR(100) DEFAULT NULL,
            create_time DATETIME NOT NULL,
            user_role INT NOT NULL DEFAULT 2,
            update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_username (username),
            INDEX idx_phone (phone),
            INDEX idx_organization_id (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
    " "创建用户表"
    
    # 2. DCC用户表 (dcc_user)
    execute_sql "
        CREATE TABLE IF NOT EXISTS dcc_user (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_name VARCHAR(100) NOT NULL COMMENT '用户名称',
            user_password VARCHAR(255) NOT NULL COMMENT '用户密码',
            user_org_id VARCHAR(100) NOT NULL COMMENT '用户组织ID',
            user_status INT NOT NULL DEFAULT 1 COMMENT '用户状态:1:启用；0:禁用',
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            INDEX idx_user_name (user_name),
            INDEX idx_user_org_id (user_org_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DCC用户表';
    " "创建DCC用户表"
    
    # 3. 组织表 (organizations)
    execute_sql "
        CREATE TABLE IF NOT EXISTS organizations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            organization_id VARCHAR(20) NOT NULL UNIQUE,
            organization_type INT NOT NULL,
            create_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            INDEX idx_name (name),
            INDEX idx_organization_id (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';
    " "创建组织表"
}

# 创建呼叫任务相关表
create_call_task_tables() {
    log_info "创建呼叫任务相关表..."
    
    # 1. 外呼任务表 (call_tasks) - 使用完整版本
    execute_sql "
        CREATE TABLE IF NOT EXISTS call_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_name VARCHAR(50) NOT NULL COMMENT '任务名称',
            organization_id VARCHAR(50) NOT NULL COMMENT '组织ID',
            create_name_id VARCHAR(50) NOT NULL COMMENT '创建人ID',
            create_name VARCHAR(50) NOT NULL COMMENT '创建人名称',
            create_time DATETIME NOT NULL COMMENT '创建时间',
            leads_count INT NOT NULL COMMENT '线索数量',
            script_id VARCHAR(50) DEFAULT NULL COMMENT '场景ID（脚本ID）',
            task_type INT NOT NULL DEFAULT 1 COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:跟进完成；5:已暂停;',
            size_desc JSON DEFAULT NULL COMMENT '筛选条件',
            job_group_id VARCHAR(100) DEFAULT NULL,
            updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_organization_id (organization_id),
            INDEX idx_task_type (task_type),
            INDEX idx_create_time (create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='外呼任务表';
    " "创建外呼任务表"
    
    # 2. 外呼任务明细表 (leads_task_list)
    execute_sql "
        CREATE TABLE IF NOT EXISTS leads_task_list (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL COMMENT '任务ID',
            leads_id VARCHAR(50) NOT NULL COMMENT '线索ID',
            leads_name VARCHAR(50) NOT NULL COMMENT '线索名称',
            leads_phone VARCHAR(50) NOT NULL COMMENT '线索手机号',
            call_time DATETIME NOT NULL COMMENT '任务创建时间',
            call_job_id VARCHAR(100) NOT NULL COMMENT '电话任务ID',
            call_conversation JSON DEFAULT NULL COMMENT '通话记录详情',
            call_status VARCHAR(100) DEFAULT NULL COMMENT '通话状态',
            planed_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '任务执行时间',
            updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '数据更新时间',
            recording_url VARCHAR(500) DEFAULT NULL COMMENT '录音文件URL',
            call_task_id VARCHAR(100) DEFAULT NULL COMMENT '通话ID',
            calling_number VARCHAR(50) DEFAULT NULL COMMENT '主叫号码',
            leads_follow_id INT DEFAULT NULL COMMENT '线索跟进ID',
            is_interested INT DEFAULT NULL COMMENT '是否有意向，如果无法判断，则返回0，有意向返回1；无意向返回2',
            INDEX idx_task_id (task_id),
            INDEX idx_leads_id (leads_id),
            INDEX idx_call_job_id (call_job_id),
            INDEX idx_leads_follow_id (leads_follow_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='外呼任务明细表';
    " "创建外呼任务明细表"
    
    # 3. 呼叫记录表 (call_records)
    execute_sql "
        CREATE TABLE IF NOT EXISTS call_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL COMMENT '任务ID',
            phone_number VARCHAR(20) NOT NULL COMMENT '电话号码',
            call_status INT NOT NULL COMMENT '呼叫状态:0:未呼叫,1:呼叫中,2:已接通,3:未接通,4:忙线,5:关机',
            call_duration INT DEFAULT 0 COMMENT '通话时长(秒)',
            call_time DATETIME NULL COMMENT '呼叫时间',
            recording_url VARCHAR(500) NULL COMMENT '录音文件URL',
            notes TEXT NULL COMMENT '备注',
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            INDEX idx_task_id (task_id),
            INDEX idx_phone_number (phone_number),
            INDEX idx_call_status (call_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='呼叫记录表';
    " "创建呼叫记录表"
}

# 创建DCC线索相关表
create_dcc_leads_tables() {
    log_info "创建DCC线索相关表..."
    
    # 1. DCC线索表 (dcc_leads) - 使用完整版本
    execute_sql "
        CREATE TABLE IF NOT EXISTS dcc_leads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id VARCHAR(20) NOT NULL COMMENT '组织ID',
            leads_id VARCHAR(20) NOT NULL COMMENT '线索ID',
            leads_user_name VARCHAR(50) NOT NULL COMMENT '线索用户名称',
            leads_user_phone VARCHAR(20) NOT NULL COMMENT '线索用户手机号',
            leads_create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '线索创建时间',
            leads_product VARCHAR(100) NOT NULL COMMENT '线索产品',
            leads_type VARCHAR(100) NOT NULL COMMENT '线索等级',
            INDEX idx_organization_id (organization_id),
            INDEX idx_leads_id (leads_id),
            INDEX idx_leads_user_phone (leads_user_phone),
            INDEX idx_leads_create_time (leads_create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='DCC线索表';
    " "创建DCC线索表"
    
    # 2. DCC线索跟进表 (dcc_leads_follow)
    execute_sql "
        CREATE TABLE IF NOT EXISTS dcc_leads_follow (
            id INT AUTO_INCREMENT PRIMARY KEY,
            leads_id INT NOT NULL COMMENT '线索ID',
            follow_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '跟进时间',
            leads_remark VARCHAR(1000) DEFAULT NULL COMMENT '跟进备注',
            frist_follow_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次跟进时间',
            new_follow_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最新跟进时间',
            next_follow_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '下次跟进时间',
            is_arrive INT NOT NULL DEFAULT 0 COMMENT '是否到店:0:否；1:是',
            frist_arrive_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '首次到店时间',
            INDEX idx_leads_id (leads_id),
            INDEX idx_follow_time (follow_time),
            INDEX idx_frist_follow_time (frist_follow_time),
            INDEX idx_new_follow_time (new_follow_time),
            INDEX idx_next_follow_time (next_follow_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='DCC线索跟进表';
    " "创建DCC线索跟进表"
}

# 创建自动呼叫相关表
create_auto_call_tables() {
    log_info "创建自动呼叫相关表..."
    
    # 1. 自动呼叫任务表 (auto_call_tasks)
    execute_sql "
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
    " "创建自动呼叫任务表"
    
    # 2. 自动呼叫记录表 (auto_call_records)
    execute_sql "
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
            INDEX idx_call_status (call_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动呼叫记录表';
    " "创建自动呼叫记录表"
    
    # 3. 自动外呼场景表 (auto_call_scene)
    execute_sql "
        CREATE TABLE IF NOT EXISTS auto_call_scene (
            id INT AUTO_INCREMENT PRIMARY KEY,
            script_id VARCHAR(50) NOT NULL COMMENT '场景ID（脚本ID）',
            scene_name VARCHAR(50) NOT NULL COMMENT '场景名称',
            scene_detail VARCHAR(200) NOT NULL COMMENT '场景详情',
            scene_status INT NOT NULL COMMENT '场景状态:1:上线；0:下线；2:删除',
            scene_type INT NOT NULL COMMENT '场景类型:1:官方场景；2:自定义场景',
            scene_create_user_id VARCHAR(50) NOT NULL COMMENT '场景创建人ID',
            scene_create_user_name VARCHAR(50) NOT NULL COMMENT '场景创建人名称',
            scene_create_org_id VARCHAR(50) NOT NULL COMMENT '场景创建组织ID',
            scene_create_time DATETIME NOT NULL COMMENT '场景创建时间',
            bot_name VARCHAR(50) NOT NULL COMMENT '机器人名称',
            bot_sex INT COMMENT '机器人性别:1:男；2:女;3:不确定',
            bot_age INT COMMENT '机器人年龄',
            bot_post VARCHAR(200) COMMENT '机器人身份:多个用分号隔开',
            bot_style VARCHAR(200) COMMENT '机器人风格:多个用分号隔开',
            dialogue_target VARCHAR(1000) COMMENT '对话目标',
            dialogue_bg VARCHAR(1000) COMMENT '对话背景',
            dialogue_skill VARCHAR(1000) COMMENT '对话技能',
            dialogue_flow VARCHAR(1000) COMMENT '对话流程',
            dialogue_constraint VARCHAR(1000) COMMENT '对话限制',
            dialogue_opening_prompt VARCHAR(1000) COMMENT '对话开场白',
            INDEX idx_script_id (script_id),
            INDEX idx_scene_status (scene_status),
            INDEX idx_scene_type (scene_type),
            INDEX idx_scene_create_org_id (scene_create_org_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动外呼场景表';
    " "创建自动外呼场景表"
    
    # 4. 场景标签表 (scene_tags)
    execute_sql "
        CREATE TABLE IF NOT EXISTS scene_tags (
            id INT AUTO_INCREMENT PRIMARY KEY,
            script_id VARCHAR(50) NOT NULL COMMENT '场景ID（脚本ID）',
            tag_name VARCHAR(50) NOT NULL COMMENT '标签名称',
            tag_detail VARCHAR(200) NOT NULL COMMENT '标签详情',
            tags VARCHAR(1000) NOT NULL COMMENT '标签:多个用分号隔开',
            INDEX idx_script_id (script_id),
            INDEX idx_tag_name (tag_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自动外呼场景标签表';
    " "创建场景标签表"
}

# 插入初始数据
insert_initial_data() {
    log_info "插入初始数据..."
    
    # 插入初始管理员用户
    execute_sql "
        INSERT INTO users (username, password, phone, organization_id, create_time, user_role) 
        VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '13800000000', 'ORG001', NOW(), 1)
        ON DUPLICATE KEY UPDATE id=id;
    " "插入初始管理员用户"
}

# 验证所有表
verify_tables() {
    log_info "验证所有表..."
    
    local tables=(
        "users"
        "dcc_user" 
        "organizations"
        "call_tasks"
        "leads_task_list"
        "call_records"
        "dcc_leads"
        "dcc_leads_follow"
        "auto_call_tasks"
        "auto_call_records"
        "auto_call_scene"
        "scene_tags"
    )
    
    for table in "${tables[@]}"; do
        local table_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE '$table';" 2>/dev/null | grep -c "$table" || echo "0")
        
        if [ "$table_exists" -gt 0 ]; then
            log_success "表 '$table' 存在"
        else
            log_error "表 '$table' 不存在"
            return 1
        fi
    done
    
    log_success "所有表验证通过"
}

# 主函数
main() {
    echo "开始完整数据库结构修复..."
    echo ""
    
    check_env
    check_db_connection
    create_basic_tables
    create_call_task_tables
    create_dcc_leads_tables
    create_auto_call_tables
    insert_initial_data
    verify_tables
    
    log_success "完整数据库结构修复完成！"
    echo ""
    log_info "修复内容："
    log_info "1. ✅ 创建了所有基础表 (users, dcc_user, organizations)"
    log_info "2. ✅ 创建了呼叫任务相关表 (call_tasks, leads_task_list, call_records)"
    log_info "3. ✅ 创建了DCC线索相关表 (dcc_leads, dcc_leads_follow)"
    log_info "4. ✅ 创建了自动呼叫相关表 (auto_call_tasks, auto_call_records, auto_call_scene, scene_tags)"
    log_info "5. ✅ 插入了初始管理员用户"
    log_info ""
    log_info "现在所有API都应该能正常工作："
    log_info "- GET /api/task-stats (任务统计)"
    log_info "- GET /api/leads/statistics (线索统计)"
    log_info "- 其他所有API接口"
}

# 错误处理
trap 'log_error "数据库修复过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
