import React from 'react';
import { HelpCircle, AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  tooltip?: string;
}

/**
 * 統一されたフォームフィールドコンポーネント
 * 必須項目の表示、ヘルプテキスト、エラー表示を統合
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  helpText,
  error,
  children,
  className = '',
  id,
  tooltip,
}) => {
  const fieldId = id || `field-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ラベルと必須バッジ */}
      <div className="flex items-center space-x-2">
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-sumi-700 dark:text-usuzumi-300 font-['Noto_Sans_JP'] flex items-center space-x-2"
        >
          <span>{label}</span>
          {required && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sakura-100 dark:bg-sakura-900/30 text-sakura-700 dark:text-sakura-400 border border-sakura-300 dark:border-sakura-700"
              aria-label="必須項目"
            >
              必須
            </span>
          )}
          {!required && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-usuzumi-100 dark:bg-usuzumi-800 text-usuzumi-600 dark:text-usuzumi-400"
              aria-label="任意項目"
            >
              任意
            </span>
          )}
        </label>
        {tooltip && (
          <div className="group relative">
            <HelpCircle className="h-4 w-4 text-usuzumi-400 dark:text-usuzumi-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
              <div className="bg-sumi-800 dark:bg-sumi-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs font-['Noto_Sans_JP'] whitespace-normal">
                {tooltip}
                <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-sumi-800 dark:border-t-sumi-700"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 入力要素 */}
      <div className={required && !error ? 'bg-sakura-50/50 dark:bg-sakura-900/10 rounded-lg p-1' : ''}>
        {React.isValidElement(children) && React.cloneElement(children as React.ReactElement<any>, { id: fieldId })}
        {!React.isValidElement(children) && <div id={fieldId}>{children}</div>}
      </div>

      {/* ヘルプテキスト */}
      {helpText && !error && (
        <p className="text-xs text-usuzumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] flex items-start space-x-1">
          <HelpCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{helpText}</span>
        </p>
      )}

      {/* エラーメッセージ */}
      {error && (
        <div className="flex items-start space-x-1 text-xs text-semantic-error font-['Noto_Sans_JP']">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

