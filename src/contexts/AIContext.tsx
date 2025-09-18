import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AISettings } from '../types/ai';
import { AI_PROVIDERS } from '../services/aiService';
import { encryptApiKey } from '../utils/securityUtils';

interface AIContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
}

const defaultSettings: AISettings = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // 選択されたモデルの最大トークン数を取得
        const selectedProvider = AI_PROVIDERS.find(p => p.id === parsed.provider);
        const selectedModel = selectedProvider?.models.find(m => m.id === parsed.model);
        const modelMaxTokens = selectedModel?.maxTokens || 8192;
        
        // 設定のバリデーション
        const validated = {
          ...defaultSettings,
          ...parsed,
          temperature: Math.max(0, Math.min(1, parsed.temperature || defaultSettings.temperature)),
          maxTokens: Math.max(100, Math.min(modelMaxTokens, parsed.maxTokens || defaultSettings.maxTokens)),
        };
        return validated;
      }
      return defaultSettings;
    } catch (error) {
      console.error('AI設定の読み込みエラー:', error);
      return defaultSettings;
    }
  });

  const updateSettings = (newSettings: Partial<AISettings>) => {
    const updated = { ...settings, ...newSettings };
    
    // モデルが変更された場合、そのモデルの最大トークン数に合わせて調整
    if (newSettings.model || newSettings.provider) {
      const selectedProvider = AI_PROVIDERS.find(p => p.id === updated.provider);
      const selectedModel = selectedProvider?.models.find(m => m.id === updated.model);
      const modelMaxTokens = selectedModel?.maxTokens || 8192;
      
      // 現在のmaxTokensが新しいモデルの最大値を超えている場合は調整
      if (updated.maxTokens > modelMaxTokens) {
        updated.maxTokens = modelMaxTokens;
      }
    }
    
    // APIキーを暗号化して保存
    if (updated.apiKey) {
      const encryptedKey = encryptApiKey(updated.apiKey);
      updated.apiKey = encryptedKey;
    }
    
    setSettings(updated);
    localStorage.setItem('ai-settings', JSON.stringify(updated));
  };

  const isConfigured = Boolean(
    (settings.provider === 'openai' && settings.apiKey) ||
    (settings.provider === 'gemini' && settings.apiKey) ||
    (settings.provider === 'local' && settings.localEndpoint)
  );

  return (
    <AIContext.Provider value={{
      settings,
      updateSettings,
      isConfigured,
    }}>
      {children}
    </AIContext.Provider>
  );
};