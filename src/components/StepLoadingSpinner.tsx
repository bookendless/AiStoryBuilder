/**
 * ステップ遅延読み込み時のローディングスピナー
 *
 * withSuspense と LazyComponents の双方から参照するため独立ファイルに切り出している
 * （相互importを避け、Fast Refresh を有効に保つ）。
 */

import React from 'react';

interface StepLoadingSpinnerProps {
  stepName?: string;
}

export const StepLoadingSpinner: React.FC<StepLoadingSpinnerProps> = ({ stepName }) => (
  <div
    className="flex flex-col items-center justify-center min-h-[400px] p-8"
    role="status"
    aria-live="polite"
    aria-label={stepName ? `${stepName}を読み込み中` : 'コンテンツを読み込み中'}
  >
    <div className="relative">
      {/* 外側の円 */}
      <div className="w-16 h-16 border-4 border-ai-200 dark:border-ai-800 rounded-full"></div>
      {/* 回転する円 */}
      <div className="w-16 h-16 border-4 border-transparent border-t-ai-500 rounded-full animate-spin absolute top-0 left-0"></div>
    </div>
    <p className="mt-4 text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP'] text-sm">
      {stepName ? `${stepName}を読み込んでいます...` : '読み込み中...'}
    </p>
    <p className="mt-2 text-sumi-400 dark:text-usuzumi-500 text-xs">
      しばらくお待ちください
    </p>
  </div>
);
