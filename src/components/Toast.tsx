import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
  details?: string;
  action?: ToastAction;
  persistent?: boolean; // 自動的に消えない
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, options?: Partial<Toast>) => void;
  showError: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showSuccess: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showInfo: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showWarning: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showErrorWithDetails: (title: string, message: string, details?: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000, options?: Partial<Toast>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { 
      id, 
      message, 
      type, 
      duration: options?.persistent ? 0 : (options?.duration ?? duration),
      title: options?.title,
      details: options?.details,
      action: options?.action,
      persistent: options?.persistent,
    };
    
    setToasts(prev => [...prev, newToast]);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, newToast.duration);
    }
  }, []);

  const showError = useCallback((message: string, duration?: number, options?: Partial<Toast>) => {
    showToast(message, 'error', duration ?? 7000, options);
  }, [showToast]);

  const showSuccess = useCallback((message: string, duration?: number, options?: Partial<Toast>) => {
    showToast(message, 'success', duration ?? 5000, options);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number, options?: Partial<Toast>) => {
    showToast(message, 'info', duration ?? 5000, options);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number, options?: Partial<Toast>) => {
    showToast(message, 'warning', duration ?? 6000, options);
  }, [showToast]);

  const showErrorWithDetails = useCallback((title: string, message: string, details?: string, action?: ToastAction) => {
    showToast(message, 'error', 0, {
      title,
      details,
      action,
      persistent: !action, // アクションがない場合は永続表示
    });
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo, showWarning, showErrorWithDetails }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-[100] space-y-2 max-w-md w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  useEffect(() => {
    if (toast.duration && toast.duration > 0 && !toast.persistent) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.persistent]);

  const iconMap = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  };

  const bgColorMap = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  };

  const textColorMap = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    info: 'text-blue-800 dark:text-blue-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
  };

  return (
    <div
      className={`
        ${bgColorMap[toast.type]} 
        ${textColorMap[toast.type]}
        border rounded-lg shadow-lg p-4 pointer-events-auto
        transition-all duration-300 ease-in-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        animate-slide-in
        max-w-md
      `}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {iconMap[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-sm font-semibold mb-1 font-['Noto_Sans_JP']">
              {toast.title}
            </h4>
          )}
          <p className="text-sm font-medium font-['Noto_Sans_JP'] break-words">
            {toast.message}
          </p>
          {toast.details && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs underline hover:no-underline font-['Noto_Sans_JP']"
              >
                {showDetails ? '詳細を隠す' : '詳細を表示'}
              </button>
              {showDetails && (
                <div className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded text-xs font-['Noto_Sans_JP'] whitespace-pre-wrap">
                  {toast.details}
                </div>
              )}
            </div>
          )}
          {toast.action && (
            <div className="mt-3">
              <button
                onClick={() => {
                  toast.action!.onClick();
                  if (!toast.persistent) {
                    handleRemove();
                  }
                }}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-semibold transition-colors font-['Noto_Sans_JP']
                  ${toast.action.variant === 'primary' 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2"
          aria-label="通知を閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

