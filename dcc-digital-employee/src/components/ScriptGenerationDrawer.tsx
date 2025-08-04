'use client';

import React, { useState, useEffect } from 'react';
import { scenesAPI } from '../services/api';

interface Task {
  id: string;
  name: string;
  conditions: string[];
  targetCount: number;
  createdAt: string;
  status: 'pending' | 'script_configured' | 'completed';
  size_desc?: any;
}

interface TagItem {
  id: string;
  name: string;
  description: string;
  values: string[];
}

interface SceneTag {
  id: number;
  script_id: string;
  tag_name: string;
  tag_detail: string;
  tags: string;
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
  scene_tags: SceneTag[];
}

interface ScriptGenerationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask?: Task;
  onBackToTaskDetail?: () => void;
  onScriptConfigured?: (scene: Scene) => void;
}

type StepType = 'script_config' | 'generating_script' | 'script_complete';

// 筛选条件英文到中文的映射
const filterConditionMap: { [key: string]: string } = {
  'leads_product': '线索产品',
  'leads_type': '线索等级',
  'first_follow': '首次跟进时间区间',
  'latest_follow': '最近跟进时间区间',
  'next_follow': '下次跟进时间区间',
  'first_arrive': '首次到店时间区间',
  'is_arrive': '是否到店'
};

