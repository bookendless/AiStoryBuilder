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
      timeout = 30000
    } = options;

    try {
      // Tauri環境かブラウザ環境かで適切なfetchを使用
      const tauriFetch = await getTauriFetch();
      const fetchToUse = tauriFetch || window.fetch.bind(window);
      const isUsingTauri = tauriFetch !== null;
      
      console.log('HTTP Request:', {
        url,
        method,
        isTauriEnv: isTauri(),
        isUsingTauriFetch: isUsingTauri
      });
      
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

          return {
            data,
            status: response.status,
            statusText: response.statusText || '',
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (error) {
          clearTimeout(timeoutId);
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

      return {
        data,
        status: response.status,
        statusText: response.statusText || '',
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      console.error('HTTP Request Error:', {
        url,
        method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        isTauriEnv: isTauri()
      });
      
      // より詳細なエラー情報を提供
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`タイムアウトエラー: リクエストが${timeout}ms以内に完了しませんでした`);
        } else if (error.message.includes('fetch')) {
          throw new Error(`ネットワークエラー: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`タイムアウトエラー: ${error.message}`);
        } else {
          throw new Error(`HTTPリクエストエラー: ${error.message}`);
        }
      } else {
        throw new Error(`不明なエラー: ${String(error)}`);
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
}

export const httpService = new HttpService();
