'use client';

import React, { useState, useEffect } from 'react';
import ScriptGenerationDrawer from './ScriptGenerationDrawer';
import { tasksAPI } from '../services/api';

interface Task {
  id: string;
  name: string;
  conditions: any[];
  targetCount: number;
  createdAt: string;
  status: 'pending' | 'script_configured' | 'completed';
  task_type?: number; // 1:已创建；2:开始外呼；3:外呼完成；4:已删除
  organization_id?: string;
  create_name?: string;
  script_id?: string;
  size_desc?: any;
  selectedScene?: Scene; // 添加选中的场景信息
  hasGeneratedScript?: boolean; // 添加是否已生成话术的标志
}

interface Scene {
  id: number;
  script_id: string;
  scene_name: string;
  scene_detail: string;
  scene_status: number;
  scene_type: number;
  scene_create_user_id: string;
  scene_create_user_name: string;
  scene_create_org_id: string;
  scene_create_time: string;
  bot_name: string;
  bot_sex: string | null;
  bot_age: number;
  bot_post: string;
  bot_style: string;
  dialogue_target: string;
  dialogue_bg: string;
  dialogue_skill: string | null;
  dialogue_flow: string;
  dialogue_constraint: string;
  dialogue_opening_prompt: string;
  scene_tags: any[];
}

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask?: Task;
  onConfigureScript?: (task: Task) => void;
  onStartCalling?: (task: Task) => void;
  onOutboundCallSuccess?: () => void; // 添加外呼成功回调
}

// 筛选条件英文到中文的映射
const filterConditionMap: { [key: string]: string } = {
  'leads_product': '线索产品',
  'leads_type': '线索等级',
  'first_follow': '首次跟进时间区间',
  'latest_follow': '最近跟进时间区间',
  'next_follow': '下次跟进时间区间',
  'first_arrive': '首次到店时间区间',
  'is_arrive': '是否到店',
};

