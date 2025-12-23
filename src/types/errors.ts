/**
 * アプリケーション全体で使用するエラータイプ定義
 */

// エラーカテゴリ
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
  | 'database_error'
  | 'validation_error'
  | 'not_found'
  | 'storage_error'
  | 'unknown';

// エラー情報インターフェース
export interface ErrorInfo {
  category: ErrorCategory;
  title: string;
  message: string;
  details?: string;
  solution: string;
  retryable: boolean;
  code?: string;
  originalError?: unknown;
}

// ベースエラークラス
export class AppError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly code?: string,
    public readonly originalError?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toErrorInfo(): ErrorInfo {
    return {
      category: this.category,
      title: this.getTitle(),
      message: this.message,
      solution: this.getSolution(),
      retryable: this.retryable,
      code: this.code,
      originalError: this.originalError,
    };
  }

  protected getTitle(): string {
    switch (this.category) {
      case 'api_key_missing':
        return 'APIキーが設定されていません';
      case 'api_key_invalid':
        return 'APIキーが無効です';
      case 'rate_limit':
        return 'レート制限に達しました';
      case 'timeout':
        return 'リクエストがタイムアウトしました';
      case 'network':
        return 'ネットワークエラー';
      case 'quota_exceeded':
        return '利用制限に達しました';
      case 'model_not_found':
        return 'モデルが見つかりません';
      case 'invalid_request':
        return '無効なリクエスト';
      case 'server_error':
        return 'サーバーエラー';
      case 'database_error':
        return 'データベースエラー';
      case 'validation_error':
        return 'バリデーションエラー';
      case 'not_found':
        return 'リソースが見つかりません';
      case 'storage_error':
        return 'ストレージエラー';
      default:
        return 'エラーが発生しました';
    }
  }

  protected getSolution(): string {
    switch (this.category) {
      case 'api_key_missing':
        return 'ヘッダーの「AI設定」ボタンから、使用するAIプロバイダーのAPIキーを設定してください。';
      case 'api_key_invalid':
        return 'ヘッダーの「AI設定」ボタンから、正しいAPIキーを再設定してください。';
      case 'rate_limit':
        return '数分待ってから再度お試しください。頻繁に使用する場合は、APIプランのアップグレードを検討してください。';
      case 'timeout':
        return 'ネットワーク接続を確認し、しばらく待ってから再試行してください。';
      case 'network':
        return 'インターネット接続を確認し、接続が復旧したら再試行してください。';
      case 'quota_exceeded':
        return 'APIプロバイダーのアカウントでクレジット残高を確認し、必要に応じて追加してください。';
      case 'model_not_found':
        return 'AI設定で別のモデルを選択するか、モデル名を確認してください。';
      case 'invalid_request':
        return '入力内容を確認し、再度お試しください。問題が続く場合は、ページを再読み込みしてください。';
      case 'server_error':
        return 'しばらく待ってから再試行してください。問題が続く場合は、AIプロバイダーのステータスページを確認してください。';
      case 'database_error':
      case 'storage_error':
        return 'ブラウザのストレージを確認し、必要に応じてページを再読み込みしてください。';
      case 'validation_error':
        return '入力内容を確認し、正しい形式で入力してください。';
      case 'not_found':
        return 'リソースが存在しないか、削除された可能性があります。';
      default:
        return 'ページを再読み込みするか、しばらく待ってから再度お試しください。';
    }
  }
}

// API関連エラー
export class APIError extends AppError {
  constructor(
    message: string,
    category: ErrorCategory,
    code?: string,
    originalError?: unknown
  ) {
    super(message, category, code, originalError, 
      category === 'rate_limit' || category === 'timeout' || category === 'network' || category === 'server_error');
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

// データベース関連エラー
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    originalError?: unknown
  ) {
    const category: ErrorCategory = 
      code === 'VALIDATION_ERROR' ? 'validation_error' :
      code === 'NOT_FOUND' ? 'not_found' :
      code === 'STORAGE_ERROR' ? 'storage_error' :
      'database_error';
    
    super(message, category, code, originalError, false);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class DatabaseValidationError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.name = 'DatabaseValidationError';
    Object.setPrototypeOf(this, DatabaseValidationError.prototype);
  }
}

export class DatabaseNotFoundError extends DatabaseError {
  constructor(message: string, public readonly resourceId?: string) {
    super(message, 'NOT_FOUND');
    this.name = 'DatabaseNotFoundError';
    Object.setPrototypeOf(this, DatabaseNotFoundError.prototype);
  }
}

export class DatabaseStorageError extends DatabaseError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'STORAGE_ERROR', originalError);
    this.name = 'DatabaseStorageError';
    Object.setPrototypeOf(this, DatabaseStorageError.prototype);
  }
}

















































