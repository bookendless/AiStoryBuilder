import { AIRequest, AIResponse, AISettings, OpenAIRequestBody, OpenAIResponse, OpenAIErrorResponse, ClaudeRequestBody, ClaudeResponse, ClaudeErrorResponse, GeminiRequestBody, GeminiResponse, GeminiErrorResponse, GeminiPromptFeedback, GeminiSafetyRating, LocalLLMRequestBody, LocalLLMResponse, LocalLLMErrorResponse } from '../types/ai';
import { EvaluationRequest, EvaluationResult, EvaluationStrictness } from '../types/evaluation';
import { retryApiCall, getUserFriendlyErrorMessage } from '../utils/apiUtils';
import { parseAIResponse, validateResponse } from '../utils/aiResponseParser';
import { decryptApiKeyAsync, sanitizeInputForPrompt } from '../utils/securityUtils';
import { httpService } from './httpService';
import { APIError, ErrorCategory } from '../types/errors';

// システムプロンプト（全プロバイダー共通）
export const SYSTEM_PROMPT = `あなたは日本語の小説創作を専門とするプロフェッショナルな
編集者兼作家アシスタントです。

【あなたの役割】
- 作家の創作意図を深く理解し、物語の魅力を最大化する
- 読者を引き込む自然で美しい日本語を生成する
- キャラクターの一貫性、プロットの整合性を常に意識する
- 具体的で実用的な提案を行う

【出力品質基準】
1. **自然な日本語**: 会話は自然で、地の文は情景が浮かぶ描写、情景法もバランスよく使用する
2. **感情の深み**: キャラクターの内面や心情を丁寧に描写、自由間接話法もバランスよく使用する
3. **五感の活用**: 視覚だけでなく、聴覚・触覚・嗅覚・味覚も活用
4. **リズムとテンポ**: 文章の長短を調整し、読みやすいリズム
5. **一貫性**: 既存設定・世界観・キャラクター性格・容姿・行動と矛盾しない

【禁止事項】
- 陳腐な表現や使い古された比喩、クリシェの多用
- 説明的すぎる文章（Show, don't tell 原則を逸脱する文章）
- キャラクターの性格と矛盾する言動
- 不自然な日本語や直訳調の表現

常に読者の没入感を高めることを最優先に考えてください。`;

// 評価の厳しさレベル別の指示文
const STRICTNESS_INSTRUCTIONS: Record<EvaluationStrictness, string> = {
  gentle: "【評価方針】\n良い点を重視し、建設的なフィードバックを提供してください。改善点は控えめに、励ましの言葉と共に指摘してください。",
  normal: "【評価方針】\nバランスの取れた評価を行ってください。良い点と改善点を公平に指摘してください。",
  strict: "【評価方針】\nより厳格な基準で評価してください。改善点を明確に指摘し、具体的な改善案を提示してください。",
  harsh: "【評価方針】\nプロの編集者として厳しく評価してください。問題点を率直に指摘し、改善が必須の点を明確化してください。批判的であっても建設的な提案を含めてください。"
};

// プロンプトテンプレートを外部ファイルからインポート
import { PROMPTS } from './prompts';


class AIService {
  // モデル名に基づいてmax_tokensとmax_completion_tokensを切り替えるヘルパー関数
  private isNewModel(model: string): boolean {
    // GPT-5系モデル
    if (model.startsWith('gpt-5')) return true;
    // OpenAIのo1/o3系モデル（例: o1-preview, o3-mini）
    if (model.startsWith('o1-') || model.startsWith('o3-')) return true;
    return false;
  }

  // ログ出力用のプロンプトマスキング（機密情報保護）
  private maskSensitiveInfo(text: string, maxLength: number = 100): string {
    if (!text || text.length <= maxLength) {
      return text || '';
    }
    // 機密情報と思われるパターンをマスク
    const masked = text
      .substring(0, maxLength)
      .replace(/api[_-]?key\s*[:=]\s*[\w-]+/gi, 'api_key=***')
      .replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')
      .replace(/password\s*[:=]\s*[\w-]+/gi, 'password=***');
    return masked + '...';
  }

  // ローカルエンドポイントの検証
  private validateLocalEndpoint(endpoint: string): boolean {
    if (!endpoint || typeof endpoint !== 'string') {
      return false;
    }

    try {
      const url = new URL(endpoint);

      // プロトコルの検証
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
      }

      // ホスト名の検証（localhost、ループバック、プライベートネットワークIP、Androidエミュレータを許可）
      const hostname = url.hostname.toLowerCase();
      const allowedHosts = ['localhost', '127.0.0.1', '::1', '[::1]', '10.0.2.2'];

      if (!allowedHosts.includes(hostname)) {
        // プライベートネットワークIP（192.168.x.x、10.x.x.x、172.16-31.x.x）を許可
        const privateIpPattern = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0)/;
        if (!privateIpPattern.test(hostname)) {
          return false;
        }
      }

      // ポート番号の検証（1-65535）
      const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
      if (isNaN(port) || port < 1 || port > 65535) {
        return false;
      }

