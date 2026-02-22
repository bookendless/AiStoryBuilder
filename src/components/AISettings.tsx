import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Key, Server, Zap } from 'lucide-react';
import { useAI } from '../contexts/AIContext';
import { AI_PROVIDERS, AVAILABLE_PROVIDERS } from '../services/providers';
import { useToast } from './Toast';
import { useModalNavigation } from '../hooks/useKeyboardNavigation';
import { Modal } from './common/Modal';
import { useOverlayBackHandler } from '../contexts/BackButtonContext';
import { decryptApiKeyAsync } from '../utils/securityUtils';
import { OpenAIRequestBody } from '../types/ai';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const LATENCY_LABELS: Record<'standard' | 'fast' | 'reasoning', string> = {
  standard: '標準（数秒）',
  fast: '高速（サブ秒〜数秒）',
  reasoning: '推論特化（応答まで時間がかかります）',
};

export const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useAI();
  const { showError } = useToast();

  const buildInitialFormData = useCallback(() => {
    const initialData = { ...settings };

    // ローカルLLMの場合はlocalEndpointを確実に設定
    if (initialData.provider === 'local' && !initialData.localEndpoint) {
      initialData.localEndpoint = 'http://localhost:1234/v1/chat/completions';
    }
    // APIキーは非同期で復号化するため、ここでは空文字列を設定
    initialData.apiKey = '';
    return initialData;
  }, [settings]);

  const [formData, setFormData] = useState(buildInitialFormData);

  // 非同期でAPIキーを復号化して設定
  const decryptAndSetApiKey = useCallback(async () => {
    if (settings.provider && settings.provider !== 'local') {
      let decryptedKey = '';
      try {
        if (settings.apiKeys?.[settings.provider]) {
          decryptedKey = await decryptApiKeyAsync(settings.apiKeys[settings.provider]);
        } else if (settings.apiKey) {
          decryptedKey = await decryptApiKeyAsync(settings.apiKey);
        }
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
      }
      setFormData(prev => ({ ...prev, apiKey: decryptedKey }));
    }
  }, [settings]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string>('');
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  // Android戻るボタン対応
  useOverlayBackHandler(isOpen, onClose, 'ai-settings-modal', 90);

  // 環境変数の状態をチェック
  const hasEnvApiKey = Boolean(
    import.meta.env.VITE_OPENAI_API_KEY ||
    import.meta.env.VITE_CLAUDE_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GROK_API_KEY ||
    import.meta.env.VITE_LOCAL_LLM_ENDPOINT
  );

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormData());
      decryptAndSetApiKey();
    }
  }, [isOpen, buildInitialFormData, decryptAndSetApiKey]);

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
      case 'grok':
        if (!apiKey.startsWith('xai-')) {
          return 'xAI Grok APIキーは「xai-」で始まる必要があります';
        }
        if (apiKey.length < 20) {
          return 'xAI Grok APIキーが短すぎます';
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
      showError(apiKeyError, 7000, {
        title: 'APIキーエラー',
        details: 'APIキーの形式が正しくありません。各プロバイダーのAPIキー形式を確認してください。',
      });
      return;
    }

    // ローカルLLMの場合はlocalEndpointを確実に設定
    const saveData = { ...formData };
    if (saveData.provider === 'local' && !saveData.localEndpoint) {
      saveData.localEndpoint = 'http://localhost:1234/v1/chat/completions';
    }

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

      // Tauri環境チェック（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' &&
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

      if (formData.provider === 'openai') {
        // モデル名に基づいて適切なパラメータを選択
        const isNewModel = formData.model.startsWith('gpt-5') || formData.model.startsWith('o');
        const requestBody: OpenAIRequestBody = {
          model: formData.model,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
          temperature: formData.temperature,
        };

        // GPT-5.1系やo系モデルはmax_completion_tokens、それ以外はmax_tokensを使用
        if (isNewModel) {
          requestBody.max_completion_tokens = 50;
        } else {
          requestBody.max_tokens = 50;
        }

        // ブラウザ環境ではプロキシ経由、Tauri環境では直接APIにアクセス
        const apiUrl = (!isTauriEnv && import.meta.env.DEV)
          ? '/api/openai/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';

        const response = await httpService.post(apiUrl, requestBody, {
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

        // APIキーの検証（基本的な形式チェック）
        if (!formData.apiKey.startsWith('sk-ant-')) {
          throw new Error('Claude APIキーの形式が正しくありません（sk-ant-で始まる必要があります）');
        }

        // ブラウザ環境ではプロキシ経由、Tauri環境では直接APIにアクセス
        const apiUrl = (!isTauriEnv && import.meta.env.DEV)
          ? '/api/anthropic/v1/messages'
          : 'https://api.anthropic.com/v1/messages';


        // ブラウザ環境でプロキシ経由の場合は、anthropic-dangerous-direct-browser-accessヘッダーが必要
        const headers: Record<string, string> = {
          'x-api-key': formData.apiKey,
          'anthropic-version': '2023-06-01',
        };

        // ブラウザ環境でプロキシ経由の場合のみ、このヘッダーを追加
        if (!isTauriEnv && import.meta.env.DEV) {
          headers['anthropic-dangerous-direct-browser-access'] = 'true';
        }

        const response = await httpService.post(apiUrl, {
          model: formData.model,
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: testPrompt,
            },
          ],
        }, {
          headers,
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string; type?: string } };
          const errorMessage = errorData.error?.message || response.statusText;
          const errorType = errorData.error?.type || 'unknown';


          // 401エラーの場合、より詳細なメッセージを提供
          if (response.status === 401) {
            throw new Error(`認証エラー (401): APIキーが無効です。\nエラー詳細: ${errorMessage}\n\nAPIキーが正しく設定されているか確認してください。`);
          }

          // 404エラーの場合、モデルが見つからないが接続自体は成功している
          if (response.status === 404 && errorType === 'not_found_error') {
            throw new Error(`モデルが見つかりません (404): 指定されたモデル「${formData.model}」は存在しないか、利用できません。\nエラー詳細: ${errorMessage}\n\n利用可能なモデルを選択してください。`);
          }

          throw new Error(`API エラー (${response.status}): ${errorMessage}`);
        }
      } else if (formData.provider === 'gemini') {
        // ブラウザ環境ではプロキシ経由、Tauri環境では直接APIにアクセス
        const baseUrl = (!isTauriEnv && import.meta.env.DEV)
          ? '/api/gemini'
          : 'https://generativelanguage.googleapis.com';

        const apiUrl = `${baseUrl}/v1beta/models/${formData.model}:generateContent${!isTauriEnv && import.meta.env.DEV ? '' : `?key=${formData.apiKey}`}`;

        const response = await httpService.post(apiUrl, {
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
          const errorData = response.data as { error?: { message?: string; code?: number } };
          const errorMessage = errorData.error?.message || response.statusText;

          // 429エラーの場合、より詳細なメッセージを提供
          if (response.status === 429) {
            let detailedMessage = `API エラー (429): ${errorMessage}`;

            if (errorMessage.includes('Resource has been exhausted') || errorMessage.includes('quota')) {
              detailedMessage += '\n\n【考えられる原因】\n';
              detailedMessage += '1. リージョンのリソース制限: 特定のリージョンでリソースが一時的に枯渇している可能性があります\n';
              detailedMessage += '2. プロビジョニングされたスループット未購入: 従量課金制の場合、リソースの優先度が低い可能性があります\n';
              detailedMessage += '3. 一時的なリソース不足: Googleのインフラストラクチャが一時的に高負荷状態にある可能性があります\n';
              detailedMessage += '4. Proモデルの制限: Gemini 2.5 ProはFlashモデルよりも厳しいリソース制限があります\n\n';
              detailedMessage += '【対処法】\n';
              detailedMessage += '- しばらく待ってから再試行してください\n';
              detailedMessage += '- Gemini 2.5 Flashなどの軽量モデルを試してください\n';
              detailedMessage += '- Google Cloud Consoleでクォータとレート制限を確認してください\n';
              detailedMessage += '- プロビジョニングされたスループットの購入を検討してください';
            }

            throw new Error(detailedMessage);
          }

          throw new Error(`API エラー (${response.status}): ${errorMessage}`);
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

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          throw new Error(`API エラー (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
      } else if (formData.provider === 'grok') {
        // xAI Grokの接続テスト
        if (!formData.apiKey) {
          throw new Error('xAI Grok APIキーが設定されていません');
        }

        // APIキーの検証（基本的な形式チェック）
        if (!formData.apiKey.startsWith('xai-')) {
          throw new Error('xAI Grok APIキーの形式が正しくありません（xai-で始まる必要があります）');
        }

        // ブラウザ環境ではプロキシ経由、Tauri環境では直接APIにアクセス
        const apiUrl = (!isTauriEnv && import.meta.env.DEV)
          ? '/api/xai/v1/chat/completions'
          : 'https://api.x.ai/v1/chat/completions';

        const response = await httpService.post(apiUrl, {
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
            'Authorization': `Bearer ${formData.apiKey}`,
          },
        });

        if (response.status >= 400) {
          const errorData = response.data as { error?: { message?: string } };
          const errorMessage = errorData.error?.message || response.statusText;

          if (response.status === 401) {
            throw new Error(`認証エラー (401): APIキーが無効です。\nエラー詳細: ${errorMessage}\n\nAPIキーが正しく設定されているか確認してください。`);
          }

          throw new Error(`API エラー (${response.status}): ${errorMessage}`);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
            AI設定
          </h2>
        </div>
      }
      size="lg"
      ref={modalRef}
    >
      {/* Content */}
      <div className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 font-['Noto_Sans_JP']">
            AIプロバイダー
          </label>
          <div className="grid grid-cols-1 gap-3">
            {AVAILABLE_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={async () => {
                  const newModel = provider.models[0].id;
                  const newModelData = provider.models[0];

                  // プロバイダーに応じてapiKeysからAPIキーを取得（非同期復号化）
                  let apiKeyForProvider = '';
                  try {
                    if (provider.id !== 'local' && settings.apiKeys?.[provider.id]) {
                      apiKeyForProvider = await decryptApiKeyAsync(settings.apiKeys[provider.id]);
                    } else if (provider.id !== 'local' && settings.apiKey) {
                      // 後方互換性のため、apiKeyからも取得を試みる
                      apiKeyForProvider = await decryptApiKeyAsync(settings.apiKey);
                    }
                  } catch (error) {
                    console.error('Failed to decrypt API key:', error);
                  }

                  const updateData = {
                    ...formData,
                    provider: provider.id,
                    model: newModel,
                    maxTokens: Math.min(formData.maxTokens, newModelData.maxTokens),
                    apiKey: apiKeyForProvider
                  };

                  // ローカルLLMの場合はlocalEndpointを設定
                  if (provider.isLocal) {
                    updateData.localEndpoint = formData.localEndpoint || 'http://localhost:1234/v1/chat/completions';
                  }

                  setFormData(updateData);
                }}
                className={`p-4 rounded-lg border-2 transition-all text-left ${formData.provider === provider.id
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${provider.isLocal ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
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
          {selectedProvider && (
            <div className="mt-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                {selectedProvider.description}
              </p>
              {selectedProvider.recommendedUses && selectedProvider.recommendedUses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 font-['Noto_Sans_JP']">
                    推奨ユースケース
                  </p>
                  <ul className="mt-1 list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1 font-['Noto_Sans_JP']">
                    {selectedProvider.recommendedUses.map((useCase) => (
                      <li key={useCase}>{useCase}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedProvider.regions && selectedProvider.regions.length > 0 && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  提供リージョン: {selectedProvider.regions.join(' / ')}
                </p>
              )}
              {selectedProvider.apiDocsUrl && (
                <div className="mt-3">
                  <a
                    href={selectedProvider.apiDocsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-purple-600 dark:text-purple-300 hover:underline font-['Noto_Sans_JP']"
                  >
                    APIドキュメントを開く
                    <span aria-hidden="true" className="ml-1">↗</span>
                  </a>
                </div>
              )}
            </div>
          )}
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
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  最大トークン数: {selectedModel.maxTokens.toLocaleString()}
                </p>
                {selectedModel.capabilities && selectedModel.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="px-2 py-1 text-xs rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 font-['Noto_Sans_JP']"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                )}
                {selectedModel.recommendedUse && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    推奨用途: {selectedModel.recommendedUse}
                  </p>
                )}
                {selectedModel.latencyClass && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                    レイテンシ: {LATENCY_LABELS[selectedModel.latencyClass]}
                  </p>
                )}
              </div>
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
              className={`w-full px-4 py-3 rounded-lg border ${apiKeyError
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
            <div className={`mt-3 p-3 rounded-lg ${testResult.success
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}>
              <p className="text-sm font-['Noto_Sans_JP']">{testResult.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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
    </Modal>
  );
};