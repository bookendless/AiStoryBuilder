import React from 'react';
import { Sparkles, X } from 'lucide-react';
import type { AIStatusTone } from './types';
import { AI_STATUS_STYLES } from './constants';

interface AIStatusBarProps {
  visible: boolean;
  title: string;
  detail?: string;
  tone?: AIStatusTone;
  canCancel?: boolean;
  onCancel?: () => void;
}

export const AIStatusBar: React.FC<AIStatusBarProps> = ({
  visible,
  title,
  detail,
  tone,
  canCancel,
  onCancel,
}) => {
  if (!visible || !tone) return null;

  const styles = AI_STATUS_STYLES[tone];

  return (
    <div className={`${styles.container} border-b border-gray-200 dark:border-gray-700`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`${styles.icon} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
              <Sparkles className="h-4 w-4 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${styles.title} font-['Noto_Sans_JP']`}>
                {title}
              </p>
              {detail && (
                <p className={`mt-0.5 text-xs leading-relaxed ${styles.detail} font-['Noto_Sans_JP']`}>
                  {detail}
                </p>
              )}
            </div>
          </div>
          {canCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-current hover:bg-opacity-10 transition-colors text-sm font-['Noto_Sans_JP'] flex-shrink-0"
              aria-label="生成をキャンセル"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">キャンセル</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

