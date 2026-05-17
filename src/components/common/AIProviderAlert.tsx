import React from 'react';
import { AlertTriangle, Wifi, Settings, RefreshCw, X } from 'lucide-react';
import { ErrorInfo } from '../../types/errors';

interface AIProviderAlertProps {
  error: ErrorInfo | null;
  isFallbackAvailable: boolean;
  isCheckingFallback: boolean;
  onSwitchToLocal: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

export const AIProviderAlert: React.FC<AIProviderAlertProps> = ({
  error,
  isFallbackAvailable,
  isCheckingFallback,
  onSwitchToLocal,
  onRetry,
  onDismiss,
  onOpenSettings,
}) => {
  if (!error) return null;

  const isApiKeyError =
    error.category === 'api_key_missing' || error.category === 'api_key_invalid';

  return (
    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 font-['Noto_Sans_JP']">
              {error.title}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP'] mt-0.5">
              {error.message}
            </p>
            {error.solution && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP'] mt-1">
                {error.solution}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {isFallbackAvailable && (
                <button
                  type="button"
                  onClick={onSwitchToLocal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors font-['Noto_Sans_JP']"
                >
                  <Wifi className="h-3.5 w-3.5" />
                  ローカルLLMに切り替える
                </button>
              )}
              {isCheckingFallback && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ローカルLLMを確認中…
                </span>
              )}
              {error.retryable && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  再試行
                </button>
              )}
              {isApiKeyError && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP']"
                >
                  <Settings className="h-3.5 w-3.5" />
                  設定を開く
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors rounded"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