export default function ScriptGenerationDrawer({ isOpen, onClose, selectedTask, onBackToTaskDetail, onScriptConfigured }: ScriptGenerationDrawerProps) {
  const [currentStep, setCurrentStep] = useState<StepType>('script_config');
  const [localSelectedTask, setLocalSelectedTask] = useState<Task | undefined>(selectedTask);
  const [selectedScriptScene, setSelectedScriptScene] = useState<string>('official_scenes');
  const [customScene, setCustomScene] = useState({ 
    name: '', 
    description: '',
    dialogue_target: '',
    dialogue_opening_prompt: '',
    dialogue_bg: '',
    dialogue_skill: '',
    dialogue_flow: '',
    dialogue_constraint: '',
    bot_name: '',
    bot_post: '电销专员',
    bot_age: '',
    bot_style: ''
  });
  
  // 场景相关状态
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const [isEditingScene, setIsEditingScene] = useState(false);
  const [scriptConfig, setScriptConfig] = useState({
    customerName: '',
    gender: 'male',
    age: '',
    company: '',
    position: '',
    industry: '',
    region: '',
    productInterest: '',
    budget: '',
    urgency: '',
    decisionMaker: false,
    previousContact: false,
    contactHistory: '',
    objections: '',
    goals: '',
    skills: '',
    painPoints: '',
    competitorInfo: '',
    referralSource: '',
    customNotes: ''
  });
  // 机器人职位选项
  const [botPositions, setBotPositions] = useState([
    { id: '1', name: '电销专员', description: '专业的电话销售专员' },
    { id: '2', name: 'DCC经理', description: '数字客户中心经理' },
    { id: '3', name: '销售顾问', description: '专业的销售顾问' }
  ]);
  const [selectedBotPosition, setSelectedBotPosition] = useState('1'); // 默认选中电销专员
  const [customBotPosition, setCustomBotPosition] = useState('');

  // 机器人沟通风格选项
  const [botCommunicationStyles, setBotCommunicationStyles] = useState([
    { id: '1', name: '亲切', description: '亲切友好的沟通风格' },
    { id: '2', name: '自然', description: '自然流畅的沟通风格' },
    { id: '3', name: '口语化', description: '口语化的表达方式' },
    { id: '4', name: '专业', description: '专业严谨的沟通风格' },
    { id: '5', name: '活泼', description: '活泼开朗的沟通风格' },
    { id: '6', name: '严肃', description: '严肃认真的沟通风格' }
  ]);
  const [selectedBotStyles, setSelectedBotStyles] = useState<string[]>([]); // 支持多选
  const [customBotStyle, setCustomBotStyle] = useState('');

  const [identities, setIdentities] = useState([
    { id: '1', name: '专业顾问', description: '以专业知识和经验为客户提供建议' },
    { id: '2', name: '朋友式销售', description: '以朋友的身份与客户建立信任关系' },
    { id: '3', name: '问题解决者', description: '专注于解决客户的具体问题和需求' },
    { id: '4', name: '价值创造者', description: '帮助客户发现和创造新的价值机会' }
  ]);
  const [communicationStyles, setCommunicationStyles] = useState([
    { id: '1', name: '正式专业', description: '使用正式的语言和专业的表达方式' },
    { id: '2', name: '轻松友好', description: '使用轻松友好的语言建立亲近感' },
    { id: '3', name: '直接简洁', description: '直接表达重点，避免冗长的描述' },
    { id: '4', name: '故事化', description: '通过故事和案例来传达信息' }
  ]);
  const [selectedIdentity, setSelectedIdentity] = useState<string>('');
  const [selectedCommunicationStyle, setSelectedCommunicationStyle] = useState<string>('');
  const [customIdentity, setCustomIdentity] = useState('');
  const [customCommunicationStyle, setCustomCommunicationStyle] = useState('');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedScript, setGeneratedScript] = useState('');

  const scriptScenes = [
    { value: 'product_introduction', label: '产品介绍', description: '向客户介绍产品特性和优势' },
    { value: 'needs_analysis', label: '需求分析', description: '深入了解客户需求和痛点' },
    { value: 'objection_handling', label: '异议处理', description: '处理客户的疑虑和反对意见' },
    { value: 'closing', label: '成交促成', description: '引导客户做出购买决策' },
    { value: 'follow_up', label: '跟进维护', description: '维护客户关系，促进复购' },
    { value: 'custom', label: '自定义场景', description: '创建个性化的话术场景' }
  ];

  // 转换筛选条件为中文显示
  const formatFilterConditions = (conditions: string[] | undefined, sizeDesc?: any) => {
    if (conditions && conditions.length > 0) {
      return conditions.map(condition => {
        // 尝试解析条件格式 "key: value"
        const parts = condition.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const value = parts[1].trim();
          const chineseKey = filterConditionMap[key] || key;
          return `${chineseKey}: ${value}`;
        }
        return condition;
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

  useEffect(() => {
    if (selectedTask) {
      setLocalSelectedTask(selectedTask);
    }
  }, [selectedTask]);

  // 获取场景列表
  const fetchScenes = async () => {
    setScenesLoading(true);
    setScenesError(null);
    try {
      const response = await scenesAPI.getScenes();
      if (response.status === 'success' && response.data) {
        setScenes(response.data);
      } else {
        setScenesError('获取场景列表失败');
      }
    } catch (err) {
      setScenesError('获取场景列表失败');
      console.error('获取场景列表错误:', err);
    } finally {
      setScenesLoading(false);
    }
  };

  // 当组件打开时获取场景列表
  useEffect(() => {
    if (isOpen) {
      fetchScenes();
    }
  }, [isOpen]);

  const handleGenerateScript = () => {
    setCurrentStep('generating_script');
    setGenerationProgress(0);

    // 模拟话术生成过程
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setCurrentStep('script_complete');
          // 使用setTimeout避免在渲染过程中调用回调
          if (onScriptConfigured && selectedScene) {
            setTimeout(() => {
              onScriptConfigured(selectedScene);
            }, 0);
          }
          setGeneratedScript(`
# 个性化话术生成结果

## 场景信息
${selectedScene ? `
- 场景名称: ${selectedScene.scene_name}
- 场景类型: ${getSceneTypeText(selectedScene.scene_type)}
- 机器人姓名: ${selectedScene.bot_name}
- 机器人职位: ${selectedScene.bot_post}
- 机器人年龄: ${selectedScene.bot_age}岁
- 机器人风格: ${selectedScene.bot_style || '未设置'}
` : `
- 场景名称: ${customScene.name}
- 场景描述: ${customScene.description}
`}

## 筛选条件
${formatFilterConditions(localSelectedTask?.conditions, localSelectedTask?.size_desc).map(condition => `- ${condition}`).join('\n')}

## 销售身份
${identities.find(identity => identity.id === selectedIdentity)?.name || '专业顾问'}

## 沟通风格
${communicationStyles.find(style => style.id === selectedCommunicationStyle)?.name || '正式专业'}

## 个性化话术
基于您选择的场景和配置信息，我为您生成了以下个性化话术：

**开场白：**
${selectedScene ? selectedScene.dialogue_opening_prompt : '您好，我是[公司名称]的[姓名]。我想了解一下，您目前在这个领域遇到了哪些挑战？'}

**对话目标：**
${selectedScene ? selectedScene.dialogue_target : '深入了解客户需求，提供合适的解决方案'}

**对话背景：**
${selectedScene ? selectedScene.dialogue_bg : '基于客户的具体情况和需求进行个性化沟通'}

**对话流程：**
${selectedScene ? selectedScene.dialogue_flow : '1. 开场白和自我介绍\n2. 需求挖掘和痛点分析\n3. 价值展示和方案介绍\n4. 异议处理和问题解答\n5. 成交促成和后续跟进'}

**对话约束：**
${selectedScene ? selectedScene.dialogue_constraint : '1. 保持专业和友好的沟通态度\n2. 根据客户反应灵活调整话术内容\n3. 重点突出与客户需求相关的产品特性\n4. 准备应对常见的异议和疑问'}

## 关键标签
${selectedScene && selectedScene.scene_tags ? selectedScene.scene_tags.map(tag => `- ${tag.tag_name}: ${tag.tags}`).join('\n') : tags.map(tag => `- ${tag.name}: ${tag.values.join(', ')}`).join('\n')}

## 注意事项
1. 根据客户反应灵活调整话术内容
2. 重点突出与客户需求相关的产品特性
3. 准备应对常见的异议和疑问
4. 保持专业和友好的沟通态度
5. 遵循场景设定的对话流程和约束条件
          `);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
  };

  const handleClose = () => {
    setCurrentStep('script_config');
    setGenerationProgress(0);
    setGeneratedScript('');
    setSelectedScriptScene('');
    setIsEditingScene(false);
    setCustomScene({ 
      name: '', 
      description: '',
      dialogue_target: '',
      dialogue_opening_prompt: '',
      dialogue_bg: '',
      dialogue_skill: '',
      dialogue_flow: '',
      dialogue_constraint: '',
      bot_name: '',
      bot_post: '电销专员',
      bot_age: '',
      bot_style: ''
    });
    setSelectedBotPosition('1');
    setCustomBotPosition('');
    setSelectedBotStyles([]);
    setCustomBotStyle('');
    setSelectedScene(null);
    setScriptConfig({
      customerName: '',
      gender: 'male',
      age: '',
      company: '',
      position: '',
      industry: '',
      region: '',
      productInterest: '',
      budget: '',
      urgency: '',
      decisionMaker: false,
      previousContact: false,
      contactHistory: '',
      objections: '',
      goals: '',
      skills: '',
      painPoints: '',
      competitorInfo: '',
      referralSource: '',
      customNotes: ''
    });
    setSelectedIdentity('');
    setSelectedCommunicationStyle('');
    setCustomIdentity('');
    setCustomCommunicationStyle('');
    setTags([]);
    onClose();
  };

  const handleIdentityChange = (identity: string) => {
    setSelectedIdentity(identity);
  };

  const handleCommunicationStyleChange = (style: string) => {
    setSelectedCommunicationStyle(style);
  };

  const handleAddCustomIdentity = () => {
    if (customIdentity.trim()) {
      const newIdentity = {
        id: Date.now().toString(),
        name: customIdentity,
        description: '自定义销售身份'
      };
      setIdentities(prev => [...prev, newIdentity]);
      setSelectedIdentity(newIdentity.id);
      setCustomIdentity('');
    }
  };

  const handleAddCustomCommunicationStyle = () => {
    if (customCommunicationStyle.trim()) {
      const newStyle = {
        id: Date.now().toString(),
        name: customCommunicationStyle,
        description: '自定义沟通风格'
      };
      setCommunicationStyles(prev => [...prev, newStyle]);
      setSelectedCommunicationStyle(newStyle.id);
      setCustomCommunicationStyle('');
    }
  };

  // 处理机器人职位选择
  const handleBotPositionChange = (positionId: string) => {
    setSelectedBotPosition(positionId);
    const selectedPosition = botPositions.find(pos => pos.id === positionId);
    if (selectedPosition) {
      setCustomScene(prev => ({ ...prev, bot_post: selectedPosition.name }));
    }
  };

  // 添加自定义机器人职位
  const handleAddCustomBotPosition = () => {
    if (customBotPosition.trim()) {
      const newPosition = {
        id: Date.now().toString(),
        name: customBotPosition,
        description: '自定义机器人职位'
      };
      setBotPositions(prev => [...prev, newPosition]);
      setSelectedBotPosition(newPosition.id);
      setCustomScene(prev => ({ ...prev, bot_post: customBotPosition }));
      setCustomBotPosition('');
    }
  };

  // 处理机器人沟通风格选择（多选）
  const handleBotStyleChange = (styleId: string) => {
    setSelectedBotStyles(prev => {
      if (prev.includes(styleId)) {
        return prev.filter(id => id !== styleId);
      } else {
        return [...prev, styleId];
      }
    });
    
    // 更新customScene中的bot_style
    const updatedStyles = selectedBotStyles.includes(styleId) 
      ? selectedBotStyles.filter(id => id !== styleId)
      : [...selectedBotStyles, styleId];
    
    const selectedStyleNames = updatedStyles.map(id => {
      const style = botCommunicationStyles.find(s => s.id === id);
      return style ? style.name : '';
    }).filter(name => name);
    
    setCustomScene(prev => ({ ...prev, bot_style: selectedStyleNames.join('; ') }));
  };

  // 添加自定义机器人沟通风格
  const handleAddCustomBotStyle = () => {
    if (customBotStyle.trim()) {
      const newStyle = {
        id: Date.now().toString(),
        name: customBotStyle,
        description: '自定义沟通风格'
      };
      setBotCommunicationStyles(prev => [...prev, newStyle]);
      setSelectedBotStyles(prev => [...prev, newStyle.id]);
      setCustomScene(prev => ({ 
        ...prev, 
        bot_style: prev.bot_style ? `${prev.bot_style}; ${customBotStyle}` : customBotStyle 
      }));
      setCustomBotStyle('');
    }
  };

  const handleAddTag = () => {
    const newTag: TagItem = {
      id: Date.now().toString(),
      name: '',
      description: '',
      values: []
    };
    setTags(prev => [...prev, newTag]);
  };

  const handleUpdateTag = (tagId: string, field: 'name' | 'description' | 'values', value: string | string[]) => {
    setTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, [field]: value } : tag
    ));
  };

  const handleAddTagValue = (tagId: string, value: string) => {
    if (value.trim()) {
      setTags(prev => prev.map(tag => 
        tag.id === tagId ? { ...tag, values: [...tag.values, value.trim()] } : tag
      ));
    }
  };

  const handleRemoveTagValue = (tagId: string, valueIndex: number) => {
    setTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, values: tag.values.filter((_, index) => index !== valueIndex) } : tag
    ));
  };

  const handleRemoveTag = (tagId: string) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const handleSaveCustomScene = async () => {
    // 校验必填项
    const errors: string[] = [];
    
    if (!customScene.name.trim()) {
      errors.push('场景名称');
    }
    
    if (!customScene.bot_name.trim()) {
      errors.push('机器人姓名');
    }
    
    if (!customScene.dialogue_target.trim()) {
      errors.push('对话目的');
    }
    
    if (!customScene.dialogue_opening_prompt.trim()) {
      errors.push('开场白');
    }
    
    if (!customScene.dialogue_flow.trim()) {
      errors.push('对话流程');
    }
    
    if (tags.length === 0) {
      errors.push('标签组（至少添加一个标签组）');
    }
    
    if (errors.length > 0) {
      alert(`请填写以下必填项：\n${errors.join('\n')}`);
      return;
    }
    
    try {
      // 准备场景数据
      const sceneData = {
        scene_name: customScene.name,
        scene_detail: customScene.description,
        scene_type: 2, // 自定义场景
        bot_name: customScene.bot_name,
        bot_sex: customScene.bot_age ? 1 : undefined, // 简化处理
        bot_age: parseInt(customScene.bot_age) || undefined,
        bot_post: customScene.bot_post,
        bot_style: customScene.bot_style,
        dialogue_target: customScene.dialogue_target,
        dialogue_bg: customScene.dialogue_bg,
        dialogue_skill: customScene.dialogue_skill,
        dialogue_flow: customScene.dialogue_flow,
        dialogue_constraint: customScene.dialogue_constraint,
        dialogue_opening_prompt: customScene.dialogue_opening_prompt,
        scene_tags: tags.map(tag => ({
          tag_name: tag.name,
          tag_detail: tag.description,
          tags: tag.values.join('; ')
        }))
      };

      // 调用API创建场景
      const response = await scenesAPI.createScene(sceneData);
      
      if (response.status === 'success') {
        alert(isEditingScene ? '场景更新成功！' : '自定义场景创建成功！');
        
        if (isEditingScene) {
          // 如果是编辑模式，更新选中的场景
          setSelectedScene(prev => prev ? {
            ...prev,
            scene_name: customScene.name,
            scene_detail: customScene.description,
            dialogue_target: customScene.dialogue_target,
            dialogue_opening_prompt: customScene.dialogue_opening_prompt,
            dialogue_bg: customScene.dialogue_bg,
            dialogue_skill: customScene.dialogue_skill,
            dialogue_flow: customScene.dialogue_flow,
            dialogue_constraint: customScene.dialogue_constraint,
            bot_name: customScene.bot_name,
            bot_post: customScene.bot_post,
            bot_age: parseInt(customScene.bot_age) || 0,
            bot_style: customScene.bot_style
          } : null);
          setIsEditingScene(false);
        } else {
          // 如果是新建模式，创建新场景对象并设置为选中场景
          const newScene: Scene = {
            id: Date.now(), // 临时ID
            script_id: response.data.script_id, // 使用API返回的script_id
            scene_name: customScene.name,
            scene_detail: customScene.description,
            scene_status: 1,
            scene_type: 2, // 自定义场景
            scene_create_user_id: '',
            scene_create_user_name: '',
            scene_create_org_id: '',
            scene_create_time: new Date().toISOString(),
            bot_name: customScene.bot_name,
            bot_sex: null,
            bot_age: parseInt(customScene.bot_age) || 0,
            bot_post: customScene.bot_post,
            bot_style: customScene.bot_style,
            dialogue_target: customScene.dialogue_target,
            dialogue_bg: customScene.dialogue_bg,
            dialogue_skill: customScene.dialogue_skill,
            dialogue_flow: customScene.dialogue_flow,
            dialogue_constraint: customScene.dialogue_constraint,
            dialogue_opening_prompt: customScene.dialogue_opening_prompt,
            scene_tags: tags.map(tag => ({
              id: Date.now() + Math.random(),
              script_id: response.data.script_id,
              tag_name: tag.name,
              tag_detail: tag.description,
              tags: tag.values.join('; ')
            }))
          };
          
          setSelectedScene(newScene);
          setSelectedScriptScene('scene_selected');
          
          // 重置表单
          setCustomScene({
            name: '',
            description: '',
            dialogue_target: '',
            dialogue_opening_prompt: '',
            dialogue_bg: '',
            dialogue_skill: '',
            dialogue_flow: '',
            dialogue_constraint: '',
            bot_name: '',
            bot_post: '电销专员',
            bot_age: '',
            bot_style: ''
          });
          setSelectedBotStyles([]);
          setSelectedBotPosition('1');
          setTags([]);
        }
      } else {
        alert('创建场景失败：' + response.message);
      }
    } catch (error) {
      console.error('创建场景错误:', error);
      alert('创建场景失败，请重试');
    }
  };

  // 场景选择处理函数
  const handleSceneSelect = (scene: Scene) => {
    setSelectedScene(scene);
    setSelectedScriptScene('scene_selected');
    setIsEditingScene(false);
    
    // 根据场景信息自动填充配置
    setScriptConfig(prev => ({
      ...prev,
      customerName: scene.bot_name,
      age: scene.bot_age?.toString() || '',
      goals: scene.dialogue_target,
      skills: scene.dialogue_skill || '',
      customNotes: `场景背景: ${scene.dialogue_bg}\n对话流程: ${scene.dialogue_flow}\n对话约束: ${scene.dialogue_constraint}`
    }));
  };

  // 编辑场景处理函数
  const handleEditScene = () => {
    if (selectedScene && selectedScene.scene_type !== 1) {
      setIsEditingScene(true);
      setCustomScene({
        name: selectedScene.scene_name,
        description: selectedScene.scene_detail,
        dialogue_target: selectedScene.dialogue_target,
        dialogue_opening_prompt: selectedScene.dialogue_opening_prompt,
        dialogue_bg: selectedScene.dialogue_bg,
        dialogue_skill: selectedScene.dialogue_skill || '',
        dialogue_flow: selectedScene.dialogue_flow,
        dialogue_constraint: selectedScene.dialogue_constraint,
        bot_name: selectedScene.bot_name,
        bot_post: selectedScene.bot_post,
        bot_age: selectedScene.bot_age?.toString() || '',
        bot_style: selectedScene.bot_style || ''
      });
    }
  };

  // 处理复制场景
  const handleCopyScene = (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发场景选择
    
    // 准备复制的场景数据
    const copiedSceneData = {
      scene_name: `${scene.scene_name} - 副本`,
      scene_detail: scene.scene_detail,
      scene_type: 2, // 设置为自定义场景
      bot_name: scene.bot_name,
      bot_sex: scene.bot_sex ? parseInt(scene.bot_sex) : undefined,
      bot_age: scene.bot_age,
      bot_post: scene.bot_post,
      bot_style: scene.bot_style,
      dialogue_target: scene.dialogue_target,
      dialogue_bg: scene.dialogue_bg,
      dialogue_skill: scene.dialogue_skill,
      dialogue_flow: scene.dialogue_flow,
      dialogue_constraint: scene.dialogue_constraint,
      dialogue_opening_prompt: scene.dialogue_opening_prompt,
      scene_tags: scene.scene_tags?.map(tag => ({
        tag_name: tag.tag_name,
        tag_detail: tag.tag_detail,
        tags: tag.tags
      })) || []
    };

    // 解析机器人沟通风格并设置选中状态
    let botStyleNames: string[] = [];
    if (scene.bot_style) {
      // 使用分号分割机器人沟通风格
      botStyleNames = scene.bot_style.split(';').map(s => s.trim()).filter(s => s);
    }
    
    const selectedStyleIds = botCommunicationStyles
      .filter(style => botStyleNames.includes(style.name))
      .map(style => style.id);

    // 解析机器人职位并设置选中状态
    const selectedPosition = botPositions.find(pos => pos.name === scene.bot_post);
    const selectedPositionId = selectedPosition ? selectedPosition.id : '1'; // 默认选中电销专员

    // 解析场景标签并转换为标签组
    const sceneTags = scene.scene_tags || [];
    const convertedTags: TagItem[] = sceneTags.map((tag, index) => ({
      id: `tag_${index}`,
      name: tag.tag_name,
      description: tag.tag_detail,
      values: tag.tags ? tag.tags.split(';').map(v => v.trim()).filter(v => v) : []
    }));

    // 跳转到创建新场景页面
    setCustomScene({
      name: copiedSceneData.scene_name,
      description: copiedSceneData.scene_detail,
      dialogue_target: copiedSceneData.dialogue_target,
      dialogue_opening_prompt: copiedSceneData.dialogue_opening_prompt,
      dialogue_bg: copiedSceneData.dialogue_bg,
      dialogue_skill: copiedSceneData.dialogue_skill || '',
      dialogue_flow: copiedSceneData.dialogue_flow,
      dialogue_constraint: copiedSceneData.dialogue_constraint,
      bot_name: copiedSceneData.bot_name,
      bot_post: copiedSceneData.bot_post,
      bot_age: copiedSceneData.bot_age?.toString() || '',
      bot_style: copiedSceneData.bot_style || ''
    });
    
    // 设置机器人沟通风格的选中状态
    setSelectedBotStyles(selectedStyleIds);
    
    // 设置机器人职位的选中状态
    setSelectedBotPosition(selectedPositionId);
    
    // 设置标签组
    setTags(convertedTags);
    
    setSelectedScriptScene('create_custom');
    setIsEditingScene(false);
  };

  const getSceneTypeText = (type: number) => {
    return type === 1 ? '官方场景' : '自定义场景';
  };

  const getSceneStatusText = (status: number) => {
    return status === 1 ? '启用' : '禁用';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-4" onClick={onClose}>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-7xl w-full mx-4 h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">话术生成Agent</h2>
              <p className="text-gray-300">为任务配置个性化话术参数</p>
            </div>
            <div className="flex items-center space-x-3">
              {onBackToTaskDetail && (
                <button 
                  onClick={onBackToTaskDetail}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  返回任务详情
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {currentStep === 'script_config' && (
            <div className="space-y-6">
              {/* 任务摘要 */}
              <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">任务摘要</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-300">筛选条件:</span>
                    <div className="text-white mt-1">
                      {formatFilterConditions(localSelectedTask?.conditions, localSelectedTask?.size_desc).map((condition, index) => (
                        <div key={`condition-${index}-${condition}`} className="text-sm">{condition}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-300">目标线索数:</span>
                    <div className="text-white text-lg font-bold mt-1">{localSelectedTask?.targetCount}</div>
                  </div>
                </div>
              </div>

              {/* 话术场景选择 */}
              <div className="mb-6">
                {/* 场景类型选择 */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => setSelectedScriptScene('official_scenes')}
                      className={`p-3 rounded-lg transition-all duration-300 border ${
                        selectedScriptScene === 'official_scenes'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-lg'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-semibold mb-1">官方场景</div>
                        <div className="text-xs opacity-75">使用预设的标准化场景</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedScriptScene('custom_scenes')}
                      className={`p-3 rounded-lg transition-all duration-300 border ${
                        selectedScriptScene === 'custom_scenes'
                          ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-lg'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-semibold mb-1">自定义场景</div>
                        <div className="text-xs opacity-75">选择并编辑已有场景</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedScriptScene('create_custom')}
                      className={`p-3 rounded-lg transition-all duration-300 border ${
                        selectedScriptScene === 'create_custom'
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-lg'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-sm font-semibold mb-1">创建新场景</div>
                        <div className="text-xs opacity-75">创建全新的个性化场景</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 场景列表 */}
                {(selectedScriptScene === 'official_scenes' || selectedScriptScene === 'custom_scenes') && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-4">
                      {selectedScriptScene === 'official_scenes' ? '官方场景列表' : '自定义场景列表'}
                    </h4>
                    {scenesLoading && (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                        <span className="ml-3 text-gray-300">加载场景中...</span>
                      </div>
                    )}

                    {scenesError && (
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-red-300">{scenesError}</span>
                        </div>
                      </div>
                    )}

                    {!scenesLoading && !scenesError && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {scenes
                          .filter(scene => {
                            if (selectedScriptScene === 'official_scenes') {
                              return scene.scene_type === 1;
                            } else if (selectedScriptScene === 'custom_scenes') {
                              return scene.scene_type !== 1;
                            }
                            return true;
                          })
                          .map((scene) => (
                            <div
                              key={scene.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors relative ${
                                selectedScene?.id === scene.id
                                  ? 'bg-blue-500/20 border-blue-500/50'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10'
                              }`}
                              onClick={() => handleSceneSelect(scene)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="text-white font-medium">{scene.scene_name}</h4>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    scene.scene_type === 1 
                                      ? 'bg-blue-500/20 text-blue-300' 
                                      : 'bg-green-500/20 text-green-300'
                                  }`}>
                                    {getSceneTypeText(scene.scene_type)}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    scene.scene_status === 1 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : 'bg-red-500/20 text-red-300'
                                  }`}>
                                    {getSceneStatusText(scene.scene_status)}
                                  </span>
                                  {/* 复制按钮 - 只对官方场景显示 */}
                                  {scene.scene_type === 1 && (
                                    <button
                                      onClick={(e) => handleCopyScene(scene, e)}
                                      className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 rounded-lg transition-colors"
                                      title="复制场景"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="text-gray-400">机器人:</span>
                                  <span className="text-white ml-1">{scene.bot_name} ({scene.bot_post})</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">目标:</span>
                                  <p className="text-white mt-1 line-clamp-2">{scene.dialogue_target}</p>
                                </div>
                                <div>
                                  <span className="text-gray-400">开场白:</span>
                                  <p className="text-white mt-1 line-clamp-2">{scene.dialogue_opening_prompt}</p>
                                </div>
                                
                                {/* 场景标签展示 */}
                                {scene.scene_tags && scene.scene_tags.length > 0 && (
                                  <div>
                                    <span className="text-gray-400">标签:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {scene.scene_tags.map((tag, index) => (
                                        <span
                                          key={`tag-${index}-${tag.tag_name}`}
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
                          ))}
                      </div>
                    )}

                    {!scenesLoading && !scenesError && scenes.filter(scene => {
                      if (selectedScriptScene === 'official_scenes') {
                        return scene.scene_type === 1;
                      } else if (selectedScriptScene === 'custom_scenes') {
                        return scene.scene_type !== 1;
                      }
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-8">
                        <div className="text-gray-400 mb-2">暂无可用场景</div>
                        <p className="text-gray-500 text-sm">请选择其他类型或创建新场景</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 创建新场景 */}
                {(selectedScriptScene === 'create_custom' || isEditingScene) && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <h4 className="text-white font-medium mb-4">{isEditingScene ? '编辑场景' : '创建新场景配置'}</h4>
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-300 text-sm">
                        <span className="text-red-400">*</span> 为必填项，请确保填写完整
                      </p>
                    </div>
                    
                    {/* 基本信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          场景名称 <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={customScene.name}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入场景名称"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">场景描述</label>
                        <input
                          type="text"
                          value={customScene.description}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入场景描述"
                        />
                      </div>
                    </div>

                    {/* 机器人信息 */}
                    <div className="mb-6">
                      <h5 className="text-white font-medium mb-3">机器人信息</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            机器人姓名 <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={customScene.bot_name}
                            onChange={(e) => setCustomScene(prev => ({ ...prev, bot_name: e.target.value }))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            placeholder="请输入机器人姓名"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">机器人职位</label>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {botPositions.map((position) => (
                                <button
                                  key={position.id}
                                  onClick={() => handleBotPositionChange(position.id)}
                                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedBotPosition === position.id
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                  }`}
                                >
                                  {position.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={customBotPosition}
                                onChange={(e) => setCustomBotPosition(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder="自定义职位"
                              />
                              <button
                                onClick={handleAddCustomBotPosition}
                                className="px-3 py-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg text-sm transition-colors"
                              >
                                添加
                              </button>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">机器人年龄</label>
                          <input
                            type="number"
                            value={customScene.bot_age}
                            onChange={(e) => setCustomScene(prev => ({ ...prev, bot_age: e.target.value }))}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            placeholder="请输入机器人年龄"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">机器人沟通风格</label>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {botCommunicationStyles.map((style) => (
                                <button
                                  key={style.id}
                                  onClick={() => handleBotStyleChange(style.id)}
                                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    selectedBotStyles.includes(style.id)
                                      ? 'bg-green-500 text-white'
                                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                  }`}
                                >
                                  {style.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={customBotStyle}
                                onChange={(e) => setCustomBotStyle(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                placeholder="自定义风格"
                              />
                              <button
                                onClick={handleAddCustomBotStyle}
                                className="px-3 py-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg text-sm transition-colors"
                              >
                                添加
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 对话配置 */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          对话目的 <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={customScene.dialogue_target}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_target: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入对话目的"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          开场白 <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={customScene.dialogue_opening_prompt}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_opening_prompt: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入开场白"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">对话场景</label>
                        <textarea
                          value={customScene.dialogue_bg}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_bg: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入对话场景"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">对话技能</label>
                        <textarea
                          value={customScene.dialogue_skill}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_skill: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入对话技能"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          对话流程 <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={customScene.dialogue_flow}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_flow: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入对话流程"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">对话约束</label>
                        <textarea
                          value={customScene.dialogue_constraint}
                          onChange={(e) => setCustomScene(prev => ({ ...prev, dialogue_constraint: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          placeholder="请输入对话约束"
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* 标签组 */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-white font-medium">
                          标签组 <span className="text-red-400">*</span>
                        </h5>
                        <button
                          onClick={handleAddTag}
                          className="px-3 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg text-sm transition-colors"
                        >
                          + 添加标签组
                        </button>
                      </div>
                      {tags.length === 0 ? (
                        <div className="text-center py-8 bg-white/5 border border-white/10 rounded-lg">
                          <div className="text-gray-400 mb-2">暂无标签组</div>
                          <p className="text-gray-500 text-sm">点击"添加标签组"按钮来创建新的标签组</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {tags.map((tag) => (
                            <div key={tag.id} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <input
                                  type="text"
                                  value={tag.name}
                                  onChange={(e) => handleUpdateTag(tag.id, 'name', e.target.value)}
                                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 mr-2"
                                  placeholder="标签名称"
                                />
                                <button
                                  onClick={() => handleRemoveTag(tag.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <div className="mb-3">
                                <input
                                  type="text"
                                  value={tag.description}
                                  onChange={(e) => handleUpdateTag(tag.id, 'description', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                  placeholder="标签描述"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    placeholder="添加标签值"
                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        const target = e.target as HTMLInputElement;
                                        handleAddTagValue(tag.id, target.value);
                                        target.value = '';
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const input = document.querySelector(`input[placeholder="添加标签值"]`) as HTMLInputElement;
                                      if (input) {
                                        handleAddTagValue(tag.id, input.value);
                                        input.value = '';
                                      }
                                    }}
                                    className="px-3 py-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg text-sm transition-colors"
                                  >
                                    添加
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {tag.values.map((value, index) => (
                                    <span
                                      key={`value-${index}-${value}`}
                                      className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm flex items-center"
                                    >
                                      {value}
                                      <button
                                        onClick={() => handleRemoveTagValue(tag.id, index)}
                                        className="ml-1 text-purple-400 hover:text-purple-300"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 已选择场景的详细信息 */}
                {selectedScene && selectedScriptScene === 'scene_selected' && (
                  <div className={`p-4 border rounded-lg ${
                    selectedScene.scene_type === 1 
                      ? 'bg-blue-500/10 border-blue-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-white font-medium">已选择场景: {selectedScene.scene_name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          selectedScene.scene_type === 1 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'bg-green-500/20 text-green-300'
                        }`}>
                          {getSceneTypeText(selectedScene.scene_type)}
                        </span>
                        {selectedScene.scene_type === 1 && (
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-300">
                            只读模式
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedScene.scene_type !== 1 && (
                          <button
                            onClick={handleEditScene}
                            className="px-3 py-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-lg text-sm transition-colors"
                          >
                            编辑场景
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedScene(null);
                            setSelectedScriptScene(selectedScene.scene_type === 1 ? 'official_scenes' : 'custom_scenes');
                            setIsEditingScene(false);
                          }}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">机器人信息:</span>
                        <div className="text-white mt-1">
                          <div>姓名: {selectedScene.bot_name}</div>
                          <div>职位: {selectedScene.bot_post}</div>
                          <div>年龄: {selectedScene.bot_age}岁</div>
                          {selectedScene.bot_style && (
                            <div>风格: {selectedScene.bot_style}</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-400">对话目标:</span>
                        <p className="text-white mt-1">{selectedScene.dialogue_target}</p>
                      </div>
                      
                      <div className="md:col-span-2">
                        <span className="text-gray-400">开场白:</span>
                        <p className="text-white mt-1">{selectedScene.dialogue_opening_prompt}</p>
                      </div>
                      
                      <div className="md:col-span-2">
                        <span className="text-gray-400">对话背景:</span>
                        <p className="text-white mt-1">{selectedScene.dialogue_bg}</p>
                      </div>
                      
                      <div className="md:col-span-2">
                        <span className="text-gray-400">对话流程:</span>
                        <p className="text-white mt-1">{selectedScene.dialogue_flow}</p>
                      </div>
                      
                      <div className="md:col-span-2">
                        <span className="text-gray-400">对话约束:</span>
                        <p className="text-white mt-1">{selectedScene.dialogue_constraint}</p>
                      </div>
                      
                      {/* 场景标签展示 */}
                      {selectedScene.scene_tags && selectedScene.scene_tags.length > 0 && (
                        <div className="md:col-span-2">
                          <span className="text-gray-400">场景标签:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedScene.scene_tags.map((tag, index) => (
                              <div key={`selected-tag-${index}-${tag.tag_name}`} className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2">
                                <div className="text-purple-300 font-medium text-sm mb-1">{tag.tag_name}</div>
                                {tag.tag_detail && (
                                  <div className="text-gray-300 text-xs mb-1">{tag.tag_detail}</div>
                                )}
                                {tag.tags && (
                                  <div className="flex flex-wrap gap-1">
                                    {tag.tags.split(',').map((tagValue, tagIndex) => (
                                      <span
                                        key={`tag-value-${tagIndex}-${tagValue.trim()}`}
                                        className="px-2 py-1 bg-purple-500/30 text-purple-200 text-xs rounded"
                                      >
                                        {tagValue.trim()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>




            </div>
          )}
          
          {currentStep === 'generating_script' && (
            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">正在生成话术</h2>
                <p className="text-gray-300">AI正在为您的线索生成个性化话术</p>
              </div>

              <div className="mb-8">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-16 h-16 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                </div>

                <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>
                
                <p className="text-gray-300 text-sm">
                  {generationProgress >= 100 ? '话术生成完成' : '正在生成话术...'}
                </p>
              </div>
            </div>
          )}

          {currentStep === 'script_complete' && (
            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">话术生成成功！</h2>
                <p className="text-gray-300">个性化话术已生成，可以开始外呼任务</p>
              </div>

              <div className="mb-8">
                <div className="w-24 h-24 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="space-y-4 text-left max-w-md mx-auto">
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-blue-300 font-medium">话术已生成</span>
                    </div>
                    <p className="text-gray-300 text-sm">个性化话术配置完成</p>
                  </div>
                  
                  <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full mr-2"></div>
                      <span className="text-purple-300 font-medium">外呼Agent</span>
                    </div>
                    <p className="text-gray-300 text-sm">准备开始执行外呼任务</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 pt-0 pb-4 border-t border-white/10 mt-auto">
          {currentStep === 'script_config' && (
            <div className="flex justify-between mt-4">
              <button onClick={onBackToTaskDetail} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                返回任务列表
              </button>
              <div className="flex space-x-3">
                <button onClick={handleClose} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
                  取消
                </button>
                {(selectedScriptScene === 'scene_selected' || selectedScriptScene === 'create_custom' || isEditingScene) ? (
                  <>
                    <button
                      onClick={handleGenerateScript}
                      disabled={
                        (selectedScriptScene === 'create_custom' || isEditingScene) && (
                          !customScene.name.trim() || 
                          !customScene.bot_name.trim() || 
                          !customScene.dialogue_target.trim() || 
                          !customScene.dialogue_opening_prompt.trim() || 
                          !customScene.dialogue_flow.trim() || 
                          tags.length === 0
                        )
                      }
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      生成话术
                    </button>
                    {(selectedScriptScene === 'create_custom' || isEditingScene) && (
                      <button
                        onClick={handleSaveCustomScene}
                        disabled={
                          !customScene.name.trim() || 
                          !customScene.bot_name.trim() || 
                          !customScene.dialogue_target.trim() || 
                          !customScene.dialogue_opening_prompt.trim() || 
                          !customScene.dialogue_flow.trim() || 
                          tags.length === 0
                        }
                        className="px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {isEditingScene ? '更新场景' : '保存场景'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleGenerateScript}
                    disabled={true}
                    className="px-6 py-2 bg-gray-500 text-gray-300 font-medium rounded-lg cursor-not-allowed"
                  >
                    请先选择场景
                  </button>
                )}
              </div>
            </div>
          )}
          
          {currentStep === 'script_complete' && (
            <div className="flex justify-center mt-4">
              <button onClick={handleClose} className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 