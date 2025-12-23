import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { getUserFriendlyError } from '../../utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundaryコンポーネント
 * 予期しないエラーをキャッチして、ユーザーに適切なエラーメッセージを表示
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーログを記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 構造化ログを記録
    import('../../utils/errorLogger').then(({ logError }) => {
      logError(error, {
        category: 'react_error_boundary',
        context: {
          componentStack: errorInfo.componentStack,
          errorName: error.name,
          errorMessage: error.message,
        },
      });
    }).catch(() => {
      // ログ記録に失敗した場合は、最低限のログを記録
      console.error('Failed to log error to errorLogger');
    });
    
    this.setState({
      error,
      errorInfo,
    });

    // カスタムエラーハンドラーが指定されている場合は呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // ホームページに遷移（必要に応じて実装）
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックが指定されている場合はそれを使用
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUI
      const error = this.state.error;
      const errorInfo = getUserFriendlyError(error || new Error('不明なエラー'));

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-shrink-0">
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {errorInfo.title}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  予期しないエラーが発生しました
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {errorInfo.message}
              </p>

              {errorInfo.details && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    詳細情報
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {errorInfo.details}
                  </p>
                </div>
              )}

              {errorInfo.solution && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    対処方法
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {errorInfo.solution}
                  </p>
                </div>
              )}
            </div>

            {/* 開発環境ではエラー詳細を表示 */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  開発者向け情報（クリックで展開）
                </summary>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto max-h-64 text-xs font-mono">
                  <div className="mb-2">
                    <strong>エラーメッセージ:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
                  </div>
                  {this.state.error.stack && (
                    <div className="mb-2">
                      <strong>スタックトレース:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.error.stack}</pre>
                    </div>
                  )}
                  {this.state.errorInfo && (
                    <div>
                      <strong>コンポーネントスタック:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-wrap gap-3">
              {errorInfo.retryable && (
                <button
                  onClick={this.handleReset}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>再試行</span>
                </button>
              )}
              <button
                onClick={this.handleReload}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>ページを再読み込み</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>ホームに戻る</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

