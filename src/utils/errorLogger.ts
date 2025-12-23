/**
 * エラーログの構造化と記録
 */

import { AppError, APIError, DatabaseError } from '../types/errors';

export interface ErrorLogEntry {
  timestamp: Date;
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  errorType: string;
  stack?: string;
  context?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
  userId?: string;
}

/**
 * エラーログを記録
 */
export const logError = (
  error: unknown,
  context?: {
    category?: string;
    context?: Record<string, unknown>;
    userId?: string;
  }
): void => {
  try {
    const errorInfo = error instanceof AppError
      ? error.toErrorInfo()
      : {
          category: 'unknown' as const,
          title: 'エラーが発生しました',
          message: error instanceof Error ? error.message : String(error),
          solution: 'エラーの詳細を確認してください',
          retryable: false,
        };

    const logEntry: ErrorLogEntry = {
      timestamp: new Date(),
      level: 'error',
      category: context?.category || errorInfo.category,
      message: errorInfo.message,
      errorType: error instanceof AppError
        ? error.constructor.name
        : error instanceof Error
        ? error.constructor.name
        : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      context: context?.context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userId: context?.userId,
    };

    // コンソールに記録（開発環境では詳細に、本番環境では簡潔に）
    if (import.meta.env.DEV) {
      console.error('Error Log:', logEntry);
    } else {
      // 本番環境では機密情報を除外
      console.error('Error:', {
        category: logEntry.category,
        message: logEntry.message,
        errorType: logEntry.errorType,
        timestamp: logEntry.timestamp.toISOString(),
      });
    }

    // 将来的に外部ログサービス（Sentry等）に送信する場合はここに追加
    // if (import.meta.env.PROD) {
    //   sendToErrorTrackingService(logEntry);
    // }
  } catch (logError) {
    // ログ記録自体が失敗した場合は、最低限の情報を記録
    console.error('Failed to log error:', logError);
    console.error('Original error:', error);
  }
};

/**
 * APIエラーを記録
 */
export const logAPIError = (
  error: APIError,
  context?: {
    endpoint?: string;
    method?: string;
    requestId?: string;
    userId?: string;
  }
): void => {
  logError(error, {
    category: 'api',
    context: {
      endpoint: context?.endpoint,
      method: context?.method,
      requestId: context?.requestId,
      statusCode: error.code,
      category: error.category,
    },
    userId: context?.userId,
  });
};

/**
 * データベースエラーを記録
 */
export const logDatabaseError = (
  error: DatabaseError,
  context?: {
    operation?: string;
    table?: string;
    userId?: string;
  }
): void => {
  logError(error, {
    category: 'database',
    context: {
      operation: context?.operation,
      table: context?.table,
      code: error.code,
      category: error.category,
    },
    userId: context?.userId,
  });
};

/**
 * 警告を記録
 */
export const logWarning = (
  message: string,
  context?: {
    category?: string;
    context?: Record<string, unknown>;
  }
): void => {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date(),
    level: 'warning',
    category: context?.category || 'general',
    message,
    errorType: 'Warning',
    context: context?.context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  if (import.meta.env.DEV) {
    console.warn('Warning Log:', logEntry);
  } else {
    console.warn('Warning:', {
      category: logEntry.category,
      message: logEntry.message,
      timestamp: logEntry.timestamp.toISOString(),
    });
  }
};

/**
 * 情報ログを記録
 */
export const logInfo = (
  message: string,
  context?: {
    category?: string;
    context?: Record<string, unknown>;
  }
): void => {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date(),
    level: 'info',
    category: context?.category || 'general',
    message,
    errorType: 'Info',
    context: context?.context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  if (import.meta.env.DEV) {
    console.info('Info Log:', logEntry);
  } else {
    console.info('Info:', {
      category: logEntry.category,
      message: logEntry.message,
      timestamp: logEntry.timestamp.toISOString(),
    });
  }
};

