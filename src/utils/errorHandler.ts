/**
 * エラーハンドリングと分類のユーティリティ
 */

export type ErrorCategory = 
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'invalid_request'
  | 'server_error'
  | 'unknown';

export interface ErrorInfo {
  category: ErrorCategory;
  title: string;
  message: string;
  details?: string;
  solution: string;
  retryable: boolean;
}

/**
 * エラーメッセージからエラーの種類を分類
 */
export const categorizeError = (error: Error | string): ErrorInfo => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  // APIキー関連
  if (lowerMessage.includes('api key') || lowerMessage.includes('apiキー') || 
      lowerMessage.includes('api_key') || lowerMessage.includes('認証') ||
      lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
    if (lowerMessage.includes('missing') || lowerMessage.includes('設定されていません') || 
        lowerMessage.includes('未設定')) {
      return {
        category: 'api_key_missing',
        title: 'APIキーが設定されていません',
        message: 'AI機能を使用するには、APIキーの設定が必要です。',
        solution: 'ヘッダーの「AI設定」ボタンから、使用するAIプロバイダーのAPIキーを設定してください。',
        retryable: false,
      };
    }
    return {
      category: 'api_key_invalid',
      title: 'APIキーが無効です',
      message: '設定されているAPIキーが正しくないか、期限切れの可能性があります。',
      solution: 'ヘッダーの「AI設定」ボタンから、正しいAPIキーを再設定してください。',
      retryable: false,
    };
  }

  // レート制限
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('レート制限') ||
      lowerMessage.includes('too many requests') || lowerMessage.includes('429')) {
    return {
      category: 'rate_limit',
      title: 'レート制限に達しました',
      message: 'APIの利用制限に達しました。しばらく待ってから再試行してください。',
      details: '多くのリクエストを短時間で送信したため、一時的に制限されています。',
      solution: '数分待ってから再度お試しください。頻繁に使用する場合は、APIプランのアップグレードを検討してください。',
      retryable: true,
    };
  }

  // タイムアウト
  if (lowerMessage.includes('timeout') || lowerMessage.includes('タイムアウト') ||
      lowerMessage.includes('timed out') || lowerMessage.includes('aborted')) {
    return {
      category: 'timeout',
      title: 'リクエストがタイムアウトしました',
      message: 'AIへのリクエストが時間内に完了しませんでした。',
      details: 'ネットワークの接続が不安定か、AIサーバーが混雑している可能性があります。',
      solution: 'ネットワーク接続を確認し、しばらく待ってから再試行してください。',
      retryable: true,
    };
  }

  // ネットワークエラー
  if (lowerMessage.includes('network') || lowerMessage.includes('ネットワーク') ||
      lowerMessage.includes('fetch') || lowerMessage.includes('connection') ||
      lowerMessage.includes('offline') || lowerMessage.includes('オフライン')) {
    return {
      category: 'network',
      title: 'ネットワークエラー',
      message: 'インターネット接続に問題があるか、サーバーに接続できません。',
      details: 'オフライン状態の可能性があります。インターネット接続を確認してください。',
      solution: 'インターネット接続を確認し、接続が復旧したら再試行してください。',
      retryable: true,
    };
  }

  // クォータ超過
  if (lowerMessage.includes('quota') || lowerMessage.includes('クォータ') ||
      lowerMessage.includes('billing') || lowerMessage.includes('payment') ||
      lowerMessage.includes('insufficient')) {
    return {
      category: 'quota_exceeded',
      title: '利用制限に達しました',
      message: 'APIの利用制限またはクレジット残高が不足しています。',
      solution: 'APIプロバイダーのアカウントでクレジット残高を確認し、必要に応じて追加してください。',
      retryable: false,
    };
  }

  // モデルが見つからない
  if (lowerMessage.includes('model') && (lowerMessage.includes('not found') || 
      lowerMessage.includes('invalid') || lowerMessage.includes('存在しません'))) {
    return {
      category: 'model_not_found',
      title: 'モデルが見つかりません',
      message: '指定されたAIモデルが存在しないか、利用できません。',
      solution: 'AI設定で別のモデルを選択するか、モデル名を確認してください。',
      retryable: false,
    };
  }

  // 無効なリクエスト
  if (lowerMessage.includes('invalid') || lowerMessage.includes('bad request') ||
      lowerMessage.includes('400') || lowerMessage.includes('無効')) {
    return {
      category: 'invalid_request',
      title: '無効なリクエスト',
      message: '送信されたリクエストが正しくありません。',
      solution: '入力内容を確認し、再度お試しください。問題が続く場合は、ページを再読み込みしてください。',
      retryable: true,
    };
  }

  // サーバーエラー
  if (lowerMessage.includes('server error') || lowerMessage.includes('500') ||
      lowerMessage.includes('502') || lowerMessage.includes('503') ||
      lowerMessage.includes('504') || lowerMessage.includes('サーバー')) {
    return {
      category: 'server_error',
      title: 'サーバーエラー',
      message: 'AIサーバーでエラーが発生しました。',
      details: '一時的なサーバーの問題の可能性があります。',
      solution: 'しばらく待ってから再試行してください。問題が続く場合は、AIプロバイダーのステータスページを確認してください。',
      retryable: true,
    };
  }

  // 不明なエラー
  return {
    category: 'unknown',
    title: 'エラーが発生しました',
    message: errorMessage,
    solution: 'ページを再読み込みするか、しばらく待ってから再度お試しください。',
    retryable: true,
  };
};

/**
 * エラーをユーザーフレンドリーなメッセージに変換
 */
export const getUserFriendlyError = (error: Error | string): ErrorInfo => {
  return categorizeError(error);
};

/**
 * エラーが再試行可能かどうかを判定
 */
export const isRetryableError = (error: Error | string): boolean => {
  return categorizeError(error).retryable;
};