      return true;
    } catch {
      // URL解析に失敗した場合は無効
      return false;
    }
  }

  /**
   * Whisper APIを使用して音声をテキストに変換する
   * @param audioFile 音声ファイル
   * @param apiKey OpenAI APIキー
   * @returns 変換されたテキスト
   */
  async transcribeAudio(audioFile: File, apiKey: string): Promise<string> {
    // Tauri環境検出（Tauri 2対応）
    const isTauriEnv = typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
    const apiUrl = isTauriEnv || !import.meta.env.DEV
      ? 'https://api.openai.com/v1/audio/transcriptions'
      : '/api/openai/v1/audio/transcriptions';

    try {

      // FormDataを作成
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'ja'); // 日本語を指定
      formData.append('response_format', 'text'); // テキスト形式で返す

      // APIキーの復号化（AES-GCM暗号化対応）
      const decryptedApiKey = await decryptApiKeyAsync(apiKey);

      // 開発環境のみログ出力（機密情報をマスク）
      if (import.meta.env.DEV) {
        console.log('Whisper API Request:', {
          fileName: audioFile.name,
          fileSize: audioFile.size,
          fileType: audioFile.type,
          apiUrl: apiUrl.replace(/key=[^&]+/, 'key=***'),
        });
      }

      // multipart/form-data形式でリクエストを送信
      const response = await httpService.postFormData<string>(
        apiUrl,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
          },
          timeout: 120000, // 音声変換は時間がかかる可能性があるため120秒
        }
      );

      if (response.status >= 400) {
        let errorMessage = `HTTP ${response.status}`;
        let errorData: unknown = null;

        // エラーレスポンスの解析を試みる
        try {
          errorData = typeof response.data === 'string'
            ? JSON.parse(response.data) as { error?: { message?: string; type?: string } }
            : response.data as { error?: { message?: string; type?: string } };

          if (errorData && typeof errorData === 'object' && 'error' in errorData && errorData.error && typeof errorData.error === 'object' && 'message' in errorData.error && typeof errorData.error.message === 'string') {
            errorMessage = errorData.error.message;
          }

          // 特定のエラーコードに対する詳細なメッセージ
          if (response.status === 401) {
            errorMessage = 'APIキーが無効です。AI設定でAPIキーを確認してください。';
          } else if (response.status === 429) {
            errorMessage = 'レート制限に達しました。しばらく待ってから再試行してください。';
          } else if (response.status === 413) {
            errorMessage = '音声ファイルが大きすぎます。10MB以下のファイルを選択してください。';
          } else if (response.status === 400) {
            if (errorData && typeof errorData === 'object' && 'error' in errorData && errorData.error && typeof errorData.error === 'object' && 'message' in errorData.error && typeof errorData.error.message === 'string') {
              errorMessage = errorData.error.message;
            } else {
              errorMessage = '音声ファイルの形式が正しくありません。';
            }
          }
        } catch (_parseError) {
          // JSON解析に失敗した場合は、レスポンスデータをそのまま使用
          if (typeof response.data === 'string') {
            errorMessage = response.data;
          }
          errorData = response.data;
        }

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        if (response.status === 401 || response.status === 403) {
          category = 'api_key_invalid';
        } else if (response.status === 429) {
          category = 'rate_limit';
        } else if (response.status === 413) {
          category = 'invalid_request'; // ファイルサイズが大きすぎる
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
        }

        throw new APIError(`Whisper API エラー: ${errorMessage}`, category, `WHISPER_${response.status}`, errorData);
      }

      // レスポンスはテキスト形式で返される
      const transcription = typeof response.data === 'string'
        ? response.data
        : String(response.data);

      if (!transcription || transcription.trim().length === 0) {
        throw new APIError('音声の文字起こし結果が空です。音声ファイルに音声が含まれているか確認してください。', 'invalid_request', 'EMPTY_TRANSCRIPTION');
      }

      return transcription.trim();
    } catch (error) {
      // エラーログを記録
      const { logAPIError, logError } = await import('../utils/errorLogger');
      if (error instanceof APIError) {
        logAPIError(error, {
          endpoint: apiUrl,
          method: 'POST',
        });
        throw error;
      }
      logError(error, {
        category: 'whisper',
        context: { endpoint: apiUrl, method: 'POST' },
      });

      // より詳細なエラーメッセージを提供
      if (error instanceof Error) {
        // ネットワークエラーの場合
        if (error.message.includes('ネットワークエラー') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          throw new APIError('Whisper APIへの接続に失敗しました。ネットワーク接続を確認してください。', 'network', 'NETWORK_ERROR', error);
        }

        // タイムアウトエラーの場合
        if (error.message.includes('タイムアウト') || error.message.includes('timeout')) {
          throw new APIError('音声の文字起こしがタイムアウトしました。ファイルサイズが大きすぎる可能性があります。', 'timeout', 'TIMEOUT', error);
        }

        // その他のエラー
        throw new APIError(`音声の文字起こしに失敗しました: ${error.message}`, 'unknown', 'WHISPER_ERROR', error);
      }

      throw new APIError('音声の文字起こしに失敗しました。不明なエラーが発生しました。', 'unknown', 'UNKNOWN_ERROR', error);
    }
  }

  private async callOpenAI(request: AIRequest): Promise<AIResponse> {
    // apiKeysから取得、なければapiKeyから取得
    const apiKeyForProvider = request.settings.apiKeys?.['openai'] || request.settings.apiKey;
    if (!apiKeyForProvider) {
      throw new APIError('OpenAI APIキーが設定されていません', 'api_key_missing');
    }

    // APIキーの復号化（AES-GCM暗号化対応）
    const apiKey = await decryptApiKeyAsync(apiKeyForProvider);

    // Tauri環境検出（Tauri 2対応）
    const isTauriEnv = typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
    const apiUrl = isTauriEnv || !import.meta.env.DEV
      ? 'https://api.openai.com/v1/chat/completions'
      : '/api/openai/v1/chat/completions';

    try {

      // 画像がある場合のメッセージ構築
      let userContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
      if (request.image) {
        // Base64データURLをそのまま使用（OpenAI Vision APIはdata:形式をサポート）
        userContent = [
          {
            type: 'text' as const,
            text: request.prompt,
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: request.image,
            },
          },
        ];
      } else {
        userContent = request.prompt;
      }

      // モデル名に基づいて適切なパラメータを選択
      const isNewModelType = this.isNewModel(request.settings.model);
      const requestBody: OpenAIRequestBody = {
        model: request.settings.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: request.settings.temperature,
        stream: !!request.onStream, // ストリーミング有効化
      };

      // GPT-5.1系やo系モデルはmax_completion_tokens、それ以外はmax_tokensを使用
      if (isNewModelType) {
        requestBody.max_completion_tokens = request.settings.maxTokens;
      } else {
        requestBody.max_tokens = request.settings.maxTokens;
      }

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、そうでない場合は180秒（OpenAIのデフォルト、高度なモデルの思考時間を考慮）
      const timeout = request.timeout ?? 180000;

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';

        try {
          await httpService.postStream(
            apiUrl,
            requestBody,
            (chunk) => {
              // SSEの解析
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullContent += content;
                      request.onStream!(content);
                    }
                  } catch (e) {
                    console.warn('SSE parse error:', e);
                  }
                }
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              timeout, // request.timeoutが指定されている場合はそれを使用
              signal: request.signal
            }
          );

          return {
            content: fullContent,
          };
        } catch (streamError) {
          // ストリーミング中のエラーを適切に処理
          console.error('OpenAI streaming error:', streamError);

          // APIErrorの場合はそのまま、そうでない場合は変換
          let errorMessage = 'Unknown error';
          if (streamError instanceof APIError) {
            errorMessage = streamError.message;
          } else if (streamError instanceof Error) {
            // エラーの種類を判定
            const lowerMessage = streamError.message.toLowerCase();
            if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
              errorMessage = `タイムアウトエラー: ${streamError.message}`;
            } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク')) {
              errorMessage = `ネットワークエラー: ${streamError.message}`;
            } else {
              errorMessage = `ストリーミングエラー: ${streamError.message}`;
            }
          } else {
            errorMessage = `ストリーミングエラー: ${String(streamError)}`;
          }

          return {
            content: fullContent, // 既に受信したコンテンツは返す
            error: errorMessage,
          };
        }
      }

      // 通常のリクエスト（非ストリーミング）
      const response = await httpService.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout, // request.timeoutが指定されている場合はそれを使用
      });

      if (response.status >= 400) {
        const errorData = response.data as OpenAIErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        if (response.status === 401 || response.status === 403) {
          category = 'api_key_invalid';
        } else if (response.status === 429) {
          category = 'rate_limit';
        } else if (response.status === 404) {
          category = 'model_not_found';
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
        }

        throw new APIError(`OpenAI API エラー: ${errorMessage}`, category, `OPENAI_${response.status}`, errorData);
      }

      const data = response.data as OpenAIResponse;

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new APIError('OpenAI API からの応答が無効です', 'invalid_request', 'INVALID_RESPONSE');
      }

      return {
        content: data.choices[0].message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      // エラーログを記録
      const { logAPIError, logError } = await import('../utils/errorLogger');
      if (error instanceof APIError) {
        logAPIError(error, {
          endpoint: apiUrl,
          method: 'POST',
        });
        return {
          content: '',
          error: error.message,
        };
      }
      logError(error, {
        category: 'openai',
        context: { endpoint: apiUrl, method: 'POST' },
      });

      // getUserFriendlyErrorを使用してエラーメッセージを生成
      const { getUserFriendlyError } = await import('../utils/errorHandler');
      const errorInfo = getUserFriendlyError(error);

      return {
        content: '',
        error: errorInfo.message,
      };
    }
  }

  private async callClaude(request: AIRequest): Promise<AIResponse> {
    // apiKeysから取得、なければapiKeyから取得
    const apiKeyForProvider = request.settings.apiKeys?.['claude'] || request.settings.apiKey;
    if (!apiKeyForProvider) {
      throw new APIError('Claude APIキーが設定されていません', 'api_key_missing');
    }

    // APIキーの復号化（AES-GCM暗号化対応）
    const apiKey = await decryptApiKeyAsync(apiKeyForProvider);

    // Tauri環境検出（Tauri 2対応）
    const isTauriEnv = typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
    const apiUrl = isTauriEnv || !import.meta.env.DEV
      ? 'https://api.anthropic.com/v1/messages'
      : '/api/anthropic/v1/messages';

    try {

      // 開発環境のみログ出力（機密情報をマスク）
      if (import.meta.env.DEV) {
        console.log('Claude API Request:', {
          model: request.settings.model,
          prompt: this.maskSensitiveInfo(request.prompt, 100),
          hasImage: !!request.image,
          temperature: request.settings.temperature,
          maxTokens: request.settings.maxTokens,
          apiUrl: apiUrl.replace(/\/api\/anthropic\/v1\/messages/, '/api/anthropic/v1/messages'), // エンドポイントのみ表示
          stream: !!request.onStream
        });
      }

      // 画像がある場合のコンテンツ構築
      let userContent: string | Array<{ type: 'text' | 'image'; text?: string; source?: { type: 'base64'; media_type: string; data: string } }>;
      if (request.image) {
        // Base64データURLからBase64部分とMIMEタイプを抽出
        const match = request.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          userContent = [
            {
              type: 'text' as const,
              text: request.prompt,
            },
            {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: mimeType,
                data: base64Data,
              },
            },
          ];
        } else {
          // data:形式でない場合は画像なしとして扱う
          userContent = request.prompt;
        }
      } else {
        userContent = request.prompt;
      }

      const requestBody: ClaudeRequestBody = {
        model: request.settings.model,
        max_tokens: request.settings.maxTokens,
        temperature: request.settings.temperature,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
        stream: !!request.onStream,
      };

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、そうでない場合は180秒（Claudeのデフォルト、高度なモデルの思考時間を考慮）
      const timeout = request.timeout ?? 180000;

      // ブラウザ環境でプロキシ経由の場合は、anthropic-dangerous-direct-browser-accessヘッダーが必要
      const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };

      // ブラウザ環境でプロキシ経由の場合のみ、このヘッダーを追加
      if (!isTauriEnv && import.meta.env.DEV) {
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';

        try {
          await httpService.postStream(
            apiUrl,
            requestBody,
            (chunk) => {
              // SSEの解析
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === 'content_block_delta' && data.delta?.text) {
                    const content = data.delta.text;
                    fullContent += content;
                    request.onStream!(content);
                  }
                } catch (e) {
                  console.warn('SSE parse error:', e);
                }
              }
            },
            {
              headers,
              timeout, // request.timeoutが指定されている場合はそれを使用
              signal: request.signal
            }
          );

          return {
            content: fullContent,
          };
        } catch (streamError) {
          // ストリーミング中のエラーを適切に処理
          console.error('Claude streaming error:', streamError);

          // APIErrorの場合はそのまま、そうでない場合は変換
          let errorMessage = 'Unknown error';
          if (streamError instanceof APIError) {
            errorMessage = streamError.message;
          } else if (streamError instanceof Error) {
            // エラーの種類を判定
            const lowerMessage = streamError.message.toLowerCase();
            if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
              errorMessage = `タイムアウトエラー: ${streamError.message}`;
            } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク')) {
              errorMessage = `ネットワークエラー: ${streamError.message}`;
            } else {
              errorMessage = `ストリーミングエラー: ${streamError.message}`;
            }
          } else {
            errorMessage = `ストリーミングエラー: ${String(streamError)}`;
          }

          return {
            content: fullContent, // 既に受信したコンテンツは返す
            error: errorMessage,
          };
        }
      }

      const response = await httpService.post(apiUrl, requestBody, {
        headers,
        timeout, // request.timeoutが指定されている場合はそれを使用
      });

      if (response.status >= 400) {
        const errorData = response.data as ClaudeErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        if (response.status === 401 || response.status === 403) {
          category = 'api_key_invalid';
        } else if (response.status === 429) {
          category = 'rate_limit';
        } else if (response.status === 404) {
          category = 'model_not_found';
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
        }

        throw new APIError(`Claude API エラー: ${errorMessage}`, category, `CLAUDE_${response.status}`, errorData);
      }

      const data = response.data as ClaudeResponse;

      console.log('Claude API Response:', data);

      if (!data.content || !data.content[0] || !data.content[0].text) {
        console.error('Invalid Claude response structure:', data);
        throw new APIError('Claude API からの応答が無効です', 'invalid_request', 'INVALID_RESPONSE');
      }

      return {
        content: data.content[0].text,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    } catch (error) {
      // エラーログを記録
      const { logAPIError, logError } = await import('../utils/errorLogger');
      if (error instanceof APIError) {
        logAPIError(error, {
          endpoint: apiUrl,
          method: 'POST',
        });
        return {
          content: '',
          error: error.message,
        };
      }
      logError(error, {
        category: 'claude',
        context: { endpoint: apiUrl, method: 'POST' },
      });

      // getUserFriendlyErrorを使用してエラーメッセージを生成
      const { getUserFriendlyError } = await import('../utils/errorHandler');
      const errorInfo = getUserFriendlyError(error);

      return {
        content: '',
        error: errorInfo.message,
      };
    }
  }

  private async callGemini(request: AIRequest): Promise<AIResponse> {
    try {
      // apiKeysから取得、なければapiKeyから取得
      const apiKeyForProvider = request.settings.apiKeys?.['gemini'] || request.settings.apiKey;
      if (!apiKeyForProvider) {
        throw new APIError('Gemini APIキーが設定されていません', 'api_key_missing');
      }

      // APIキーの復号化（AES-GCM暗号化対応）
      const apiKey = await decryptApiKeyAsync(apiKeyForProvider);

      // Tauri環境検出（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' &&
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

      // ストリーミングの場合はエンドポイントが異なる (streamGenerateContent)
      const method = request.onStream ? 'streamGenerateContent' : 'generateContent';

      // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
      const apiUrl = isTauriEnv || !import.meta.env.DEV
        ? `https://generativelanguage.googleapis.com/v1beta/models/${request.settings.model}:${method}?key=${apiKey}`
        : `/api/gemini/v1beta/models/${request.settings.model}:${method}?key=${apiKey}`;

      // 開発環境のみログ出力（機密情報をマスク）
      if (import.meta.env.DEV) {
        console.log('Gemini API Request:', {
          model: request.settings.model,
          prompt: this.maskSensitiveInfo(request.prompt, 100),
          hasImage: !!request.image,
          hasAudio: !!request.audio,
          temperature: request.settings.temperature,
          maxTokens: request.settings.maxTokens,
          apiUrl: apiUrl.replace(/key=[^&]+/, 'key=***'), // APIキーをマスク
          stream: !!request.onStream
        });
      }

      // 画像または音声がある場合のパーツ構築
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
        {
          text: request.prompt,
        },
      ];

      if (request.image) {
        // Base64データURLからBase64部分とMIMEタイプを抽出
        const match = request.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
      }

      if (request.audio) {
        // Base64データURLからBase64部分とMIMEタイプを抽出
        const match = request.audio.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
      }

      const requestBody: GeminiRequestBody = {
        contents: [{
          parts: parts,
        }],
        systemInstruction: {
          parts: [{
            text: SYSTEM_PROMPT,
          }],
        },
        generationConfig: {
          temperature: request.settings.temperature,
          maxOutputTokens: request.settings.maxTokens,
        },
      };

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、そうでない場合は180秒（Geminiのデフォルト、高度なモデルの思考時間を考慮）
      const timeout = request.timeout ?? 180000;

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';
        let buffer = ''; // 不完全なチャンクを保持するバッファ

        try {
          // GeminiのストリーミングはJSONの配列が送られてくる特殊な形式
          // 通常のSSEとは異なり、]で終わるJSON配列のストリーム
          // ここでは簡易的にパースする

          await httpService.postStream(
            apiUrl,
            requestBody,
            (chunk) => {
              // バッファに追加
              buffer += chunk;

              // 行ごとに処理（改行で分割）
              const lines = buffer.split('\n');
              // 最後の行は不完全な可能性があるため、バッファに残す
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '' || line.trim() === '[DONE]') continue;

                // JSONオブジェクトの開始を検出
                if (line.includes('"text"')) {
                  try {
                    // 行からJSONオブジェクトを抽出（簡易実装）
                    const jsonMatch = line.match(/\{[^}]*"text"[^}]*\}/);
                    if (jsonMatch) {
                      const data = JSON.parse(jsonMatch[0]);
                      const text = data.text || '';
                      if (text) {
                        fullContent += text;
                        request.onStream!(text);
                      }
                    } else {
                      // 正規表現でマッチしない場合、元の方法を試す
                      const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
                      let match;
                      while ((match = regex.exec(line)) !== null) {
                        try {
                          // JSON文字列のエスケープを解除
                          const text = JSON.parse(`"${match[1]}"`);
                          fullContent += text;
                          request.onStream!(text);
                        } catch (e) {
                          console.warn('Gemini stream parse error:', e);
                        }
                      }
                    }
                  } catch (e) {
                    console.warn('Gemini stream parse error:', e);
                  }
                }
              }
            },
            {
              timeout, // request.timeoutが指定されている場合はそれを使用
              signal: request.signal
            }
          );

          // 残ったバッファを処理
          if (buffer.trim()) {
            try {
              const jsonMatch = buffer.match(/\{[^}]*"text"[^}]*\}/);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                const text = data.text || '';
                if (text) {
                  fullContent += text;
                  request.onStream!(text);
                }
              } else {
                // 正規表現でマッチしない場合、元の方法を試す
                const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
                let match;
                while ((match = regex.exec(buffer)) !== null) {
                  try {
                    // JSON文字列のエスケープを解除
                    const text = JSON.parse(`"${match[1]}"`);
                    fullContent += text;
                    request.onStream!(text);
                  } catch (e) {
                    console.warn('Gemini final buffer parse error:', e);
                  }
                }
              }
            } catch (e) {
              console.warn('Gemini final buffer parse error:', e);
            }
          }

          return {
            content: fullContent,
          };
        } catch (streamError) {
          // ストリーミング中のエラーを適切に処理
          console.error('Gemini streaming error:', streamError);

          // APIErrorの場合はそのまま、そうでない場合は変換
          let errorMessage = 'Unknown error';
          if (streamError instanceof APIError) {
            errorMessage = streamError.message;
          } else if (streamError instanceof Error) {
            // エラーの種類を判定
            const lowerMessage = streamError.message.toLowerCase();
            if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
              errorMessage = `タイムアウトエラー: ${streamError.message}`;
            } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク')) {
              errorMessage = `ネットワークエラー: ${streamError.message}`;
            } else {
              errorMessage = `ストリーミングエラー: ${streamError.message}`;
            }
          } else {
            errorMessage = `ストリーミングエラー: ${String(streamError)}`;
          }

          return {
            content: fullContent, // 既に受信したコンテンツは返す
            error: errorMessage,
          };
        }
      }

      // Gemini APIは長文生成に時間がかかることがあるため、タイムアウトを180秒に設定（request.timeoutが指定されている場合はそれを使用、高度なモデルの思考時間を考慮）
      const response = await httpService.post(apiUrl, requestBody, {
        timeout, // request.timeoutが指定されている場合はそれを使用
      });

      if (response.status >= 400) {
        const errorData = response.data as GeminiErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        let detailedMessage = errorMessage;

        if (response.status === 401 || response.status === 403) {
          category = 'api_key_invalid';
        } else if (response.status === 429) {
          category = 'rate_limit';
          // 429エラーの場合、より詳細なメッセージを提供
          if (errorMessage.includes('Resource has been exhausted') || errorMessage.includes('quota')) {
            detailedMessage = `Gemini API エラー (429): ${errorMessage}\n\n【考えられる原因】\n`;
            detailedMessage += '1. リージョンのリソース制限: 特定のリージョンでリソースが一時的に枯渇している可能性があります\n';
            detailedMessage += '2. プロビジョニングされたスループット未購入: 従量課金制の場合、リソースの優先度が低い可能性があります\n';
            detailedMessage += '3. 一時的なリソース不足: Googleのインフラストラクチャが一時的に高負荷状態にある可能性があります\n';
            detailedMessage += '4. Proモデルの制限: Gemini 2.5 ProはFlashモデルよりも厳しいリソース制限があります\n\n';
            detailedMessage += '【対処法】\n';
            detailedMessage += '- しばらく待ってから再試行してください\n';
            detailedMessage += '- Gemini 2.5 Flashなどの軽量モデルを試してください\n';
            detailedMessage += '- Google Cloud Consoleでクォータとレート制限を確認してください\n';
            detailedMessage += '- プロビジョニングされたスループットの購入を検討してください';
          } else {
            detailedMessage = `Gemini API エラー (429): ${errorMessage}`;
          }
        } else if (response.status === 404) {
          category = 'model_not_found';
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
        }

        throw new APIError(detailedMessage, category, `GEMINI_${response.status}`, errorData);
      }

      // 200番台の応答でも、candidatesが空の場合は安全フィルターなどでブロックされた可能性がある
      const data = response.data as GeminiResponse;
      if (data && data.candidates && Array.isArray(data.candidates) && data.candidates.length === 0) {
        console.warn('Gemini API response has empty candidates array - possibly blocked by safety filters');
        throw new APIError('Gemini API の応答が安全フィルターによってブロックされた可能性があります。プロンプトの内容を確認してください。', 'invalid_request', 'SAFETY_FILTER_BLOCKED');
      }

      console.log('Gemini API Response:', JSON.stringify(data, null, 2));

      // 応答構造の検証とエラーハンドリング
      if (!data) {
        console.error('Gemini API response is null or undefined');
        throw new APIError('Gemini API からの応答が空です', 'invalid_request', 'EMPTY_RESPONSE');
      }

      // candidatesが存在しない場合、promptFeedbackを確認（安全フィルターによるブロック）
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error('Invalid Gemini response structure - no candidates:', data);

        // promptFeedbackが存在する場合、詳細なエラーメッセージを構築
        if (data.promptFeedback) {
          const feedback: GeminiPromptFeedback = data.promptFeedback;
          let errorMessage = 'Gemini API の応答が安全フィルターによってブロックされました。\n\n';

          if (feedback.blockReason) {
            errorMessage += `【ブロック理由】\n${feedback.blockReason}\n\n`;
          }

          if (feedback.safetyRatings && Array.isArray(feedback.safetyRatings)) {
            const blockedCategories = feedback.safetyRatings.filter((rating: GeminiSafetyRating) =>
              rating.blocked === true || rating.probability === 'HIGH'
            );

            if (blockedCategories.length > 0) {
              errorMessage += '【ブロックされたカテゴリ】\n';
              blockedCategories.forEach((rating: GeminiSafetyRating) => {
                const category = rating.category || '不明';
                const probability = rating.probability || '不明';
                errorMessage += `- ${category}: ${probability}\n`;
              });
              errorMessage += '\n';
            }
          }

          errorMessage += '【対処法】\n';
          errorMessage += '- プロンプトの内容を確認し、不適切な表現がないか確認してください\n';
          errorMessage += '- プロンプトをより中立的で適切な表現に変更してください\n';
          errorMessage += '- 長文の場合は、より短いセクションに分割して試してください';

          throw new APIError(errorMessage, 'invalid_request', 'SAFETY_FILTER_BLOCKED');
        }

        throw new APIError('Gemini API からの応答にcandidatesが含まれていません。安全フィルターによってブロックされた可能性があります。', 'invalid_request', 'NO_CANDIDATES');
      }

      const candidate = data.candidates[0];
      if (!candidate) {
        console.error('Invalid Gemini response structure - empty candidates array:', data);
        throw new APIError('Gemini API からの応答のcandidatesが空です', 'invalid_request', 'EMPTY_CANDIDATES');
      }

      if (!candidate.content) {
        console.error('Invalid Gemini response structure - no content:', candidate);
        throw new APIError('Gemini API からの応答にcontentが含まれていません', 'invalid_request', 'NO_CONTENT');
      }

      if (!candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
        console.error('Invalid Gemini response structure - no parts:', candidate.content);
        throw new APIError('Gemini API からの応答にpartsが含まれていません', 'invalid_request', 'NO_PARTS');
      }

      const firstPart = candidate.content.parts[0];
      if (!firstPart) {
        console.error('Invalid Gemini response structure - empty parts array:', candidate.content.parts);
        throw new APIError('Gemini API からの応答のpartsが空です', 'invalid_request', 'EMPTY_PARTS');
      }

      if (typeof firstPart.text !== 'string') {
        console.error('Invalid Gemini response structure - no text in part:', firstPart);
        throw new APIError('Gemini API からの応答にtextが含まれていません', 'invalid_request', 'NO_TEXT');
      }

      return {
        content: firstPart.text,
      };
    } catch (error) {
      console.error('Gemini API Error:', error);

      // APIErrorの場合はそのまま、そうでない場合はユーザーフレンドリーなメッセージに変換
      if (error instanceof APIError) {
        return {
          content: '',
          error: error.message,
        };
      }

      // より詳細なエラーメッセージを提供
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;

        // 開発環境での接続エラーの場合、より詳細な情報を提供
        if (errorMessage.includes('ネットワークエラー') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
          const isDev = import.meta.env.DEV;
          const isTauriEnv = typeof window !== 'undefined' &&
            ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

          if (isDev && !isTauriEnv) {
            errorMessage = `ネットワークエラー: Gemini APIへの接続に失敗しました。\n\n` +
              `【考えられる原因】\n` +
              `1. Viteの開発サーバーが起動していない可能性があります\n` +
              `2. プロキシ設定が正しく動作していない可能性があります\n\n` +
              `【対処法】\n` +
              `- 開発サーバーが起動していることを確認してください（通常は http://localhost:5173）\n` +
              `- 開発サーバーを再起動してください（npm run dev）\n` +
              `- ブラウザのコンソールで詳細なエラーを確認してください\n` +
              `- Tauri環境（npm run tauri:dev）で実行すると、直接APIに接続できます`;
          }
        }
      }

      return {
        content: '',
        error: errorMessage,
      };
    }
  }

  private async callLocal(request: AIRequest): Promise<AIResponse> {
    try {
      let endpoint = request.settings.localEndpoint || 'http://localhost:1234/v1/chat/completions';

      if (!endpoint) {
        throw new APIError('ローカルエンドポイントが設定されていません', 'invalid_request', 'LOCAL_ENDPOINT_MISSING');
      }

      // Androidエミュレータ対応: API呼び出し時のみlocalhost/127.0.0.1を10.0.2.2に動的変換
      // 注意: tauri.localhostはPC版ビルドでも使用されるため、Android判定には使用しない
      const isAndroid = typeof window !== 'undefined' && (
        (window as any).__TAURI_PLATFORM__ === 'android'
      );
      if (isAndroid) {
        endpoint = endpoint.replace(/localhost|127\.0\.0\.1/, '10.0.2.2');
      }

      // エンドポイントの検証（セキュリティ強化）
      // まず、完全なURLとして検証
      let validatedEndpoint = endpoint;
      if (!this.validateLocalEndpoint(endpoint)) {
        // 相対パスの場合は、デフォルトのlocalhostと結合して検証
        if (endpoint.startsWith('/')) {
          validatedEndpoint = `http://localhost:1234${endpoint}`;
        } else if (!endpoint.includes('://')) {
          // プロトコルがない場合はhttp://を追加
          validatedEndpoint = `http://${endpoint}`;
        } else {
          // 既にプロトコルがあるが検証に失敗した場合
          throw new APIError('無効なローカルエンドポイントです。localhost、127.0.0.1、または::1のみ許可されています。', 'invalid_request', 'INVALID_LOCAL_ENDPOINT');
        }

        // 再度検証
        if (!this.validateLocalEndpoint(validatedEndpoint)) {
          throw new APIError('無効なローカルエンドポイントです。localhost、127.0.0.1、または::1のみ許可されています。', 'invalid_request', 'INVALID_LOCAL_ENDPOINT');
        }
        endpoint = validatedEndpoint;
      }

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
        // http://localhost:1234 -> /api/local
        if (endpoint.includes('localhost:1234')) {
          apiEndpoint = '/api/local';
        } else if (endpoint.includes('localhost:11434')) {
          // Ollama用のプロキシも追加
          apiEndpoint = '/api/ollama';
        }
        // それ以外のローカルエンドポイントの場合は直接接続を試みる
      }
      // Tauri環境では常に元のエンドポイントを使用（HTTPプラグインがlocalhostにアクセス可能）

      // プロンプトの長さを制限（Local LLMでは短めに）
      const maxPromptLength = 3000;
      const truncatedPrompt = request.prompt.length > maxPromptLength
        ? request.prompt.substring(0, maxPromptLength) + '\n\n[プロンプトが長すぎるため省略されました]'
        : request.prompt;

      // max_tokensを制限（Local LLMでは適度に設定）
      const maxTokens = Math.min(request.settings.maxTokens, 8192);

      // 画像がある場合のメッセージ構築（OpenAI互換形式）
      let userContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
      if (request.image) {
        // Base64データURLをそのまま使用（OpenAI互換形式）
        userContent = [
          {
            type: 'text' as const,
            text: truncatedPrompt,
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: request.image, // data:image/...;base64,...形式
            },
          },
        ];
      } else {
        userContent = truncatedPrompt;
      }

      // 開発環境のみログ出力（機密情報をマスク）
      if (import.meta.env.DEV) {
        console.log('Local LLM Request:', {
          endpoint: apiEndpoint,
          originalEndpoint: endpoint,
          model: request.settings.model,
          promptLength: truncatedPrompt.length,
          originalPromptLength: request.prompt.length,
          hasImage: !!request.image,
          temperature: request.settings.temperature,
          maxTokens: maxTokens,
          stream: !!request.onStream
        });
      }

      const requestBody: LocalLLMRequestBody = {
        model: request.settings.model || 'local-model',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: request.settings.temperature,
        max_tokens: maxTokens,
        stream: !!request.onStream,
      };

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、そうでない場合は180秒（Local LLMのデフォルト、高度なモデルの思考時間を考慮）
      const timeout = request.timeout ?? 180000;

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';

        try {
          await httpService.postStream(
            apiEndpoint,
            requestBody,
            (chunk) => {
              // OpenAI互換のSSE解析
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullContent += content;
                      request.onStream!(content);
                    }
                  } catch (_e) {
                    // JSONパースエラーは無視（不完全なチャンクの可能性）
                  }
                }
              }
            },
            {
              timeout, // request.timeoutが指定されている場合はそれを使用
              signal: request.signal
            }
          );

          return {
            content: fullContent,
          };
        } catch (streamError) {
          // ストリーミング中のエラーを適切に処理
          console.error('Local LLM streaming error:', streamError);

          // APIErrorの場合はそのまま、そうでない場合は変換
          let errorMessage = 'Unknown error';
          if (streamError instanceof APIError) {
            errorMessage = streamError.message;
          } else if (streamError instanceof Error) {
            // エラーの種類を判定
            const lowerMessage = streamError.message.toLowerCase();
            if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
              errorMessage = `タイムアウトエラー: ${streamError.message}`;
            } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク') || lowerMessage.includes('failed to fetch')) {
              errorMessage = `ネットワークエラー: ローカルLLMサーバーに接続できません。サーバーが起動しているか確認してください。`;
            } else {
              errorMessage = `ストリーミングエラー: ${streamError.message}`;
            }
          } else {
            errorMessage = `ストリーミングエラー: ${String(streamError)}`;
          }

          return {
            content: fullContent, // 既に受信したコンテンツは返す
            error: errorMessage,
          };
        }
      }

      const response = await httpService.post(apiEndpoint, requestBody, {
        timeout, // request.timeoutが指定されている場合はそれを使用
      });

      if (response.status >= 400) {
        const errorData = response.data as LocalLLMErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        console.error('Local LLM HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint: apiEndpoint,
          hasImage: !!request.image
        });

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        let detailedMessage = errorMessage;

        if (response.status === 404 || errorMessage.toLowerCase().includes('not found')) {
          category = 'model_not_found';
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
          // 画像解析リクエストの場合、画像解析がサポートされていない可能性を示す
          if (request.image) {
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('image') || lowerMessage.includes('vision') || lowerMessage.includes('multimodal') ||
              lowerMessage.includes('unsupported') || lowerMessage.includes('not supported')) {
              detailedMessage = `ローカルLLM エラー: ${errorMessage}\n\n【考えられる原因】\n` +
                `- 使用中のローカルLLMモデルが画像解析（ビジョン）機能をサポートしていない可能性があります\n` +
                `- 画像解析対応モデル（LLaVA、Gemma 3、llava:latestなど）を使用しているか確認してください\n` +
                `- Ollamaの場合: \`ollama pull llava:latest\` でLLaVAモデルをインストールできます\n` +
                `- LM Studioの場合: 画像解析対応モデルを選択してください`;
            }
          }
        } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
          category = 'network';
        }

        throw new APIError(`ローカルLLM エラー: ${detailedMessage}`, category, `LOCAL_LLM_${response.status}`, errorData);
      }

      const data = response.data as LocalLLMResponse;

      console.log('Local LLM Response:', data);

      // エラーレスポンスの処理
      if (data.error) {
        throw new APIError(`ローカルLLM エラー: ${data.error}`, 'server_error', 'LOCAL_LLM_ERROR', data);
      }

      // 複数の応答形式に対応
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return {
          content: data.choices[0].message.content,
        };
      } else if (data.content) {
        // 一部のローカルLLMは直接contentを返す
        return {
          content: data.content,
        };
      } else if (data.response) {
        // 別の形式
        return {
          content: data.response,
        };
      } else {
        console.error('Unexpected response format:', data);
        throw new APIError(`ローカルLLM からの応答が無効です。応答形式: ${JSON.stringify(data)}`, 'invalid_request', 'INVALID_RESPONSE_FORMAT', data);
      }
    } catch (error) {
      // エラーログを記録
      const { logAPIError, logError } = await import('../utils/errorLogger');
      if (error instanceof APIError) {
        logAPIError(error, {
          endpoint: request.settings.localEndpoint,
          method: 'POST',
        });
        return {
          content: '',
          error: error.message,
        };
      }
      logError(error, {
        category: 'local_llm',
        context: {
          endpoint: request.settings.localEndpoint,
          method: 'POST',
        },
      });

      // getUserFriendlyErrorを使用してエラーメッセージを生成
      const { getUserFriendlyError } = await import('../utils/errorHandler');
      const errorInfo = getUserFriendlyError(error);

      // ローカルLLM特有のエラーメッセージを追加
      let errorMessage = errorInfo.message;
      if (error instanceof Error) {
        if (error.message.includes('ネットワークエラー') || error.message.includes('Failed to fetch')) {
          errorMessage = `ローカルLLMサーバーに接続できません。サーバーが起動しているか確認してください。\nエンドポイント: ${request.settings.localEndpoint || 'http://localhost:1234'}`;
        } else if (error.message.includes('タイムアウト')) {
          errorMessage = `ローカルLLMサーバーからの応答がタイムアウトしました。サーバーが正常に動作しているか確認してください。`;
        } else if (error.message.includes('画像解析') || error.message.includes('ビジョン') || error.message.includes('multimodal')) {
          // 画像解析関連のエラーの場合は、そのままエラーメッセージを使用（既に詳細なメッセージが含まれている）
          errorMessage = error.message;
        }
      }

      return {
        content: '',
        error: errorMessage,
      };
    }
  }

  private async callGrok(request: AIRequest): Promise<AIResponse> {
    // apiKeysから取得、なければapiKeyから取得
    const apiKeyForProvider = request.settings.apiKeys?.['grok'] || request.settings.apiKey;
    if (!apiKeyForProvider) {
      throw new APIError('xAI Grok APIキーが設定されていません', 'api_key_missing');
    }

    // APIキーの復号化（AES-GCM暗号化対応）
    const apiKey = await decryptApiKeyAsync(apiKeyForProvider);

    // Tauri環境検出（Tauri 2対応）
    const isTauriEnv = typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    // xAI APIエンドポイント
    // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
    const apiUrl = isTauriEnv || !import.meta.env.DEV
      ? 'https://api.x.ai/v1/chat/completions'
      : '/api/xai/v1/chat/completions';

    try {
      // 開発環境のみログ出力（機密情報をマスク）
      if (import.meta.env.DEV) {
        console.log('xAI Grok API Request:', {
          model: request.settings.model,
          prompt: this.maskSensitiveInfo(request.prompt, 100),
          hasImage: !!request.image,
          temperature: request.settings.temperature,
          maxTokens: request.settings.maxTokens,
          apiUrl: apiUrl.replace(/key=[^&]+/, 'key=***'),
          stream: !!request.onStream
        });
      }

      // 画像がある場合のメッセージ構築（OpenAI互換形式）
      let userContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
      if (request.image) {
        // Base64データURLをそのまま使用（OpenAI Vision APIはdata:形式をサポート）
        userContent = [
          {
            type: 'text' as const,
            text: request.prompt,
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: request.image,
            },
          },
        ];
      } else {
        userContent = request.prompt;
      }

      const requestBody: OpenAIRequestBody = {
        model: request.settings.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: request.settings.temperature,
        stream: !!request.onStream,
        max_tokens: request.settings.maxTokens,
      };

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、そうでない場合は180秒
      const timeout = request.timeout ?? 180000;

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';

        try {
          await httpService.postStream(
            apiUrl,
            requestBody,
            (chunk) => {
              // SSEの解析
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const content = data.choices?.[0]?.delta?.content || '';
                    if (content) {
                      fullContent += content;
                      request.onStream!(content);
                    }
                  } catch (e) {
                    console.warn('SSE parse error:', e);
                  }
                }
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              timeout,
              signal: request.signal
            }
          );

          return {
            content: fullContent,
          };
        } catch (streamError) {
          // ストリーミング中のエラーを適切に処理
          console.error('xAI Grok streaming error:', streamError);

          let errorMessage = 'Unknown error';
          if (streamError instanceof APIError) {
            errorMessage = streamError.message;
          } else if (streamError instanceof Error) {
            const lowerMessage = streamError.message.toLowerCase();
            if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
              errorMessage = `タイムアウトエラー: ${streamError.message}`;
            } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク')) {
              errorMessage = `ネットワークエラー: ${streamError.message}`;
            } else {
              errorMessage = `ストリーミングエラー: ${streamError.message}`;
            }
          } else {
            errorMessage = `ストリーミングエラー: ${String(streamError)}`;
          }

          return {
            content: fullContent, // 既に受信したコンテンツは返す
            error: errorMessage,
          };
        }
      }

      // 通常のリクエスト（非ストリーミング）
      const response = await httpService.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout,
      });

      if (response.status >= 400) {
        const errorData = response.data as OpenAIErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        // エラーの種類を判定してAPIErrorに変換
        let category: ErrorCategory = 'unknown';
        if (response.status === 401 || response.status === 403) {
          category = 'api_key_invalid';
        } else if (response.status === 429) {
          category = 'rate_limit';
        } else if (response.status === 404) {
          category = 'model_not_found';
        } else if (response.status >= 500) {
          category = 'server_error';
        } else if (response.status === 400) {
          category = 'invalid_request';
        }

        throw new APIError(`xAI Grok API エラー: ${errorMessage}`, category, `GROK_${response.status}`, errorData);
      }

      const data = response.data as OpenAIResponse;

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new APIError('xAI Grok API からの応答が無効です', 'invalid_request', 'INVALID_RESPONSE');
      }

      return {
        content: data.choices[0].message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      // エラーログを記録
      const { logAPIError, logError } = await import('../utils/errorLogger');
      if (error instanceof APIError) {
        logAPIError(error, {
          endpoint: apiUrl,
          method: 'POST',
        });
        return {
          content: '',
          error: error.message,
        };
      }
      logError(error, {
        category: 'grok',
        context: { endpoint: apiUrl, method: 'POST' },
      });

      // getUserFriendlyErrorを使用してエラーメッセージを生成
      const { getUserFriendlyError } = await import('../utils/errorHandler');
      const errorInfo = getUserFriendlyError(error);

      return {
        content: '',
        error: errorInfo.message,
      };
    }
  }

  // プロバイダーに応じたAPIキーを取得（apiKeysから、またはapiKeyから）
  private getApiKeyForProvider(settings: AISettings): string {
    if (settings.provider === 'local') {
      return ''; // ローカルLLMはAPIキー不要
    }

    // apiKeysから現在のプロバイダーのAPIキーを取得
    if (settings.apiKeys?.[settings.provider]) {
      return settings.apiKeys[settings.provider];
    }

    // 後方互換性のため、apiKeyからも取得を試みる
    if (settings.apiKey) {
      return settings.apiKey;
    }

    return '';
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    try {
      const { prompt, settings } = request;

      // 入力値のサニタイゼーション（プロンプトインジェクション対策を含む）
      const sanitizedPrompt = sanitizeInputForPrompt(prompt);

      // プロバイダーに応じたAPIキーを取得
      const apiKey = this.getApiKeyForProvider(settings);
      if (!apiKey && settings.provider !== 'local') {
        return {
          content: '',
          error: 'APIキーが設定されていません'
        };
      }

      // settingsにAPIキーを設定（後方互換性のため）
      const settingsWithApiKey = {
        ...settings,
        apiKey: apiKey || settings.apiKey
      };

      // プロンプトの検証
      if (!sanitizedPrompt.trim()) {
        return {
          content: '',
          error: 'プロンプトが空です'
        };
      }

      // 再試行機能付きでAPI呼び出しを実行
      const isLocalProvider = settings.provider === 'local';

      // タイムアウト設定: request.timeoutが指定されている場合はそれを使用、
      // そうでない場合は180秒（全プロバイダー共通、高度なモデルの思考時間を考慮）
      const defaultTimeout = 180000;
      const timeout = request.timeout ?? defaultTimeout;

      const response = await retryApiCall(
        async () => {
          switch (settings.provider) {
            case 'openai':
              return this.callOpenAI({ ...request, prompt: sanitizedPrompt, settings: settingsWithApiKey });
            case 'claude':
              return this.callClaude({ ...request, prompt: sanitizedPrompt, settings: settingsWithApiKey });
            case 'gemini':
              return this.callGemini({ ...request, prompt: sanitizedPrompt, settings: settingsWithApiKey });
            case 'grok':
              return this.callGrok({ ...request, prompt: sanitizedPrompt, settings: settingsWithApiKey });
            case 'local':
              return this.callLocal({ ...request, prompt: sanitizedPrompt, settings: settingsWithApiKey });
            default:
              throw new Error('サポートされていないプロバイダーです');
          }
        },
        {
          // タイムアウト設定: 全プロバイダー共通で180秒（高度なモデルの思考時間を考慮）
          // 全章生成など長時間かかる処理の場合は、request.timeoutで延長可能
          timeout,
          retryConfig: {
            maxRetries: isLocalProvider ? 2 : 3, // ローカルLLMは再試行回数を減らす
            baseDelay: isLocalProvider ? 2000 : 1000, // ローカルLLMは待機時間を長く
            maxDelay: isLocalProvider ? 15000 : 10000,
            backoffMultiplier: 2
          },
          // ストリーミングの場合は再試行しない（複雑になるため）
          shouldRetry: (error: unknown) => {
            if (request.onStream) return false;
            if (!(error instanceof Error)) return false;
            return (
              error.message.includes('timeout') ||
              error.message.includes('network') ||
              error.message.includes('rate limit') ||
              error.message.includes('500') ||
              error.message.includes('503')
            );
          },
          onRetry: (attempt, error) => {
            console.warn(`AI API呼び出し失敗 (試行 ${attempt}):`, error);
          },
          onError: (error) => {
            console.error('AI API呼び出し最終失敗:', error);
          }
        }
      );

      // ストリーミングの場合はそのまま返す
      if (request.onStream) {
        return response;
      }

      // 応答の解析と検証
      // draftタイプの応答は、JSON形式を期待するが、parseAIResponseは章立て解析などを試みるため
      // draftタイプの場合は解析をスキップして生の応答を返す
      if (response.content) {
        // draftタイプの場合は、JSON解析を試みるが、失敗しても生の応答を返す
        if (request.type === 'draft') {
          // draftタイプの場合は、JSON解析を試行するが、失敗しても問題ない
          try {
            const parsedResponse = parseAIResponse(response.content, 'json');
            if (parsedResponse.success && parsedResponse.data) {
              // JSON解析が成功した場合でも、draftタイプの場合は生の応答を返す
              // （DraftStep.tsxで独自に解析するため）
              return {
                content: response.content,
                error: response.error
              };
            }
          } catch (_e) {
            // JSON解析に失敗しても、draftタイプの場合は生の応答を返す
            console.debug('Draft type response: JSON parsing skipped, returning raw content');
          }

          // draftタイプの場合は、生の応答を返す
          return {
            content: response.content,
            error: response.error
          };
        } else {
          // その他のタイプの場合は、通常の解析を実行
          const parsedResponse = parseAIResponse(response.content, 'auto');

          if (parsedResponse.success && validateResponse(parsedResponse)) {
            const data = parsedResponse.data as Record<string, unknown>;
            return {
              content: data.type === 'text' ? (data.content as string) : response.content,
              error: response.error
            };
          } else {
            console.warn('AI応答の解析に失敗しましたが、生の応答を返します:', parsedResponse.error);
          }
        }
      }

      return {
        content: response.content || '',
        error: response.error
      };
    } catch (error) {
      console.error('AI generation error:', error);

      // ユーザーフレンドリーなエラーメッセージを生成
      const friendlyMessage = getUserFriendlyErrorMessage(error, 'AI生成');

      return {
        content: '',
        error: friendlyMessage
      };
    }
  }

  async evaluateStory(request: EvaluationRequest, settings: AISettings): Promise<EvaluationResult> {
    try {
      const strictness = request.strictness || 'normal';
      const promptVariables = {
        title: request.context?.title || '不明',
        theme: request.context?.theme || '不明',
        genre: request.context?.genre || '不明',
        targetAudience: request.context?.targetAudience || '一般読者',
        characters: request.context?.characters || '',
        content: request.content
      };

      let prompt = this.buildPrompt('evaluation', request.mode, promptVariables);

      // 厳しさレベルに応じた評価方針をプロンプトの冒頭に挿入
      const strictnessInstruction = STRICTNESS_INSTRUCTIONS[strictness];
      // プロンプトの最初の行の後に評価方針を挿入
      const firstLineEnd = prompt.indexOf('\n');
      if (firstLineEnd !== -1) {
        prompt = prompt.slice(0, firstLineEnd + 1) + '\n' + strictnessInstruction + '\n\n' + prompt.slice(firstLineEnd + 1);
      } else {
        prompt = strictnessInstruction + '\n\n' + prompt;
      }

      const aiRequest: AIRequest = {
        prompt,
        settings,
        type: 'evaluation'
      };

      const response = await this.generateContent(aiRequest);

      if (response.error) {
        throw new Error(response.error);
      }

      // JSONパースを試みる
      try {
        // レスポンスからJSON部分を抽出（Markdownコードブロック内にある場合などに対応）
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response.content;
        const parsed = JSON.parse(jsonStr) as EvaluationResult;

        // 必須フィールドの確認と補完
        return {
          score: parsed.score || 3,
          summary: parsed.summary || '評価の要約を生成できませんでした。',
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          improvements: parsed.improvements || [],
          detailedAnalysis: parsed.detailedAnalysis || response.content,
          persona: typeof parsed.persona === 'object'
            ? Object.entries(parsed.persona).map(([k, v]) => `${k}: ${v}`).join(', ')
            : parsed.persona // ペルソナ情報があれば取得
        };
      } catch (e) {
        console.error('Failed to parse evaluation result:', e);
        // パース失敗時はテキスト全体を詳細分析として返す
        return {
          score: 0,
          summary: '評価結果の解析に失敗しました。',
          strengths: [],
          weaknesses: [],
          improvements: [],
          detailedAnalysis: response.content
        };
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      throw error;
    }
  }

  buildPrompt(type: string, subType: string, variables: Record<string, string>): string {
    const promptType = PROMPTS[type as keyof typeof PROMPTS];
    if (!promptType) {
      throw new Error(`Prompt type not found: ${type}`);
    }

    const template = promptType[subType];
    if (!template) {
      throw new Error(`Prompt template not found: ${type}.${subType}`);
    }

    let prompt = template;

    // 文体の詳細指示を構築（draftタイプの場合）
    if (type === 'draft' && (subType === 'generate' || subType === 'continue')) {
      const styleDetails = this.buildStyleDetails(variables);
      variables.styleDetails = styleDetails;
    }

    // 変数を埋め込む前に、すべてのユーザー入力をサニタイズ
    const sanitizedVariables: Record<string, string> = {};
    Object.entries(variables).forEach(([key, value]) => {
      // プロンプトに埋め込まれるすべての値をサニタイズ
      // ただし、システムが生成した値（styleDetailsなど）も念のためサニタイズ
      sanitizedVariables[key] = typeof value === 'string'
        ? sanitizeInputForPrompt(value, 50000) // 長いテキストにも対応（例：previousStory）
        : '';
    });

    Object.entries(sanitizedVariables).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value || '');
    });

    // synopsisが空の場合は、参考情報セクション全体を削除
    if (!variables.synopsis || variables.synopsis.trim().length === 0) {
      // {synopsis}プレースホルダーとその前後の改行を削除
      prompt = prompt.replace(/\n{synopsis}\n?/g, '');
      prompt = prompt.replace(/{synopsis}\n?/g, '');
      // 【参考情報（優先度低）】から始まるセクションを削除
      prompt = prompt.replace(/\n【参考情報（優先度低）】[\s\S]*?（注：あらすじは参考情報としてのみ使用し、他の設定と矛盾する場合は他の設定を優先してください）\n?/g, '');
    } else {
      // synopsisが存在する場合は、適切な形式に整形
      const synopsisSection = `\n【参考情報（優先度低）】
あらすじ: ${variables.synopsis}

（注：あらすじは参考情報としてのみ使用し、他の設定と矛盾する場合は他の設定を優先してください）`;
      prompt = prompt.replace(/{synopsis}/g, synopsisSection);
    }

    return prompt;
  }

  private buildStyleDetails(variables: Record<string, string>): string {
    const {
      perspective,
      formality,
      rhythm,
      metaphor,
      dialogue,
      emotion,
      tone
    } = variables;

    // 文体の詳細パラメータが1つでも提供されている場合のみ、詳細指示を構築
    if (!perspective && !formality && !rhythm && !metaphor && !dialogue && !emotion && !tone) {
      return '';
    }

    const details: string[] = [];
    details.push('【文体の詳細指示】');

    if (perspective) {
      details.push(`- **人称**: ${perspective} （一人称 / 三人称 / 神の視点）`);
    }
    if (formality) {
      details.push(`- **硬軟**: ${formality} （硬め / 柔らかめ / 口語的 / 文語的）`);
    }
    if (rhythm) {
      details.push(`- **リズム**: ${rhythm} （短文中心 / 長短混合 / 流れるような長文）`);
    }
    if (metaphor) {
      details.push(`- **比喩表現**: ${metaphor} （多用 / 控えめ / 詩的 / 写実的）`);
    }
    if (dialogue) {
      details.push(`- **会話比率**: ${dialogue} （会話多め / 描写重視 / バランス型）`);
    }
    if (emotion) {
      details.push(`- **感情描写**: ${emotion} （内面重視 / 行動で示す / 抑制的）`);
    }

    if (tone) {
      details.push('');
      details.push(`【参考となるトーン】`);
      details.push(`${tone} （緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）`);
    }

    return details.join('\n');
  }
}

export const aiService = new AIService();