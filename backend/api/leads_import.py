from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import pandas as pd
import io
import os
from database.db import execute_update, execute_query
from .auth import verify_access_token

leads_import_router = APIRouter(tags=["线索导入"])

class ImportLeadsRequest(BaseModel):
    """导入线索请求"""
    organization_id: Optional[str] = None  # 组织ID，如果不提供则使用用户默认组织

class ImportLeadsResponse(BaseModel):
    """导入线索响应"""
    status: str
    code: int
    message: str
    data: Dict[str, Any]

class ImportLeadsResult(BaseModel):
    """导入结果详情"""
    success_count: int
    error_count: int
    skipped_count: int
    total_count: int
    errors: List[str]
    leads_ids: List[str]  # 成功导入的leads_id列表

@leads_import_router.post("/leads/import", response_model=ImportLeadsResponse)
async def import_leads_from_file(
    file: UploadFile = File(..., description="Excel文件，支持.xlsx和.xls格式"),
    organization_id: Optional[str] = Form(None, description="组织ID，如果不提供则使用用户默认组织"),
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    通过上传Excel文件导入线索数据
    
    支持的文件格式：
    - .xlsx (Excel 2007+)
    - .xls (Excel 97-2003)
    
    Excel文件必须包含以下列：
    - leads_user_name: 线索用户名称 (必填)
    - leads_user_phone: 线索用户手机号 (必填)
    - leads_product: 线索产品 (必填)
    - leads_type: 线索等级 (必填)
    
    可选列：
    - leads_id: 线索ID (如果不提供，将使用自增ID)
    - organization_id: 组织ID (如果不提供，使用用户默认组织)
    - leads_create_time: 线索创建时间 (如果不提供，使用当前时间)
    
    需要在请求头中提供access-token进行身份验证
    """
    try:
        # 验证文件类型
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4001,
                    "message": "未提供文件名"
                }
            )
        
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.xlsx', '.xls']:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4002,
                    "message": "不支持的文件格式，请上传.xlsx或.xls文件"
                }
            )
        
        # 获取用户信息
        user_id = token.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "令牌中缺少用户ID信息"
                }
            )
        
        # 获取用户组织ID
        org_query = "SELECT dcc_user_org_id FROM users WHERE id = %s"
        org_result = execute_query(org_query, (user_id,))
        
        if not org_result or not org_result[0].get('dcc_user_org_id'):
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 1003,
                    "message": "用户未绑定组织或组织ID无效"
                }
            )
        
        # 确定使用的组织ID
        final_organization_id = organization_id or org_result[0]['dcc_user_org_id']
        
        # 读取上传的文件
        file_content = await file.read()
        
        try:
            # 根据文件扩展名选择读取方式
            if file_extension == '.xlsx':
                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
            else:  # .xls
                df = pd.read_excel(io.BytesIO(file_content), engine='xlrd')
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4003,
                    "message": f"文件读取失败: {str(e)}"
                }
            )
        
        # 验证必需列
        required_columns = ['leads_user_name', 'leads_user_phone', 'leads_product', 'leads_type']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4004,
                    "message": f"Excel文件缺少必需列: {', '.join(missing_columns)}"
                }
            )
        
        # 执行导入
        result = await _import_leads_data(df, final_organization_id)
        
        return ImportLeadsResponse(
            status="success",
            code=1000,
            message="线索导入完成",
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"导入线索失败: {str(e)}"
            }
        )

async def _import_leads_data(df: pd.DataFrame, organization_id: str) -> Dict[str, Any]:
    """
    执行线索数据导入
    
    Args:
        df: pandas DataFrame，包含线索数据
        organization_id: 组织ID
    
    Returns:
        dict: 导入结果统计
    """
    success_count = 0
    error_count = 0
    skipped_count = 0
    errors = []
    leads_ids = []
    
    for idx, row in df.iterrows():
        try:
            # 处理leads_id字段
            leads_id = None
            if 'leads_id' in df.columns and pd.notna(row['leads_id']) and str(row['leads_id']).strip():
                leads_id = str(row['leads_id']).strip()
                # 检查是否已存在相同的leads_id
                existing = execute_query('SELECT id FROM dcc_leads WHERE leads_id = %s', (leads_id,))
                if existing:
                    skipped_count += 1
                    continue
            
            # 准备基础插入数据
            base_insert_data = {
                'leads_user_name': str(row['leads_user_name']) if pd.notna(row['leads_user_name']) else '',
                'leads_user_phone': str(row['leads_user_phone']) if pd.notna(row['leads_user_phone']) else '',
                'leads_product': str(row['leads_product']) if pd.notna(row['leads_product']) else '',
                'leads_type': str(row['leads_type']) if pd.notna(row['leads_type']) else '',
                'organization_id': str(row.get('organization_id', organization_id)) if pd.notna(row.get('organization_id')) else organization_id,
                'leads_create_time': row.get('leads_create_time', datetime.now()) if pd.notna(row.get('leads_create_time')) else datetime.now()
            }
            
            # 验证必填字段
            if not base_insert_data['leads_user_name']:
                errors.append(f'行 {idx + 1}: 线索用户名称不能为空')
                error_count += 1
                continue
            
            if not base_insert_data['leads_user_phone']:
                errors.append(f'行 {idx + 1}: 线索用户手机号不能为空')
                error_count += 1
                continue
            
            if not base_insert_data['leads_product']:
                errors.append(f'行 {idx + 1}: 线索产品不能为空')
                error_count += 1
                continue
            
            if not base_insert_data['leads_type']:
                errors.append(f'行 {idx + 1}: 线索等级不能为空')
                error_count += 1
                continue
            
            if leads_id:
                # 如果有leads_id，直接插入
                insert_data = base_insert_data.copy()
                insert_data['leads_id'] = leads_id
                
                insert_sql = '''
                INSERT INTO dcc_leads 
                (organization_id, leads_id, leads_user_name, leads_user_phone, leads_create_time, leads_product, leads_type)
                VALUES (%(organization_id)s, %(leads_id)s, %(leads_user_name)s, %(leads_user_phone)s, %(leads_create_time)s, %(leads_product)s, %(leads_type)s)
                '''
                
                result = execute_update(insert_sql, insert_data)
                final_leads_id = leads_id
            else:
                # 如果没有leads_id，先插入数据获取自增ID
                insert_sql_without_leads_id = '''
                INSERT INTO dcc_leads 
                (organization_id, leads_user_name, leads_user_phone, leads_create_time, leads_product, leads_type)
                VALUES (%(organization_id)s, %(leads_user_name)s, %(leads_user_phone)s, %(leads_create_time)s, %(leads_product)s, %(leads_type)s)
                '''
                
                result = execute_update(insert_sql_without_leads_id, base_insert_data)
                
                # 使用自增ID作为leads_id
                final_leads_id = str(result)
                
                # 更新leads_id字段
                update_sql = "UPDATE dcc_leads SET leads_id = %s WHERE id = %s"
                execute_update(update_sql, (final_leads_id, result))
            
            leads_ids.append(final_leads_id)
            success_count += 1
            
        except Exception as e:
            error_msg = f'行 {idx + 1} 导入失败: {str(e)}'
            errors.append(error_msg)
            error_count += 1
    
    return {
        "success_count": success_count,
        "error_count": error_count,
        "skipped_count": skipped_count,
        "total_count": len(df),
        "errors": errors,
        "leads_ids": leads_ids
    }

@leads_import_router.get("/leads/import/template")
async def download_import_template(
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    下载线索导入模板文件
    
    返回一个包含示例数据的Excel模板文件
    """
    try:
        # 创建示例数据
        template_data = [
            {
                'leads_id': 'LEAD001',  # 可选，如果不提供将使用自增ID
                'leads_user_name': '张三',
                'leads_user_phone': '13800138001',
                'leads_product': '产品A',
                'leads_type': 'A级',
                'organization_id': 'ORG001',  # 可选，如果不提供将使用用户默认组织
                'leads_create_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')  # 可选
            },
            {
                'leads_id': '',  # 空值示例
                'leads_user_name': '李四',
                'leads_user_phone': '13800138002',
                'leads_product': '产品B',
                'leads_type': 'B级',
                'organization_id': '',
                'leads_create_time': ''
            }
        ]
        
        # 创建DataFrame
        df = pd.DataFrame(template_data)
        
        # 创建Excel文件
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='线索数据', index=False)
        
        output.seek(0)
        
        from fastapi.responses import Response
        
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=leads_import_template.xlsx"}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"生成模板文件失败: {str(e)}"
            }
        )

