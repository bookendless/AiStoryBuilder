import React, { useState } from 'react';
import { X, Settings, Key, Server, Zap } from 'lucide-react';
import { useAI } from '../contexts/AIContext';
import { AI_PROVIDERS } from '../services/aiService';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useAI();
  const [formData, setFormData] = useState(() => {
    const initialData = { ...settings };
    // ローカルLLMの場合はlocalEndpointを確実に設定
    if (initialData.provider === 'local' && !initialData.localEndpoint) {
      initialData.localEndpoint = 'http://localhost:1234/v1/chat/completions';
    }
    return initialData;
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string>('');

  // 環境変数の状態をチェック
  const hasEnvApiKey = Boolean(
    import.meta.env.VITE_OPENAI_API_KEY ||
    import.meta.env.VITE_CLAUDE_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_LOCAL_LLM_ENDPOINT
  );

  if (!isOpen) return null;

  const validateApiKey = (provider: string, apiKey: string): string => {
    if (!apiKey) return '';
    
    switch (provider) {
      case 'openai':
        if (!apiKey.startsWith('sk-')) {
          return 'OpenAI APIキーは「sk-」で始まる必要があります';
        }
        if (apiKey.length < 20) {
          return 'OpenAI APIキーが短すぎます';
        }
        break;
      case 'claude':
        if (!apiKey.startsWith('sk-ant-')) {
          return 'Claude APIキーは「sk-ant-」で始まる必要があります';
        }
        if (apiKey.length < 30) {
          return 'Claude APIキーが短すぎます';
        }
        break;
      case 'gemini':
        if (apiKey.length < 20) {
          return 'Gemini APIキーが短すぎます';
        }
        break;
    }
    return '';
  };

  const handleApiKeyChange = (value: string) => {
    setFormData({ ...formData, apiKey: value });
    const error = validateApiKey(formData.provider, value);
    setApiKeyError(error);
  };

  const handleSave = () => {
    if (apiKeyError) {
      alert(`APIキーエラー: ${apiKeyError}`);
      return;
    }
    
    // ローカルLLMの場合はlocalEndpointを確実に設定
    const saveData = { ...formData };
    if (saveData.provider === 'local' && !saveData.localEndpoint) {
      saveData.localEndpoint = 'http://localhost:1234/v1/chat/completions';
    }
    
    console.log('Saving AI settings:', JSON.stringify(saveData, null, 2));
    updateSettings(saveData);
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // テスト用の簡単なプロンプト
      const testPrompt = "こんにちは。これは接続テストです。";
      
      // httpServiceを使用してテストを実行
      const { httpService } = await import('../services/httpService');
      
      if (formData.provider === 'openai') {
        const response = await httpService.post('https://api.openai.com/v1/chat/completions', {
          model: formData.model,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
          max_tokens: 50,
        }, {
          headers: {
            'Authorization': `Bearer ${formData.apiKey}`,
          },
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          throw new Error(`API エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      } else if (formData.provider === 'claude') {
        if (!formData.apiKey) {
          throw new Error('Claude APIキーが設定されていません');
        }
        const response = await httpService.post('https://api.anthropic.com/v1/messages', {
          model: formData.model,
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
        }, {
          headers: {
            'x-api-key': formData.apiKey,
            'anthropic-version': '2023-06-01',
          },
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          throw new Error(`API エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      } else if (formData.provider === 'gemini') {
        const response = await httpService.post(`https://generativelanguage.googleapis.com/v1beta/models/${formData.model}:generateContent?key=${formData.apiKey}`, {
          contents: [{
            parts: [{
              text: testPrompt,
            }],
          }],
          generationConfig: {
            maxOutputTokens: 50,
          },
        }, {
          headers: formData.apiKey ? { 'x-goog-api-key': formData.apiKey } : undefined,
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          throw new Error(`API エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      } else if (formData.provider === 'local') {
        let endpoint = formData.localEndpoint || 'http://localhost:1234/v1/chat/completions';
        
        // エンドポイントにパスが含まれていない場合は追加
        if (!endpoint.includes('/v1/chat/completions') && !endpoint.includes('/api/') && !endpoint.includes('/chat')) {
          if (endpoint.endsWith('/')) {
            endpoint = endpoint + 'v1/chat/completions';
          } else {
            endpoint = endpoint + '/v1/chat/completions';
          }
        }
        
        // Tauri環境チェック（Tauri 2対応）
        const isTauriEnv = typeof window !== 'undefined' && 
          ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
        
        // 開発環境でブラウザの場合のみプロキシ経由（CORS回避）
        let apiEndpoint = endpoint;
        if (!isTauriEnv && import.meta.env.DEV) {
          // ブラウザ開発環境ではViteのプロキシを使用
          if (endpoint.includes('localhost:1234')) {
            apiEndpoint = '/api/local';
          } else if (endpoint.includes('localhost:11434')) {
            apiEndpoint = '/api/ollama';
          }
        }
        // Tauri環境では常に元のエンドポイントを使用（HTTPプラグインがlocalhostにアクセス可能）
        
        console.log('Testing local LLM connection:', {
          originalEndpoint: endpoint,
          apiEndpoint,
          isTauriEnv,
          isDev: import.meta.env.DEV
        });
        
        const response = await httpService.post(apiEndpoint, {
          model: formData.model || 'local-model',
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
          max_tokens: 50,
        }, {
          timeout: 60000,
        });
        
        console.log('Local LLM test response:', {
          status: response.status,
          statusText: response.statusText
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          throw new Error(`API エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      } else {
        throw new Error('サポートされていないプロバイダーです');
      }

      setTestResult({
        success: true,
        message: '接続テストが成功しました！AI機能が正常に動作します。'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `接続テストが失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const selectedProvider = AI_PROVIDERS.find(p => p.id === formData.provider);
  const selectedModel = selectedProvider?.models.find(m => m.id === formData.model);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                AI設定
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
              AIプロバイダー
            </label>
            <div className="grid grid-cols-1 gap-3">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    const newModel = provider.models[0].id;
                    const newModelData = provider.models[0];
                    const updateData = { 
                      ...formData, 
                      provider: provider.id,
                      model: newModel,
                      maxTokens: Math.min(formData.maxTokens, newModelData.maxTokens)
                    };
                    
                    // ローカルLLMの場合はlocalEndpointを設定
                    if (provider.isLocal) {
                      updateData.localEndpoint = formData.localEndpoint || 'http://localhost:1234/v1/chat/completions';
                    }
                    
                    setFormData(updateData);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.provider === provider.id
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      provider.isLocal ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
                    }`}>
                      {provider.isLocal ? (
                        <Server className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {provider.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {provider.isLocal ? 'ローカル実行' : 'クラウドAPI'}
                        {provider.requiresApiKey && ' • APIキー必要'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          {selectedProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                モデル
              </label>
              <select
                value={formData.model}
                onChange={(e) => {
                  const selectedModel = selectedProvider?.models.find(m => m.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    model: e.target.value,
                    maxTokens: selectedModel ? Math.min(formData.maxTokens, selectedModel.maxTokens) : formData.maxTokens
                  });
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']"
              >
                {selectedProvider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  最大トークン数: {selectedModel.maxTokens.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* API Key */}
          {selectedProvider?.requiresApiKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                <Key className="h-4 w-4 inline mr-1" />
                APIキー
              </label>
              
              {/* 環境変数の状態表示 */}
              {hasEnvApiKey && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                      環境変数からAPIキーが利用可能です
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-['Noto_Sans_JP']">
                    手動入力のAPIキーが優先されます
                  </p>
                </div>
              )}
              
              <input
                type="password"
                value={formData.apiKey || ''}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={hasEnvApiKey ? "環境変数が利用可能（手動入力で上書き可能）" : "APIキーを入力してください"}
                className={`w-full px-4 py-3 rounded-lg border ${
                  apiKeyError 
                    ? 'border-red-500 dark:border-red-400' 
                    : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']`}
              />
              {apiKeyError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                  {apiKeyError}
                </p>
              )}
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                {hasEnvApiKey 
                  ? '環境変数と手動入力の両方が利用可能です。手動入力が優先されます。'
                  : 'APIキーは安全に保存され、外部に送信されることはありません'
                }
              </p>
            </div>
          )}

          {/* Local Endpoint */}
          {selectedProvider?.isLocal && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                <Server className="h-4 w-4 inline mr-1" />
                ローカルエンドポイント
              </label>
              <input
                type="url"
                value={formData.localEndpoint || 'http://localhost:1234/v1/chat/completions'}
                onChange={(e) => setFormData({ ...formData, localEndpoint: e.target.value })}
                placeholder="http://localhost:1234/v1/chat/completions"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                LM Studio、Ollama等のローカルLLMサーバーのエンドポイント
              </p>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">
                  <strong>正しいエンドポイント例：</strong>
                </p>
                <ul className="mt-1 text-xs text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP'] space-y-1">
                  <li>• LM Studio: <code>http://localhost:1234/v1/chat/completions</code></li>
                  <li>• Ollama: <code>http://localhost:11434/v1/chat/completions</code></li>
                  <li>• リモートサーバー: <code>http://192.168.0.7:1234/v1/chat/completions</code></li>
                </ul>
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300 font-['Noto_Sans_JP']">
                  パスが含まれていない場合は自動的に追加されます
                </p>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                Temperature (創造性)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>保守的 (0.0)</span>
                <span className="font-semibold">{formData.temperature}</span>
                <span>創造的 (1.0)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                最大トークン数
              </label>
              <input
                type="number"
                min="100"
                max={selectedModel?.maxTokens || 2000000}
                value={formData.maxTokens}
                onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-['Noto_Sans_JP']"
              />
            </div>
          </div>

          {/* Connection Test */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
              接続テスト
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-['Noto_Sans_JP']">
              設定が正しく動作するかテストできます
            </p>
            
            <button 
              onClick={handleTestConnection}
              disabled={isTesting || !formData.apiKey && formData.provider !== 'local'}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? 'テスト中...' : '接続をテスト'}
            </button>
            
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg ${
                testResult.success 
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                  : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
                <p className="text-sm font-['Noto_Sans_JP']">{testResult.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP']"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-lg font-['Noto_Sans_JP']"
            >
              設定を保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};