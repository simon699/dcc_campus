#!/bin/bash

# DCC数字员工系统 - 快速数据库修复脚本
# 修复具体的字段和表问题

set -e

echo "🔧 DCC数字员工系统 - 快速数据库修复"
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

# 执行SQL命令
execute_sql() {
    local sql="$1"
    local description="$2"
    
    log_info "执行: $description"
    echo "$sql" | mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "$description 执行完成"
    else
        log_warning "$description 执行失败，可能字段已存在"
    fi
}

# 修复call_tasks表
fix_call_tasks_table() {
    log_info "修复call_tasks表..."
    
    # 检查表是否存在
    local table_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'call_tasks';" 2>/dev/null | grep -c "call_tasks" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建call_tasks表..."
        execute_sql "
            CREATE TABLE call_tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_name VARCHAR(50) NOT NULL COMMENT '任务名称',
                organization_id VARCHAR(50) NOT NULL COMMENT '组织ID',
                create_name_id VARCHAR(50) NOT NULL COMMENT '创建人ID',
                create_name VARCHAR(50) NOT NULL COMMENT '创建人名称',
                create_time DATETIME NOT NULL COMMENT '创建时间',
                leads_count INT NOT NULL DEFAULT 0 COMMENT '线索数量',
                script_id VARCHAR(50) DEFAULT NULL COMMENT '场景ID（脚本ID）',
                task_type INT NOT NULL DEFAULT 1 COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:跟进完成；5:已暂停;',
                size_desc JSON DEFAULT NULL COMMENT '筛选条件',
                job_group_id VARCHAR(100) DEFAULT NULL,
                updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_organization_id (organization_id),
                INDEX idx_task_type (task_type),
                INDEX idx_create_time (create_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='外呼任务表';
        " "创建call_tasks表"
    else
        log_info "call_tasks表已存在，检查字段..."
        
        # 添加缺失的字段
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS leads_count INT NOT NULL DEFAULT 0 COMMENT '线索数量';" "添加leads_count字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS size_desc JSON DEFAULT NULL COMMENT '筛选条件';" "添加size_desc字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS task_type INT NOT NULL DEFAULT 1 COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:跟进完成；5:已暂停;';" "添加task_type字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) NOT NULL DEFAULT 'DEFAULT_ORG' COMMENT '组织ID';" "添加organization_id字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS create_name_id VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT '创建人ID';" "添加create_name_id字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS create_name VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT '创建人名称';" "添加create_name字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS script_id VARCHAR(50) DEFAULT NULL COMMENT '场景ID（脚本ID）';" "添加script_id字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS job_group_id VARCHAR(100) DEFAULT NULL;" "添加job_group_id字段"
        execute_sql "ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;" "添加updated_time字段"
    fi
}

# 修复leads_task_list表
fix_leads_task_list_table() {
    log_info "修复leads_task_list表..."
    
    # 检查表是否存在
    local table_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'leads_task_list';" 2>/dev/null | grep -c "leads_task_list" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建leads_task_list表..."
        execute_sql "
            CREATE TABLE leads_task_list (
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
        " "创建leads_task_list表"
    else
        log_success "leads_task_list表已存在"
    fi
}

# 修复dcc_leads_follow表
fix_dcc_leads_follow_table() {
    log_info "修复dcc_leads_follow表..."
    
    # 检查表是否存在
    local table_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'dcc_leads_follow';" 2>/dev/null | grep -c "dcc_leads_follow" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建dcc_leads_follow表..."
        execute_sql "
            CREATE TABLE dcc_leads_follow (
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
        " "创建dcc_leads_follow表"
    else
        log_success "dcc_leads_follow表已存在"
    fi
}

# 修复dcc_leads表
fix_dcc_leads_table() {
    log_info "修复dcc_leads表..."
    
    # 检查表是否存在
    local table_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'dcc_leads';" 2>/dev/null | grep -c "dcc_leads" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建dcc_leads表..."
        execute_sql "
            CREATE TABLE dcc_leads (
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
        " "创建dcc_leads表"
    else
        log_success "dcc_leads表已存在"
    fi
}

# 验证修复结果
verify_fixes() {
    log_info "验证修复结果..."
    
    # 检查call_tasks表的字段
    local leads_count_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE call_tasks;" 2>/dev/null | grep -c "leads_count" || echo "0")
    local size_desc_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE call_tasks;" 2>/dev/null | grep -c "size_desc" || echo "0")
    
    if [ "$leads_count_exists" -gt 0 ] && [ "$size_desc_exists" -gt 0 ]; then
        log_success "call_tasks表字段验证通过"
    else
        log_error "call_tasks表字段验证失败"
        return 1
    fi
    
    # 检查dcc_leads_follow表
    local follow_table_exists=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'dcc_leads_follow';" 2>/dev/null | grep -c "dcc_leads_follow" || echo "0")
    
    if [ "$follow_table_exists" -gt 0 ]; then
        log_success "dcc_leads_follow表验证通过"
    else
        log_error "dcc_leads_follow表验证失败"
        return 1
    fi
    
    log_success "所有修复验证通过"
}

# 主函数
main() {
    echo "开始快速数据库修复..."
    echo ""
    
    check_env
    fix_call_tasks_table
    fix_leads_task_list_table
    fix_dcc_leads_follow_table
    fix_dcc_leads_table
    verify_fixes
    
    log_success "快速数据库修复完成！"
    echo ""
    log_info "修复内容："
    log_info "1. ✅ 修复了call_tasks表的leads_count和size_desc字段"
    log_info "2. ✅ 创建了dcc_leads_follow表"
    log_info "3. ✅ 确保leads_task_list表存在"
    log_info "4. ✅ 确保dcc_leads表存在"
    log_info ""
    log_info "现在可以正常使用以下API："
    log_info "- GET /api/tasks (任务列表)"
    log_info "- GET /api/task-stats (任务统计)"
    log_info "- GET /api/leads/statistics (线索统计)"
}

# 错误处理
trap 'log_error "数据库修复过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
