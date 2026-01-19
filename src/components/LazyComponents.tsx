/**
 * 遅延読み込みコンポーネント定義
 * 
 * 大きなコンポーネントを遅延読み込みすることで、
 * 初期ロード時間とメモリ使用量を削減します。
 */

import React, { Suspense, ComponentType } from 'react';

// ステップコンポーネントの遅延読み込み
export const LazyCharacterStep = React.lazy(() => import('./steps/CharacterStep').then(m => ({ default: m.CharacterStep })));
export const LazyPlotStep1 = React.lazy(() => import('./steps/PlotStep1').then(m => ({ default: m.PlotStep1 })));
export const LazyPlotStep2 = React.lazy(() => import('./steps/PlotStep2').then(m => ({ default: m.PlotStep2 })));
export const LazySynopsisStep = React.lazy(() => import('./steps/SynopsisStep').then(m => ({ default: m.SynopsisStep })));
export const LazyChapterStep = React.lazy(() => import('./steps/ChapterStep').then(m => ({ default: m.ChapterStep })));
export const LazyDraftStep = React.lazy(() => import('./steps/DraftStep').then(m => ({ default: m.DraftStep })));
export const LazyReviewStep = React.lazy(() => import('./steps/ReviewStep').then(m => ({ default: m.ReviewStep })));
export const LazyExportStep = React.lazy(() => import('./steps/ExportStep').then(m => ({ default: m.ExportStep })));

// ローディングスピナーコンポーネント
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

// Suspenseラッパー付きコンポーネント生成
interface WithSuspenseOptions {
  stepName?: string;
}

/**
 * コンポーネントをSuspenseでラップするHOC
 */
export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  options: WithSuspenseOptions = {}
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <Suspense fallback={<StepLoadingSpinner stepName={options.stepName} />}>
      <Component {...props} />
    </Suspense>
  );

  WrappedComponent.displayName = `withSuspense(${Component.displayName || Component.name || 'Component'})`;
  
  return WrappedComponent;
}

// Suspenseラッパー付きステップコンポーネント
export const CharacterStepWithSuspense = withSuspense(LazyCharacterStep, { stepName: 'キャラクター設定' });
export const PlotStep1WithSuspense = withSuspense(LazyPlotStep1, { stepName: 'プロット（基本設定）' });
export const PlotStep2WithSuspense = withSuspense(LazyPlotStep2, { stepName: 'プロット（構成）' });
export const SynopsisStepWithSuspense = withSuspense(LazySynopsisStep, { stepName: 'あらすじ' });
export const ChapterStepWithSuspense = withSuspense(LazyChapterStep, { stepName: '章構成' });
export const DraftStepWithSuspense = withSuspense(LazyDraftStep, { stepName: '執筆' });
export const ReviewStepWithSuspense = withSuspense(LazyReviewStep, { stepName: 'レビュー' });
export const ExportStepWithSuspense = withSuspense(LazyExportStep, { stepName: 'エクスポート' });