@leads_import_router.post("/leads/import/validate", response_model=ImportLeadsResponse)
async def validate_import_file(
    file: UploadFile = File(..., description="Excel文件，支持.xlsx和.xls格式"),
    token: Dict[str, Any] = Depends(verify_access_token)
):
    """
    验证导入文件格式和数据有效性
    
    不执行实际导入，只验证文件格式和数据有效性
    """
    try:
        # 验证文件类型
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4001,
                    "message": "未提供文件名"
                }
            )
        
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.xlsx', '.xls']:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4002,
                    "message": "不支持的文件格式，请上传.xlsx或.xls文件"
                }
            )
        
        # 读取文件
        file_content = await file.read()
        
        try:
            if file_extension == '.xlsx':
                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
            else:
                df = pd.read_excel(io.BytesIO(file_content), engine='xlrd')
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4003,
                    "message": f"文件读取失败: {str(e)}"
                }
            )
        
        # 验证必需列
        required_columns = ['leads_user_name', 'leads_user_phone', 'leads_product', 'leads_type']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail={
                    "status": "error",
                    "code": 4004,
                    "message": f"Excel文件缺少必需列: {', '.join(missing_columns)}"
                }
            )
        
        # 验证数据有效性
        validation_errors = []
        for idx, row in df.iterrows():
            row_errors = []
            
            if pd.isna(row['leads_user_name']) or str(row['leads_user_name']).strip() == '':
                row_errors.append('线索用户名称不能为空')
            
            if pd.isna(row['leads_user_phone']) or str(row['leads_user_phone']).strip() == '':
                row_errors.append('线索用户手机号不能为空')
            
            if pd.isna(row['leads_product']) or str(row['leads_product']).strip() == '':
                row_errors.append('线索产品不能为空')
            
            if pd.isna(row['leads_type']) or str(row['leads_type']).strip() == '':
                row_errors.append('线索等级不能为空')
            
            if row_errors:
                validation_errors.append(f'行 {idx + 1}: {"; ".join(row_errors)}')
        
        if validation_errors:
            return ImportLeadsResponse(
                status="error",
                code=4005,
                message="数据验证失败",
                data={
                    "validation_errors": validation_errors,
                    "total_rows": len(df),
                    "error_rows": len(validation_errors)
                }
            )
        
        return ImportLeadsResponse(
            status="success",
            code=1000,
            message="文件验证通过",
            data={
                "total_rows": len(df),
                "valid_rows": len(df),
                "columns": list(df.columns)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "code": 5000,
                "message": f"验证文件失败: {str(e)}"
            }
        )
