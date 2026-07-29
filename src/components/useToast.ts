import { createContext, useContext } from 'react';

/**
 * ToastContext の型定義・Contextオブジェクト・参照フック
 *
 * Provider/表示コンポーネント（Toast.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

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

export interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number, options?: Partial<Toast>) => void;
  showError: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showSuccess: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showInfo: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showWarning: (message: string, duration?: number, options?: Partial<Toast>) => void;
  showErrorWithDetails: (title: string, message: string, details?: string, action?: ToastAction) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
