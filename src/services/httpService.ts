import { fetch } from '@tauri-apps/plugin-http';

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
      const response = await fetch(url, {
        method,
        headers,
        body,
        connectTimeout: timeout,
      });

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
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // より詳細なエラー情報を提供
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
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

  async post<T = unknown>(url: string, data?: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    return this.request<T>(url, { method: 'POST', headers: defaultHeaders, body });
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
