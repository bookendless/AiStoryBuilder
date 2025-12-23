/**
 * API呼び出しのユーティリティ関数
 * 再試行機能とエラーハンドリングを提供
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface ApiCallOptions {
  timeout?: number;
  retryConfig?: RetryConfig;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
  onSuccess?: (response: unknown) => void;
  onError?: (error: unknown) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

/**
 * 再試行機能付きのAPI呼び出し
 * @param apiCall API呼び出し関数
 * @param options オプション設定
 * @returns Promise<T>
 */
export const retryApiCall = async <T>(
  apiCall: () => Promise<T>,
  options: ApiCallOptions = {}
): Promise<T> => {
  const {
    timeout = 30000,
    retryConfig = DEFAULT_RETRY_CONFIG,
    shouldRetry,
    onRetry,
    onSuccess,
    onError
  } = options;

  let lastError: unknown;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // タイムアウト付きでAPI呼び出しを実行
      const result = await Promise.race([
        apiCall(),
        new Promise<never>((_, reject) => 
          setTimeout(() => {
            const timeoutSeconds = Math.round(timeout / 1000);
            reject(new Error(`API呼び出しがタイムアウトしました（${timeoutSeconds}秒以内に完了しませんでした）`));
          }, timeout)
        )
      ]);

      // 成功時のコールバック
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      lastError = error;
      
      // shouldRetryが指定されている場合、再試行可能かチェック
      if (shouldRetry && !shouldRetry(error)) {
        if (onError) {
          onError(error);
        }
        throw error;
      }
      
      // 最後の試行の場合はエラーを投げる
      if (attempt === retryConfig.maxRetries) {
        if (onError) {
          onError(error);
        }
        throw error;
      }

      // 再試行前のコールバック
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // 指数バックオフで待機
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelay
      );
      
      console.warn(`API呼び出し失敗 (試行 ${attempt + 1}/${retryConfig.maxRetries + 1}):`, error);
      console.log(`${delay}ms後に再試行します...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * ネットワークエラーかどうかを判定
 */
export const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  
  // ネットワークエラーのパターン
  const networkErrorPatterns = [
    'NetworkError',
    'Failed to fetch',
    'net::ERR_',
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ECONNRESET'
  ];
  
  const errorMessage = (error as Error).message || String(error);
  return networkErrorPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
};

/**
 * APIエラーの種類を判定
 */
export const getApiErrorType = (error: unknown): 'network' | 'auth' | 'rate_limit' | 'server' | 'client' | 'unknown' => {
  if (!error) return 'unknown';
  
  const errorMessage = (error as Error).message || String(error);
  const statusCode = (error as { status?: number; statusCode?: number }).status || (error as { status?: number; statusCode?: number }).statusCode;
  
  // ネットワークエラー
  if (isNetworkError(error)) {
    return 'network';
  }
  
  // 認証エラー
  if (statusCode === 401 || statusCode === 403 || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
    return 'auth';
  }
  
  // レート制限エラー
  if (statusCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return 'rate_limit';
  }
  
  // サーバーエラー
  if (statusCode && statusCode >= 500) {
    return 'server';
  }
  
  // クライアントエラー
  if (statusCode && statusCode >= 400) {
    return 'client';
  }
  
  return 'unknown';
};

/**
 * ユーザーフレンドリーなエラーメッセージを生成
 */
export const getUserFriendlyErrorMessage = (error: unknown, context: string = ''): string => {
  const errorType = getApiErrorType(error);
  const baseMessage = context ? `${context}: ` : '';
  
  switch (errorType) {
    case 'network':
      return `${baseMessage}インターネット接続を確認してください`;
    case 'auth':
      return `${baseMessage}AI設定でAPIキーを確認してください`;
    case 'rate_limit':
      return `${baseMessage}しばらく待ってから再試行してください`;
    case 'server':
      return `${baseMessage}AIサービスに問題があります。しばらく待ってから再試行してください`;
    case 'client':
      return `${baseMessage}入力内容を確認してください`;
    default:
      return `${baseMessage}エラーが発生しました。もう一度お試しください`;
  }
};

/**
 * エラーが再試行可能かどうかを判定
 */
export const isRetryableError = (error: unknown): boolean => {
  const errorType = getApiErrorType(error);
  
  // 再試行可能なエラー
  const retryableErrors = ['network', 'server', 'rate_limit'];
  
  return retryableErrors.includes(errorType);
};

