import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AISettings } from '../types/ai';
import { AI_PROVIDERS } from '../services/aiService';
import { encryptApiKey } from '../utils/securityUtils';

interface AIContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
}

// 環境変数からデフォルト設定を取得
const getDefaultSettings = (): AISettings => {
  // 環境変数からAPIキーを取得
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const localEndpoint = import.meta.env.VITE_LOCAL_LLM_ENDPOINT;

  // 利用可能なAPIキーに基づいてデフォルトプロバイダーを決定
  let defaultProvider = 'openai';
  let defaultModel = 'gpt-4.1-mini';

  if (openaiKey) {
    defaultProvider = 'openai';
    defaultModel = 'gpt-4.1-mini';
  } else if (claudeKey) {
    defaultProvider = 'claude';
    defaultModel = 'claude-3-5-haiku-20241022';
  } else if (geminiKey) {
    defaultProvider = 'gemini';
    defaultModel = 'gemini-2.5-flash';
  } else if (localEndpoint) {
    defaultProvider = 'local';
    defaultModel = 'local-model';
  }

  // apiKeysオブジェクトを構築（環境変数から）
  const apiKeys: Record<string, string> = {};
  if (openaiKey) {
    apiKeys['openai'] = encryptApiKey(openaiKey);
  }
  if (claudeKey) {
    apiKeys['claude'] = encryptApiKey(claudeKey);
  }
  if (geminiKey) {
    apiKeys['gemini'] = encryptApiKey(geminiKey);
  }

  return {
    provider: defaultProvider,
    model: defaultModel,
    temperature: 0.7,
    maxTokens: 3000,
    apiKey: openaiKey || claudeKey || geminiKey || '', // 後方互換性のため、現在のプロバイダーのAPIキー
    apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined, // プロバイダーごとのAPIキー
    localEndpoint: localEndpoint,
  };
};

const defaultSettings: AISettings = getDefaultSettings();

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
      // 環境変数からデフォルト設定を取得
      const envSettings = getDefaultSettings();
      
      // localStorageから読み込み
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loading settings from localStorage:', JSON.stringify(parsed, null, 2));
        
        // 選択されたモデルの最大トークン数を取得
        const selectedProvider = AI_PROVIDERS.find(p => p.id === parsed.provider);
        const selectedModel = selectedProvider?.models.find(m => m.id === parsed.model);
        const modelMaxTokens = selectedModel?.maxTokens || 8192;
        
        // 既存のapiKeyからapiKeysへの移行（後方互換性）
        let apiKeys = parsed.apiKeys || envSettings.apiKeys || {};
        if (parsed.apiKey && !parsed.apiKeys) {
          // 既存のapiKeyがあるがapiKeysがない場合、現在のプロバイダーに移行
          const currentProvider = parsed.provider || envSettings.provider;
          if (currentProvider && currentProvider !== 'local') {
            apiKeys = { ...apiKeys, [currentProvider]: parsed.apiKey };
          }
        }
        
        // 現在のプロバイダーのAPIキーを取得（apiKeysから、またはapiKeyから）
        const currentProvider = parsed.provider || envSettings.provider;
        let currentApiKey = '';
        if (currentProvider && currentProvider !== 'local') {
          if (apiKeys[currentProvider]) {
            currentApiKey = apiKeys[currentProvider];
          } else if (parsed.apiKey) {
            currentApiKey = parsed.apiKey;
          } else if (envSettings.apiKey) {
            currentApiKey = envSettings.apiKey;
          }
        }
        
        // 設定のバリデーション（手動入力のAPIキーが優先）
        const validated = {
          ...envSettings,
          ...parsed,
          // apiKeysを設定
          apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
          // 現在のプロバイダーのAPIキーをapiKeyにも設定（後方互換性）
          apiKey: currentApiKey,
          temperature: Math.max(0, Math.min(1, parsed.temperature || envSettings.temperature)),
          maxTokens: Math.max(100, Math.min(modelMaxTokens, parsed.maxTokens || envSettings.maxTokens)),
        };
        console.log('Validated settings:', JSON.stringify(validated, null, 2));
        return validated;
      }
      return envSettings;
    } catch (error) {
      console.error('AI設定の読み込みエラー:', error);
      return defaultSettings;
    }
  });

  const updateSettings = (newSettings: Partial<AISettings>) => {
    const updated = { ...settings, ...newSettings };
    
    console.log('Updating AI settings:', { 
      newSettings: JSON.stringify(newSettings, null, 2), 
      updated: JSON.stringify(updated, null, 2) 
    });
    
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
    
    // apiKeysオブジェクトを初期化（存在しない場合）
    if (!updated.apiKeys) {
      updated.apiKeys = {};
    }
    
    // APIキーが提供された場合、プロバイダーに応じてapiKeysに保存
    if (newSettings.apiKey !== undefined) {
      const provider = updated.provider;
      if (provider && provider !== 'local') {
        // APIキーを暗号化してapiKeysに保存
        const encryptedKey = encryptApiKey(newSettings.apiKey);
        updated.apiKeys = {
          ...updated.apiKeys,
          [provider]: encryptedKey,
        };
        // 後方互換性のため、apiKeyフィールドにも現在のプロバイダーのAPIキーを設定
        updated.apiKey = encryptedKey;
      }
    }
    
    // プロバイダーが変更された場合、apiKeysから現在のプロバイダーのAPIキーを取得
    if (newSettings.provider && newSettings.provider !== 'local') {
      const currentProviderKey = updated.apiKeys?.[newSettings.provider];
      if (currentProviderKey) {
        updated.apiKey = currentProviderKey;
      } else {
        // apiKeysに存在しない場合は、環境変数から取得を試みる
        const envKey = 
          newSettings.provider === 'openai' ? import.meta.env.VITE_OPENAI_API_KEY :
          newSettings.provider === 'claude' ? import.meta.env.VITE_CLAUDE_API_KEY :
          newSettings.provider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY :
          '';
        if (envKey) {
          const encryptedEnvKey = encryptApiKey(envKey);
          updated.apiKeys = {
            ...updated.apiKeys,
            [newSettings.provider]: encryptedEnvKey,
          };
          updated.apiKey = encryptedEnvKey;
        } else {
          updated.apiKey = '';
        }
      }
    }
    
    console.log('Final settings to save:', JSON.stringify(updated, null, 2));
    setSettings(updated);
    localStorage.setItem('ai-settings', JSON.stringify(updated));
    
    // localStorageに保存された内容を確認
    const savedToStorage = localStorage.getItem('ai-settings');
    console.log('Saved to localStorage:', savedToStorage);
  };

  const isConfigured = Boolean(
    (settings.provider === 'openai' && (settings.apiKey || settings.apiKeys?.['openai'])) ||
    (settings.provider === 'claude' && (settings.apiKey || settings.apiKeys?.['claude'])) ||
    (settings.provider === 'gemini' && (settings.apiKey || settings.apiKeys?.['gemini'])) ||
    (settings.provider === 'local' && settings.localEndpoint)
  );

  console.log('AI Context - Current settings:', JSON.stringify(settings, null, 2));
  console.log('AI Context - Is configured:', isConfigured);
  console.log('AI Context - Provider:', settings.provider);
  console.log('AI Context - LocalEndpoint:', settings.localEndpoint);

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