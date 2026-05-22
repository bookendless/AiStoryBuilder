import { APIError, ErrorCategory } from '../types/errors';

// HTTPエラーを作成するヘルパー関数
function createHttpError(status: number, message: string, _url: string): APIError {
  let category: 'api_key_missing' | 'api_key_invalid' | 'rate_limit' | 'timeout' | 'network' | 'quota_exceeded' | 'model_not_found' | 'invalid_request' | 'server_error' | 'unknown';

  if (status === 401) {
    category = 'api_key_invalid';
  } else if (status === 403) {
    // 403はquotaメッセージを含む場合はquota_exceeded、それ以外は認証エラー
    const lower = message.toLowerCase();
    if (lower.includes('quota') || lower.includes('クォータ') || lower.includes('billing')) {
      category = 'quota_exceeded';
    } else {
      category = 'api_key_invalid';
    }
  } else if (status === 402) {
    category = 'quota_exceeded';
  } else if (status === 429) {
    category = 'rate_limit';
  } else if (status === 404) {
    category = 'model_not_found';
  } else if (status === 400) {
    category = 'invalid_request';
  } else if (status >= 500) {
    category = 'server_error';
  } else {
    category = 'unknown';
  }
  
  // APIErrorとしてスロー（エラーハンドラーで適切に処理される）
  return new APIError(message, category, `HTTP_${status}`, new Error(`HTTP ${status}: ${message}`));
}

// Tauri fetchのキャッシュ
let tauriFetchCache: typeof fetch | null = null;
let tauriFetchInitialized = false;

// Tauri環境を検出（Tauri 2対応）
const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Tauri 2では__TAURI_INTERNALS__が存在する
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
};