export default function TaskDetailDrawer({ 
  isOpen, 
  onClose, 
  selectedTask, 
  onConfigureScript,
  onStartCalling,
  onOutboundCallSuccess
}: TaskDetailDrawerProps) {
  const [showScriptGeneration, setShowScriptGeneration] = useState(false);
  const [localSelectedTask, setLocalSelectedTask] = useState<Task | undefined>(selectedTask);

  // 根据task_type获取状态信息
  const getTaskStatusInfo = (taskType?: number) => {
    switch (taskType) {
      case 1:
        return { text: '已创建', color: 'bg-blue-500/20 text-blue-300' };
      case 2:
        return { text: '开始外呼', color: 'bg-green-500/20 text-green-300' };
      case 3:
        return { text: '外呼完成', color: 'bg-purple-500/20 text-purple-300' };
      case 4:
        return { text: '已删除', color: 'bg-red-500/20 text-red-300' };
      default:
        return { text: '未知状态', color: 'bg-gray-500/20 text-gray-300' };
    }
  };

  // 获取场景类型文本
  const getSceneTypeText = (type: number) => {
    return type === 1 ? '官方场景' : '自定义场景';
  };

  // 转换筛选条件为中文显示
  const formatFilterConditions = (conditions: any[] | undefined, sizeDesc: any) => {
    if (conditions && conditions.length > 0) {
      return conditions.map((condition, index) => {
        if (typeof condition === 'string') {
          return condition;
        }
        const label = condition.label || condition.key || '';
        const value = condition.value || condition.val || '';
        const chineseLabel = filterConditionMap[label] || label;
        return `${chineseLabel}: ${value}`;
      });
    } else if (sizeDesc) {
      const formattedConditions: string[] = [];
      
      // 处理时间区间字段
      const timeRanges: { [key: string]: { start?: string; end?: string; label: string } } = {};
      
      Object.entries(sizeDesc).forEach(([key, value]) => {
        const chineseKey = filterConditionMap[key] || key;
        
        // 处理时间区间字段
        if (key.includes('_start') || key.includes('_end')) {
          const baseKey = key.replace(/_start$|_end$/, '');
          const timeRangeKey = baseKey;
          
          if (!timeRanges[timeRangeKey]) {
            timeRanges[timeRangeKey] = {
              label: filterConditionMap[timeRangeKey] || baseKey,
              start: undefined,
              end: undefined
            };
          }
          
          if (key.endsWith('_start')) {
            timeRanges[timeRangeKey].start = String(value);
          } else if (key.endsWith('_end')) {
            timeRanges[timeRangeKey].end = String(value);
          }
        } else {
          // 非时间区间字段直接显示
          if (key === 'is_arrive') {
            const boolValue = value === '1' || value === 1 || value === true ? '是' : '否';
            formattedConditions.push(`${chineseKey}: ${boolValue}`);
          } else {
            formattedConditions.push(`${chineseKey}: ${String(value)}`);
          }
        }
      });
      
      // 处理时间区间显示
      Object.values(timeRanges).forEach(range => {
        if (range.start || range.end) {
          if (range.start && range.end) {
            formattedConditions.push(`${range.label}: ${range.start} 至 ${range.end}`);
          } else if (range.start) {
            formattedConditions.push(`${range.label}: ${range.start} 起`);
          } else if (range.end) {
            formattedConditions.push(`${range.label}: 至 ${range.end}`);
          }
        }
      });
      
      return formattedConditions;
    }
    return [];
  };

  // 更新本地任务状态
  useEffect(() => {
    if (selectedTask) {
      setLocalSelectedTask(selectedTask);
    }
  }, [selectedTask]);

  // 处理话术配置完成
  const handleScriptConfigured = (scene: Scene) => {
    if (localSelectedTask) {
      setLocalSelectedTask({
        ...localSelectedTask,
        selectedScene: scene,
        script_id: scene.script_id, // 添加script_id字段
        hasGeneratedScript: true
      });
    }
  };

  const handleConfigureScript = () => {
    setShowScriptGeneration(true);
  };

  const handleScriptGenerationClose = () => {
    setShowScriptGeneration(false);
  };

  const handleBackToTaskDetail = () => {
    setShowScriptGeneration(false);
  };

  const handleStartCalling = async () => {
    if (!localSelectedTask) return;

    // 验证是否有有效的script_id
    const scriptId = localSelectedTask.selectedScene?.script_id || localSelectedTask.script_id;
    if (!scriptId) {
      alert('请先配置话术场景，获取有效的脚本ID');
      return;
    }

    try {
      // 1. 获取任务线索列表
      const taskDetailsResponse = await tasksAPI.getCallTaskDetails(localSelectedTask.id);
      if (taskDetailsResponse.status !== 'success') {
        alert('获取任务线索失败，请重试');
        return;
      }

      const taskLeads = taskDetailsResponse.data.task_details || [];
      if (taskLeads.length === 0) {
        alert('该任务没有可用的线索');
        return;
      }

      // 2. 准备外呼数据
      const outboundData = {
        job_group_name: localSelectedTask.name,
        job_group_description: `执行任务：${localSelectedTask.name}`,
        strategy_json: {
          RepeatBy: "once",
          maxAttemptsPerDay: 3,
          minAttemptInterval: 120
        },
        lead_ids: taskLeads.map((lead: any) => parseInt(lead.leads_id)),
        script_id: scriptId, // 使用验证过的script_id
        extras: [
          {
            key: "ServiceId",
            value: ""
          },
          {
            key: "TenantId", 
            value: ""
          }
        ]
      };

      // 3. 调用外呼API
      const outboundResponse = await tasksAPI.createOutboundCall(outboundData);
      if (outboundResponse.status !== 'success') {
        alert(`外呼发起失败：${outboundResponse.message}`);
        return;
      }

      // 4. 更新任务状态为"开始外呼"
      const updateTaskResponse = await fetch('http://localhost:8000/api/update_task_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': localStorage.getItem('access_token') || '',
        },
        body: JSON.stringify({
          task_id: localSelectedTask.id,
          task_type: 2 // 开始外呼
        })
      });

      if (!updateTaskResponse.ok) {
        console.warn('任务状态更新失败，但外呼已发起');
        const errorText = await updateTaskResponse.text();
        console.error('任务状态更新错误:', errorText);
      }

      // 5. 更新leads_task_list中的call_job_id
      const jobsId = outboundResponse.data.jobs_id;
      const leadIds = outboundData.lead_ids;
      
      // 根据传入的leads_ids的顺序，写入到leads_task_list的call_job_id中
      for (let i = 0; i < leadIds.length && i < jobsId.length; i++) {
        const updateLeadResponse = await fetch('http://localhost:8000/api/update_lead_job_id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access-token': localStorage.getItem('access_token') || '',
          },
          body: JSON.stringify({
            task_id: localSelectedTask.id,
            leads_id: leadIds[i],
            call_job_id: jobsId[i]
          })
        });

        if (!updateLeadResponse.ok) {
          console.warn(`线索 ${leadIds[i]} 的job_id更新失败`);
          const errorText = await updateLeadResponse.text();
          console.error('更新线索job_id错误:', errorText);
        }
      }

      // 6. 显示成功消息
      alert('外呼任务已成功发起！外呼Agent开始工作。');
      
      // 7. 关闭抽屉
      onClose();

      // 通知父组件外呼成功
      onOutboundCallSuccess?.();

    } catch (error) {
      console.error('发起外呼失败:', error);
      alert('发起外呼失败，请重试');
    }
  };

  // 检查是否可以开始外呼
  const canStartCalling = () => {
    return localSelectedTask?.selectedScene && localSelectedTask?.hasGeneratedScript;
  };

  if (!isOpen || !localSelectedTask) return null;

  const filterConditions = formatFilterConditions(localSelectedTask.conditions, localSelectedTask.size_desc);

  return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">任务详情</h2>
              <p className="text-gray-300">查看任务详细信息和执行状态</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 任务状态和详情 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 任务状态 */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">任务状态</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">任务名称:</span>
                  <span className="text-white font-medium">{localSelectedTask.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">任务状态:</span>
                  <div className={`px-3 py-1 rounded-full text-sm ${getTaskStatusInfo(localSelectedTask.task_type).color}`}>
                    {getTaskStatusInfo(localSelectedTask.task_type).text}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">目标线索:</span>
                  <span className="text-green-400 font-bold text-lg">{localSelectedTask.targetCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">创建时间:</span>
                  <span className="text-white">{localSelectedTask.createdAt}</span>
                </div>
              </div>
            </div>

            {/* 筛选条件 */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">筛选条件</h3>
              <div className="space-y-3">
                {filterConditions.length > 0 ? (
                  filterConditions.map((condition, index) => (
                    <div key={`condition-${index}-${condition}`} className="flex items-center">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                      <span className="text-white">{condition}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm">无筛选条件</div>
                )}
              </div>
            </div>
          </div>

          {/* 场景信息 */}
          {localSelectedTask.selectedScene && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">已选择场景</h3>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-white font-medium">{localSelectedTask.selectedScene.scene_name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      localSelectedTask.selectedScene.scene_type === 1 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-green-500/20 text-green-300'
                    }`}>
                      {getSceneTypeText(localSelectedTask.selectedScene.scene_type)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-green-300 text-sm">话术已生成</span>
                    </div>
                    <button
                      onClick={handleConfigureScript}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg text-sm transition-colors"
                    >
                      切换场景
                    </button>
                  </div>
                </div>
                
                {/* 简化的场景信息展示 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">机器人信息</div>
                    <div className="text-white">
                      <div className="font-medium">{localSelectedTask.selectedScene.bot_name}</div>
                      <div className="text-gray-300 text-xs">{localSelectedTask.selectedScene.bot_post}</div>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">对话目标</div>
                    <div className="text-white text-xs line-clamp-2">
                      {localSelectedTask.selectedScene.dialogue_target}
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">开场白</div>
                    <div className="text-white text-xs line-clamp-2">
                      {localSelectedTask.selectedScene.dialogue_opening_prompt}
                    </div>
                  </div>
                </div>
                
                {/* 场景标签展示 */}
                {localSelectedTask.selectedScene.scene_tags && localSelectedTask.selectedScene.scene_tags.length > 0 && (
                  <div className="mt-4">
                    <div className="text-gray-400 text-xs mb-2">场景标签</div>
                    <div className="flex flex-wrap gap-2">
                      {localSelectedTask.selectedScene.scene_tags.map((tag, index) => (
                        <span
                          key={`selected-tag-${index}-${tag.tag_name}`}
                          className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded"
                        >
                          {tag.tag_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 后续操作 */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-4">后续操作</h3>
            <div className="grid grid-cols-1 gap-4">
              {!localSelectedTask.selectedScene ? (
                // 未选择场景时显示配置话术按钮
                <button
                  onClick={handleConfigureScript}
                  className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors text-left"
                >
                  <div className="flex items-center mb-2">
                    <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span className="text-blue-300 font-medium">配置话术</span>
                  </div>
                  <p className="text-gray-400 text-sm">为任务配置个性化话术参数</p>
                </button>
              ) : (
                // 已选择场景时只显示开始外呼按钮
                <button
                  onClick={handleStartCalling}
                  disabled={!canStartCalling()}
                  className={`p-4 border rounded-lg transition-colors text-left ${
                    canStartCalling()
                      ? 'bg-green-500/20 border-green-500/30 hover:bg-green-500/30'
                      : 'bg-gray-500/20 border-gray-500/30 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <svg className={`w-6 h-6 mr-2 ${
                      canStartCalling() ? 'text-green-400' : 'text-gray-400'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className={`font-medium ${
                      canStartCalling() ? 'text-green-300' : 'text-gray-400'
                    }`}>开始外呼</span>
                  </div>
                  <p className={`text-sm ${
                    canStartCalling() ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {canStartCalling() 
                      ? '开始执行外呼任务' 
                      : '请先配置话术并生成话术'
                    }
                  </p>
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 pt-0 pb-8 border-t border-white/10">
          <div className="flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
              关闭
            </button>
          </div>
        </div>
      </div>
      
      {/* 话术生成抽屉 */}
      <ScriptGenerationDrawer
        isOpen={showScriptGeneration}
        onClose={handleScriptGenerationClose}
        selectedTask={localSelectedTask}
        onBackToTaskDetail={handleBackToTaskDetail}
        onScriptConfigured={handleScriptConfigured}
      />
    </div>
  );
} 