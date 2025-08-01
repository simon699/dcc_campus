'use client';

import React, { useState, useEffect } from 'react';
import { scenesAPI } from '../services/api';

interface SceneTag {
  id: number;
  scene_id: string;
  tag_name: string;
  tag_detail: string;
  tags: string;
}

interface Scene {
  id: number;
  scene_id: string;
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

interface SceneSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSceneSelect: (scene: Scene) => void;
}

export default function SceneSelectionDrawer({ 
  isOpen, 
  onClose, 
  onSceneSelect 
}: SceneSelectionDrawerProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchScenes();
    }
  }, [isOpen]);

  const fetchScenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await scenesAPI.getScenes();
      if (response.status === 'success' && response.data) {
        setScenes(response.data);
      } else {
        setError('获取场景列表失败');
      }
    } catch (err) {
      setError('获取场景列表失败');
      console.error('获取场景列表错误:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSceneSelect = (scene: Scene) => {
    onSceneSelect(scene);
    onClose();
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
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-6xl w-full mx-4 h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-1 overflow-y-auto p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">选择场景</h2>
              <p className="text-gray-300">选择官方或自定义场景来配置话术</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="ml-3 text-gray-300">加载中...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-300">{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => handleSceneSelect(scene)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{scene.scene_name}</h3>
                      <div className="flex items-center space-x-2 mb-2">
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
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-gray-400 text-sm">机器人信息:</span>
                      <div className="text-white text-sm mt-1">
                        <div>姓名: {scene.bot_name}</div>
                        <div>职位: {scene.bot_post}</div>
                        <div>年龄: {scene.bot_age}岁</div>
                        {scene.bot_style && (
                          <div>风格: {scene.bot_style}</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-400 text-sm">对话目标:</span>
                      <p className="text-white text-sm mt-1 line-clamp-2">{scene.dialogue_target}</p>
                    </div>

                    <div>
                      <span className="text-gray-400 text-sm">开场白:</span>
                      <p className="text-white text-sm mt-1 line-clamp-2">{scene.dialogue_opening_prompt}</p>
                    </div>

                    {scene.scene_tags && scene.scene_tags.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-sm">标签:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {scene.scene_tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded"
                            >
                              {tag.tag_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-gray-400 text-xs">
                      创建时间: {scene.scene_create_time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && scenes.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">暂无可用场景</div>
              <p className="text-gray-500 text-sm">请先创建场景或联系管理员</p>
            </div>
          )}
        </div>
        
        <div className="p-6 pt-0 border-t border-white/10">
          <div className="flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 