import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface InlineAIFeedbackProps {
  message: string; // 必須: 表示メッセージ
  variant?: 'minimal' | 'with-progress'; // プログレスバーの有無
  className?: string; // 追加のスタイル
}

/**
 * 統一されたインラインAI生成フィードバックコンポーネント
 * フィールド内に配置可能な軽量な表示コンポーネント
 */
export const InlineAIFeedback: React.FC<InlineAIFeedbackProps> = ({
  message,
  variant = 'with-progress',
  className = '',
}) => {
  return (
    <div
      className={`mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-all duration-300 ${className}`}
    >
      <div className="flex items-center space-x-2">
        {/* アイコンの組み合わせ: Sparkles（パルス）+ Loader2（スピン） */}
        <div className="relative flex items-center justify-center flex-shrink-0 w-4 h-4">
          <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400 animate-pulse absolute inset-0" />
          <Loader2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
        </div>
        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']">
          {message}
        </span>
      </div>
      {/* プログレスバー（variantが'with-progress'の場合のみ表示） */}
      {variant === 'with-progress' && (
        <div className="mt-2 w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-2 overflow-hidden relative">
          {/* ベースのプログレスバー */}
          <div className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full w-full" />
          {/* 動くシマー効果 */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full progress-shimmer"
            style={{ width: '50%' }}
          />
        </div>
      )}
    </div>
  );
};

