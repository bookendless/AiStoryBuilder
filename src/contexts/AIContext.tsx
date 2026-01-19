import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { AISettings } from '../types/ai';
import { AI_PROVIDERS } from '../services/providers';
import { encryptApiKey, encryptApiKeyAsync } from '../utils/securityUtils';
import { storageService } from '../services/storageService';

interface AIContextType {
  settings: AISettings;
  updateSettings: (settings: Partial<AISettings>) => void;
  isConfigured: boolean;
  isStorageReady: boolean; // ストレージの準備状態
}

// 環境変数からデフォルト設定を取得
const getDefaultSettings = (): AISettings => {
  // 環境変数からAPIキーを取得
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const grokKey = import.meta.env.VITE_GROK_API_KEY;
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
  if (grokKey) {
    apiKeys['grok'] = encryptApiKey(grokKey);
  }

  // Androidエミュレータの場合、localhostを10.0.2.2に自動置換
  const isAndroid = typeof window !== 'undefined' && (
    (window as any).__TAURI_PLATFORM__ === 'android' ||
    /android/i.test(navigator.userAgent) ||
    window.location.hostname === 'tauri.localhost' // Android Tauriのデフォルトホスト
  );

  const adjustedLocalEndpoint = (isAndroid && localEndpoint)
    ? localEndpoint.replace(/localhost|127\.0\.0\.1/, '10.0.2.2')
    : localEndpoint;

  return {
    provider: defaultProvider,
    model: defaultModel,
    temperature: 0.7,
    maxTokens: 3000,
    apiKey: openaiKey || claudeKey || geminiKey || '', // 後方互換性のため、現在のプロバイダーのAPIキー
    apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined, // プロバイダーごとのAPIキー
    localEndpoint: adjustedLocalEndpoint,
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
  const [isStorageReady, setIsStorageReady] = useState(false);
  // settingsの最新値をrefで保持（updateSettingsの依存関係を減らすため）
  const getInitialSettings = (): AISettings => {
    // 初期状態は環境変数とlocalStorageの設定のみを使用（APIキーなし）
    // セキュアストレージからのAPIキーは非同期で読み込まれる
    try {
      const envSettings = getDefaultSettings();
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const selectedProvider = AI_PROVIDERS.find(p => p.id === parsed.provider);
        const selectedModel = selectedProvider?.models.find(m => m.id === parsed.model);
        const modelMaxTokens = selectedModel?.maxTokens || 8192;

        return {
          ...envSettings,
          ...parsed,
          // APIキーは後で非同期で読み込まれるため、ここでは空にする
          apiKeys: undefined,
          apiKey: '',
          temperature: Math.max(0, Math.min(1, parsed.temperature || envSettings.temperature)),
          maxTokens: Math.max(100, Math.min(modelMaxTokens, parsed.maxTokens || envSettings.maxTokens)),
        };
      }
      return { ...envSettings, apiKeys: undefined, apiKey: '' };
    } catch (error) {
      console.error('AI設定の読み込みエラー:', error);
      return { ...defaultSettings, apiKeys: undefined, apiKey: '' };
    }
  };

  const initialSettings = getInitialSettings();
  const settingsRef = React.useRef<AISettings>(initialSettings);
  const [settings, setSettingsState] = useState<AISettings>(initialSettings);

  // settingsの更新時にrefも更新
  const setSettings = useCallback((newSettings: AISettings | ((prev: AISettings) => AISettings)) => {
    setSettingsState(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
      settingsRef.current = updated;
      return updated;
    });
  }, []);

  // アプリ起動時にセキュアストレージからAPIキーを読み込み、移行を実行
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        // まずlocalStorageからの移行を実行
        await storageService.migrateFromLocalStorage();

        // セキュアストレージからAPIキーを読み込み
        const storedApiKeys = await storageService.loadApiKeys();

        if (storedApiKeys && Object.keys(storedApiKeys).length > 0) {
          console.log('Loading API keys from secure storage');
          setSettings(prev => {
            const currentProvider = prev.provider;
            const currentApiKey = currentProvider !== 'local' ? storedApiKeys[currentProvider] || '' : '';
            const updated = {
              ...prev,
              apiKeys: storedApiKeys,
              apiKey: currentApiKey,
            };
            settingsRef.current = updated;
            return updated;
          });
        } else {
          // セキュアストレージにない場合は環境変数から取得
          const envSettings = getDefaultSettings();
          if (envSettings.apiKeys && Object.keys(envSettings.apiKeys).length > 0) {
            console.log('Using API keys from environment variables');
            // 環境変数のAPIキーをセキュアストレージに保存
            await storageService.saveApiKeys(envSettings.apiKeys);
            setSettings(prev => {
              const updated = {
                ...prev,
                apiKeys: envSettings.apiKeys,
                apiKey: prev.provider !== 'local' && envSettings.apiKeys ?
                  envSettings.apiKeys[prev.provider] || '' : '',
              };
              settingsRef.current = updated;
              return updated;
            });
          }
        }

        setIsStorageReady(true);
        console.log('✅ Secure storage initialized');
      } catch (error) {
        console.error('Failed to initialize secure storage:', error);
        // フォールバック: localStorageから読み込み
        try {
          const saved = localStorage.getItem('ai-settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            const apiKeys = parsed.apiKeys || {};
            const currentApiKey = parsed.provider !== 'local' ?
              apiKeys[parsed.provider] || parsed.apiKey || '' : '';
            setSettings(prev => {
              const updated = {
                ...prev,
                apiKeys,
                apiKey: currentApiKey,
              };
              settingsRef.current = updated;
              return updated;
            });
          }
        } catch {
          console.error('Fallback to localStorage also failed');
        }
        setIsStorageReady(true);
      }
    };

    initializeStorage();
  }, [setSettings]);

  const updateSettings = useCallback(async (newSettings: Partial<AISettings>) => {
    // Androidエミュレータ対応: localEndpointが更新された場合、localhostを10.0.2.2に置換
    if (newSettings.localEndpoint) {
      const isAndroid = typeof window !== 'undefined' && (
        (window as any).__TAURI_PLATFORM__ === 'android' ||
        /android/i.test(navigator.userAgent) ||
        window.location.hostname === 'tauri.localhost'
      );
      if (isAndroid) {
        newSettings.localEndpoint = newSettings.localEndpoint.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
      }
    }

    const updated = { ...settingsRef.current, ...newSettings };

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
        // APIキーをAES-GCM暗号化してapiKeysに保存（非同期）
        try {
          const encryptedKey = await encryptApiKeyAsync(newSettings.apiKey);
          updated.apiKeys = {
            ...updated.apiKeys,
            [provider]: encryptedKey,
          };
          // 後方互換性のため、apiKeyフィールドにも現在のプロバイダーのAPIキーを設定
          updated.apiKey = encryptedKey;
        } catch (error) {
          console.error('Failed to encrypt API key with AES-GCM, falling back to legacy:', error);
          // フォールバック：レガシー暗号化を使用
          const encryptedKey = encryptApiKey(newSettings.apiKey);
          updated.apiKeys = {
            ...updated.apiKeys,
            [provider]: encryptedKey,
          };
          updated.apiKey = encryptedKey;
        }
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
                newSettings.provider === 'grok' ? import.meta.env.VITE_GROK_API_KEY :
                  '';
        if (envKey) {
          try {
            const encryptedEnvKey = await encryptApiKeyAsync(envKey);
            updated.apiKeys = {
              ...updated.apiKeys,
              [newSettings.provider]: encryptedEnvKey,
            };
            updated.apiKey = encryptedEnvKey;
          } catch (error) {
            console.error('Failed to encrypt env API key with AES-GCM, falling back to legacy:', error);
            const encryptedEnvKey = encryptApiKey(envKey);
            updated.apiKeys = {
              ...updated.apiKeys,
              [newSettings.provider]: encryptedEnvKey,
            };
            updated.apiKey = encryptedEnvKey;
          }
        } else {
          updated.apiKey = '';
        }
      }
    }

    console.log('Final settings to save:', JSON.stringify(updated, null, 2));
    settingsRef.current = updated;
    setSettings(updated);

    // APIキーはセキュアストレージに保存
    if (updated.apiKeys && Object.keys(updated.apiKeys).length > 0) {
      try {
        await storageService.saveApiKeys(updated.apiKeys);
        console.log('API keys saved to secure storage');
      } catch (error) {
        console.error('Failed to save API keys to secure storage:', error);
      }
    }

    // APIキー以外の設定はlocalStorageに保存（後方互換性）
    const settingsWithoutKeys = {
      ...updated,
      apiKeys: undefined, // APIキーはlocalStorageに保存しない
      apiKey: '', // APIキーはlocalStorageに保存しない
    };
    localStorage.setItem('ai-settings', JSON.stringify(settingsWithoutKeys));
    console.log('Settings saved to localStorage (without API keys)');
  }, [setSettings]);

  const isConfigured = useMemo(() => Boolean(
    (settings.provider === 'openai' && (settings.apiKey || settings.apiKeys?.['openai'])) ||
    (settings.provider === 'claude' && (settings.apiKey || settings.apiKeys?.['claude'])) ||
    (settings.provider === 'gemini' && (settings.apiKey || settings.apiKeys?.['gemini'])) ||
    (settings.provider === 'grok' && (settings.apiKey || settings.apiKeys?.['grok'])) ||
    (settings.provider === 'local' && settings.localEndpoint)
  ), [settings]);

  // レガシー形式のAPIキーを検出してログ出力
  useEffect(() => {
    if (!isStorageReady || !settings.apiKeys) return;

    let hasLegacyKeys = false;
    for (const [, encryptedKey] of Object.entries(settings.apiKeys)) {
      if (encryptedKey && !encryptedKey.startsWith('v2:')) {
        hasLegacyKeys = true;
        break;
      }
    }

    if (hasLegacyKeys) {
      console.log('Legacy API keys detected. Keys will be re-encrypted with AES-GCM on next update.');
    }
  }, [isStorageReady, settings.apiKeys]);

  console.log('AI Context - Current settings:', JSON.stringify(settings, null, 2));
  console.log('AI Context - Is configured:', isConfigured);
  console.log('AI Context - Provider:', settings.provider);
  console.log('AI Context - LocalEndpoint:', settings.localEndpoint);

  // コンテキストの値をメモ化（不要な再レンダリングを防止）
  const contextValue = useMemo(() => ({
    settings,
    updateSettings,
    isConfigured,
    isStorageReady,
  }), [settings, updateSettings, isConfigured, isStorageReady]);

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  );
};