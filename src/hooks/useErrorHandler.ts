import { useCallback } from 'react';
import { useToast } from '../components/Toast';
import { getUserFriendlyError } from '../utils/errorHandler';
import { AppError, APIError, DatabaseError } from '../types/errors';

/**
 * エラーハンドリング用のカスタムフック
 * コンポーネントで統一されたエラーハンドリングを提供
 */
export const useErrorHandler = () => {
  const { showError, showErrorWithDetails } = useToast();

  /**
   * エラーを処理してユーザーに通知
   * @param error エラーオブジェクト
   * @param context エラーのコンテキスト（オプション）
   * @param options 追加オプション
   */
  const handleError = useCallback((
    error: unknown,
    context?: string,
    options?: {
      title?: string;
      duration?: number;
      showDetails?: boolean;
      onRetry?: () => void;
    }
  ) => {
    // エラーログを記録（非同期で実行、エラーが発生しても処理を継続）
    import('../utils/errorLogger').then(({ logError, logAPIError, logDatabaseError }) => {
      if (error instanceof APIError) {
        logAPIError(error, {});
      } else if (error instanceof DatabaseError) {
        logDatabaseError(error, {});
      } else {
        logError(error, {
          category: context || 'general',
        });
      }
    }).catch(() => {
      // ログ記録に失敗した場合は、最低限のログを記録
      console.error(context ? `${context}:` : 'Error:', error);
    });

    // エラー情報を取得
    const errorInfo = getUserFriendlyError(error);

    // タイトルを構築
    const title = options?.title || errorInfo.title || 'エラーが発生しました';

    // 詳細情報を構築
    const details = errorInfo.details 
      ? `${errorInfo.details}\n\n${errorInfo.solution}`
      : errorInfo.solution;

    // エラーメッセージを構築
    const message = context 
      ? `${context}: ${errorInfo.message}`
      : errorInfo.message;

    // 再試行可能なエラーの場合はアクションを追加
    const action = errorInfo.retryable && options?.onRetry
      ? {
          label: '再試行',
          onClick: options.onRetry,
          variant: 'primary' as const,
        }
      : undefined;

    // エラーを表示
    if (options?.showDetails || details) {
      showErrorWithDetails(title, message, details, action);
    } else {
      showError(message, options?.duration, {
        title,
        action,
      });
    }
  }, [showError, showErrorWithDetails]);

  /**
   * APIエラーを処理
   */
  const handleAPIError = useCallback((
    error: unknown,
    context?: string,
    options?: {
      title?: string;
      duration?: number;
      showDetails?: boolean;
      onRetry?: () => void;
    }
  ) => {
    if (error instanceof APIError) {
      handleError(error, context, {
        ...options,
        showDetails: true,
      });
    } else {
      handleError(error, context, options);
    }
  }, [handleError]);

  /**
   * データベースエラーを処理
   */
  const handleDatabaseError = useCallback((
    error: unknown,
    context?: string,
    options?: {
      title?: string;
      duration?: number;
    }
  ) => {
    if (error instanceof DatabaseError) {
      handleError(error, context, {
        ...options,
        showDetails: true,
      });
    } else {
      handleError(error, context, options);
    }
  }, [handleError]);

  /**
   * エラーを処理して、エラーメッセージを返す（UIに表示しない場合）
   */
  const getErrorMessage = useCallback((error: unknown, context?: string): string => {
    const errorInfo = getUserFriendlyError(error);
    return context 
      ? `${context}: ${errorInfo.message}`
      : errorInfo.message;
  }, []);

  /**
   * エラーが再試行可能かどうかを判定
   */
  const isRetryable = useCallback((error: unknown): boolean => {
    if (error instanceof AppError) {
      return error.retryable;
    }
    const errorInfo = getUserFriendlyError(error);
    return errorInfo.retryable;
  }, []);

  return {
    handleError,
    handleAPIError,
    handleDatabaseError,
    getErrorMessage,
    isRetryable,
  };
};