// Tauri fetchを取得（非同期）
const getTauriFetch = async (): Promise<typeof fetch | null> => {
  if (tauriFetchInitialized) {
    return tauriFetchCache;
  }

  const isTauriEnv = isTauri();
  
  if (isTauriEnv) {
    try {
      // 動的インポートを使用してブラウザ環境でのエラーを防ぐ
      const httpPlugin = await import('@tauri-apps/plugin-http');
      tauriFetchCache = httpPlugin.fetch;
      console.log('✅ Tauri HTTP plugin loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load Tauri HTTP plugin:', error);
      tauriFetchCache = null;
    }
  } else {
    console.log('🌐 Running in browser environment, using standard fetch');
    tauriFetchCache = null;
  }
  
  tauriFetchInitialized = true;
  return tauriFetchCache;
};

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class HttpService {
  async request<T = unknown>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 45000
    } = options;

    try {
      // Tauri環境かブラウザ環境かで適切なfetchを使用
      const tauriFetch = await getTauriFetch();
      const fetchToUse = tauriFetch || window.fetch.bind(window);
      const isUsingTauri = tauriFetch !== null;
      
      
      // Tauri環境用のオプション
      const fetchOptions: RequestInit & { connectTimeout?: number } = {
        method,
        headers,
        body,
      };
      
      // Tauri環境ではconnectTimeoutを設定
      if (isUsingTauri) {
        fetchOptions.connectTimeout = timeout;
      } else {
        // ブラウザ環境ではAbortControllerでタイムアウトを実装
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;
        
        try {
          const response = await fetchToUse(url, fetchOptions);
          clearTimeout(timeoutId);
          
          const responseText = await response.text();
          let data: T;
          
          try {
            data = JSON.parse(responseText) as T;
          } catch {
            data = responseText as T;
          }

          // エラーレスポンスの処理
          if (response.status >= 400) {
            console.error(`HTTP Error: ${response.status} ${response.statusText} - ${url}`);
            
            // エラーレスポンスの詳細を取得
            let errorMessage = `HTTP ${response.status}`;
            try {
              if (typeof data === 'object' && data !== null) {
                const errorData = data as { error?: { message?: string; type?: string } };
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                }
              } else if (typeof data === 'string' && data) {
                errorMessage = data;
              }
            } catch {
              // エラーレスポンスの解析に失敗した場合はデフォルトメッセージを使用
            }
            
            // ステータスコードに基づいて適切なエラーをスロー
            throw createHttpError(response.status, errorMessage, url);
          }

          return {
            data,
            status: response.status,
            statusText: response.statusText || '',
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (error) {
          clearTimeout(timeoutId);
          // 既にAPIErrorの場合はそのまま再スロー
          if (error instanceof APIError) {
            throw error;
          }
          throw error;
        }
      }
      
      // Tauri環境での実行
      const response = await fetchToUse(url, fetchOptions);

      const responseText = await response.text();
      let data: T;
      
      try {
        data = JSON.parse(responseText) as T;
      } catch {
        data = responseText as T;
      }

      // エラーレスポンスの処理
      if (response.status >= 400) {
        console.error(`HTTP Error: ${response.status} ${response.statusText} - ${url}`);
        
        // エラーレスポンスの詳細を取得
        let errorMessage = `HTTP ${response.status}`;
        try {
          if (typeof data === 'object' && data !== null) {
            const errorData = data as { error?: { message?: string; type?: string } };
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } else if (typeof data === 'string' && data) {
            errorMessage = data;
          }
        } catch {
          // エラーレスポンスの解析に失敗した場合はデフォルトメッセージを使用
        }
        
        // ステータスコードに基づいて適切なエラーをスロー
        throw createHttpError(response.status, errorMessage, url);
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText || '',
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      // 既にAPIErrorの場合はそのまま再スロー
      if (error instanceof APIError) {
        throw error;
      }
      
      // エラーログは簡略化（APIキーを含む可能性があるため）
      if (error instanceof Error) {
        console.error(`HTTP Request Error: ${method} ${url} - ${error.message}`);
      } else {
        console.error(`HTTP Request Error: ${method} ${url}`);
      }
      
      // より詳細なエラー情報を提供
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError(
            `タイムアウトエラー: リクエストが${timeout}ms以内に完了しませんでした`,
            'timeout',
            'TIMEOUT',
            error
          );
        } else if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          throw new APIError(
            `ネットワークエラー: ${error.message}`,
            'network',
            'NETWORK_ERROR',
            error
          );
        } else if (error.message.includes('timeout')) {
          throw new APIError(
            `タイムアウトエラー: ${error.message}`,
            'timeout',
            'TIMEOUT',
            error
          );
        } else {
          // 既にAPIErrorの場合はそのまま、そうでない場合はunknownエラーとして扱う
          throw new APIError(
            `HTTPリクエストエラー: ${error.message}`,
            'unknown',
            'HTTP_ERROR',
            error
          );
        }
      } else {
        throw new APIError(
          `不明なエラー: ${String(error)}`,
          'unknown',
          'UNKNOWN_ERROR',
          error
        );
      }
    }
  }

  async get<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'GET', headers });
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<HttpResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };
    return this.request<T>(url, {
      method: 'POST',
      headers: defaultHeaders,
      body,
      timeout: options?.timeout,
    });
  }

  async put<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    return this.request<T>(url, { method: 'PUT', headers: defaultHeaders, body });
  }

  async delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'DELETE', headers });
  }

  /**
   * multipart/form-data形式でのPOSTリクエストを実行する
   * @param url URL
   * @param formData FormDataオブジェクト
   * @param options オプション
   */
  async postFormData<T = unknown>(
    url: string,
    formData: FormData,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<HttpResponse<T>> {
    const timeout = options?.timeout || 45000;

    try {
      // Tauri環境かブラウザ環境かで適切なfetchを使用
      const tauriFetch = await getTauriFetch();
      const fetchToUse = tauriFetch || window.fetch.bind(window);
      const isUsingTauri = tauriFetch !== null;

      // multipart/form-dataの場合はContent-Typeヘッダーを設定しない
      // （ブラウザが自動的にboundaryを設定するため）
      const headers: Record<string, string> = { ...(options?.headers || {}) };
      // Content-Typeが明示的に設定されていない場合のみ削除
      if (!headers['Content-Type'] && !headers['content-type']) {
        // FormDataを使用する場合、ブラウザが自動的にContent-Typeを設定するため
        // ヘッダーからContent-Typeを削除する必要はないが、明示的に設定しない
      }

      // Tauri環境用のオプション
      const fetchOptions: RequestInit & { connectTimeout?: number } = {
        method: 'POST',
        headers,
        body: formData,
      };

      // Tauri環境ではconnectTimeoutを設定
      if (isUsingTauri) {
        fetchOptions.connectTimeout = timeout;
      } else {
        // ブラウザ環境ではAbortControllerでタイムアウトを実装
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;

        try {
          const response = await fetchToUse(url, fetchOptions);
          clearTimeout(timeoutId);

          const responseText = await response.text();
          let data: T;

          try {
            data = JSON.parse(responseText) as T;
          } catch {
            data = responseText as T;
          }

          // エラーレスポンスの処理
          if (response.status >= 400) {
            console.error(`HTTP Error: ${response.status} ${response.statusText} - ${url}`);
            
            // エラーレスポンスの詳細を取得
            let errorMessage = `HTTP ${response.status}`;
            try {
              if (typeof data === 'object' && data !== null) {
                const errorData = data as { error?: { message?: string; type?: string } };
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message;
                }
              } else if (typeof data === 'string' && data) {
                errorMessage = data;
              }
            } catch {
              // エラーレスポンスの解析に失敗した場合はデフォルトメッセージを使用
            }
            
            // ステータスコードに基づいて適切なエラーをスロー
            throw createHttpError(response.status, errorMessage, url);
          }

          return {
            data,
            status: response.status,
            statusText: response.statusText || '',
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (error) {
          clearTimeout(timeoutId);
          // 既にAPIErrorの場合はそのまま再スロー
          if (error instanceof APIError) {
            throw error;
          }
          throw error;
        }
      }

      // Tauri環境での実行
      const response = await fetchToUse(url, fetchOptions);

      const responseText = await response.text();
      let data: T;

      try {
        data = JSON.parse(responseText) as T;
      } catch {
        data = responseText as T;
      }

      // エラーレスポンスの処理
      if (response.status >= 400) {
        console.error(`HTTP Error: ${response.status} ${response.statusText} - ${url}`);
        
        // エラーレスポンスの詳細を取得
        let errorMessage = `HTTP ${response.status}`;
        try {
          if (typeof data === 'object' && data !== null) {
            const errorData = data as { error?: { message?: string; type?: string } };
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } else if (typeof data === 'string' && data) {
            errorMessage = data;
          }
        } catch {
          // エラーレスポンスの解析に失敗した場合はデフォルトメッセージを使用
        }
        
        // ステータスコードに基づいて適切なエラーをスロー
        throw createHttpError(response.status, errorMessage, url);
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText || '',
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      // 既にAPIErrorの場合はそのまま再スロー
      if (error instanceof APIError) {
        throw error;
      }
      
      // エラーログは簡略化（APIキーを含む可能性があるため）
      if (error instanceof Error) {
        console.error(`HTTP FormData Request Error: POST ${url} - ${error.message}`);
      } else {
        console.error(`HTTP FormData Request Error: POST ${url}`);
      }

      // より詳細なエラー情報を提供
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError(
            `タイムアウトエラー: リクエストが${timeout}ms以内に完了しませんでした`,
            'timeout',
            'TIMEOUT',
            error
          );
        } else if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          throw new APIError(
            `ネットワークエラー: ${error.message}`,
            'network',
            'NETWORK_ERROR',
            error
          );
        } else if (error.message.includes('timeout')) {
          throw new APIError(
            `タイムアウトエラー: ${error.message}`,
            'timeout',
            'TIMEOUT',
            error
          );
        } else {
          throw new APIError(
            `HTTPリクエストエラー: ${error.message}`,
            'unknown',
            'HTTP_ERROR',
            error
          );
        }
      } else {
        throw new APIError(
          `不明なエラー: ${String(error)}`,
          'unknown',
          'UNKNOWN_ERROR',
          error
        );
      }
    }
  }

  /**
   * ストリーミングリクエストを実行する
   * @param url URL
   * @param data リクエストボディ
   * @param onChunk チャンク受信時のコールバック
   * @param options オプション
   */
  async postStream(
    url: string,
    data: unknown,
    onChunk: (chunk: string) => void,
    options?: {
      headers?: Record<string, string>;
      timeout?: number;
      signal?: AbortSignal;
    }
  ): Promise<void> {
    const body = JSON.stringify(data);
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    try {
      const tauriFetch = await getTauriFetch();
      const fetchToUse = tauriFetch || window.fetch.bind(window);
      const isUsingTauri = tauriFetch !== null;
      
      // TauriのfetchがAbortSignalに対応しているか確認が必要だが、標準的にはsignalを渡す
      const fetchOptions: RequestInit & { connectTimeout?: number } = {
        method: 'POST',
        headers: defaultHeaders,
        body,
        signal: options?.signal
      };

      if (isUsingTauri) {
        fetchOptions.connectTimeout = options?.timeout || 45000;
      }

      const response = await fetchToUse(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        // エラーの種類を判定してAPIErrorに変換
        throw createHttpError(response.status, errorText || `HTTP ${response.status}`, url);
      }

      if (!response.body) {
        throw new APIError('Response body is null', 'invalid_request', 'EMPTY_RESPONSE_BODY');
      }

      // ReadableStreamの処理
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }

    } catch (error) {
      // 既にAPIErrorの場合はそのまま再スロー
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        // 中断は正常な動作とする場合もあるが、ここではエラーとして再スローするか、呼び出し元でハンドリングさせる
        throw new APIError(
          `ストリーミングが中断されました: ${error.message}`,
          'timeout',
          'STREAM_ABORTED',
          error
        );
      }
      
      console.error('Stream Request Error:', error);
      
      // その他のエラーもAPIErrorに変換
      if (error instanceof Error) {
        const lowerMessage = error.message.toLowerCase();
        let category: ErrorCategory = 'unknown';
        if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト')) {
          category = 'timeout';
        } else if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク') || lowerMessage.includes('failed to fetch')) {
          category = 'network';
        }
        
        throw new APIError(
          `ストリーミングエラー: ${error.message}`,
          category,
          'STREAM_ERROR',
          error
        );
      }
      
      throw new APIError(
        `ストリーミングエラー: ${String(error)}`,
        'unknown',
        'STREAM_ERROR',
        error
      );
    }
  }
}

export const httpService = new HttpService();
