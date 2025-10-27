#!/bin/bash

# DCC数字员工系统 - 数据库字段和表修复脚本
# 修复task_type字段和dcc_leads_follow表的问题

set -e

echo "🔧 DCC数字员工系统 - 数据库修复"
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

# 修复call_tasks表的task_type字段
fix_call_tasks_table() {
    log_info "检查call_tasks表的task_type字段..."
    
    # 检查表是否存在
    local table_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'call_tasks';" 2>/dev/null | grep -c "call_tasks" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_warning "call_tasks表不存在，将创建表..."
        create_call_tasks_table
    else
        # 检查task_type字段是否存在
        local field_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE call_tasks;" 2>/dev/null | grep -c "task_type" || echo "0")
        
        if [ "$field_exists" -eq 0 ]; then
            log_info "添加task_type字段到call_tasks表..."
            docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
                ALTER TABLE call_tasks 
                ADD COLUMN task_type INT NOT NULL DEFAULT 1 COMMENT '任务类型:1:已创建；2:开始外呼；3:外呼完成；4:跟进完成；5:已暂停;';
            " 2>/dev/null
            
            if [ $? -eq 0 ]; then
                log_success "task_type字段添加成功"
            else
                log_error "task_type字段添加失败"
                exit 1
            fi
        else
            log_success "call_tasks表的task_type字段已存在"
        fi
    fi
}

# 创建call_tasks表
create_call_tasks_table() {
    log_info "创建call_tasks表..."
    
    docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
        CREATE TABLE IF NOT EXISTS call_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_name VARCHAR(100) NOT NULL COMMENT '任务名称',
            organization_id VARCHAR(50) NOT NULL COMMENT '组织ID',
            create_name_id VARCHAR(50) NOT NULL COMMENT '创建人ID',
            create_name VARCHAR(50) NOT NULL COMMENT '创建人名称',
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
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
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "call_tasks表创建成功"
    else
        log_error "call_tasks表创建失败"
        exit 1
    fi
}

# 修复dcc_leads_follow表
fix_dcc_leads_follow_table() {
    log_info "检查dcc_leads_follow表..."
    
    # 检查表是否存在
    local table_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'dcc_leads_follow';" 2>/dev/null | grep -c "dcc_leads_follow" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建dcc_leads_follow表..."
        create_dcc_leads_follow_table
    else
        log_success "dcc_leads_follow表已存在"
    fi
}

# 创建dcc_leads_follow表
create_dcc_leads_follow_table() {
    log_info "创建dcc_leads_follow表..."
    
    docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
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
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "dcc_leads_follow表创建成功"
    else
        log_error "dcc_leads_follow表创建失败"
        exit 1
    fi
}

# 修复leads_task_list表
fix_leads_task_list_table() {
    log_info "检查leads_task_list表..."
    
    # 检查表是否存在
    local table_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'leads_task_list';" 2>/dev/null | grep -c "leads_task_list" || echo "0")
    
    if [ "$table_exists" -eq 0 ]; then
        log_info "创建leads_task_list表..."
        create_leads_task_list_table
    else
        log_success "leads_task_list表已存在"
    fi
}

# 创建leads_task_list表
create_leads_task_list_table() {
    log_info "创建leads_task_list表..."
    
    docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
        CREATE TABLE IF NOT EXISTS leads_task_list (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL COMMENT '任务ID',
            leads_id VARCHAR(50) NOT NULL COMMENT '线索ID',
            leads_name VARCHAR(50) NOT NULL COMMENT '线索名称',
            leads_phone VARCHAR(50) NOT NULL COMMENT '线索手机号',
            call_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
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
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "leads_task_list表创建成功"
    else
        log_error "leads_task_list表创建失败"
        exit 1
    fi
}

# 验证修复结果
verify_fixes() {
    log_info "验证修复结果..."
    
    # 检查call_tasks表的task_type字段
    local task_type_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "DESCRIBE call_tasks;" 2>/dev/null | grep -c "task_type" || echo "0")
    
    if [ "$task_type_exists" -gt 0 ]; then
        log_success "call_tasks表的task_type字段验证通过"
    else
        log_error "call_tasks表的task_type字段验证失败"
        return 1
    fi
    
    # 检查dcc_leads_follow表
    local follow_table_exists=$(docker run --rm --network host mysql:8.0 mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'dcc_leads_follow';" 2>/dev/null | grep -c "dcc_leads_follow" || echo "0")
    
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
    echo "开始修复数据库问题..."
    echo ""
    
    check_env
    check_db_connection
    fix_call_tasks_table
    fix_dcc_leads_follow_table
    fix_leads_task_list_table
    verify_fixes
    
    log_success "数据库修复完成！"
    echo ""
    log_info "修复内容："
    log_info "1. ✅ 修复了call_tasks表的task_type字段问题"
    log_info "2. ✅ 创建了dcc_leads_follow表"
    log_info "3. ✅ 确保leads_task_list表存在"
    log_info ""
    log_info "现在可以正常使用以下API："
    log_info "- GET /api/task-stats (任务统计)"
    log_info "- GET /api/leads/statistics (线索统计)"
}

# 错误处理
trap 'log_error "数据库修复过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"
