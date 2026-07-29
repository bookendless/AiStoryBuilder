/**
 * 遅延読み込みコンポーネント定義
 * 
 * 大きなコンポーネントを遅延読み込みすることで、
 * 初期ロード時間とメモリ使用量を削減します。
 */

import React from 'react';
import { withSuspense } from './withSuspense';

// ステップコンポーネントの遅延読み込み
export const LazyCharacterStep = React.lazy(() => import('./steps/CharacterStep').then(m => ({ default: m.CharacterStep })));
export const LazyPlotStep1 = React.lazy(() => import('./steps/PlotStep1').then(m => ({ default: m.PlotStep1 })));
export const LazyPlotStep2 = React.lazy(() => import('./steps/PlotStep2').then(m => ({ default: m.PlotStep2 })));
export const LazySynopsisStep = React.lazy(() => import('./steps/SynopsisStep').then(m => ({ default: m.SynopsisStep })));
export const LazyChapterStep = React.lazy(() => import('./steps/ChapterStep').then(m => ({ default: m.ChapterStep })));
export const LazyDraftStep = React.lazy(() => import('./steps/DraftStep').then(m => ({ default: m.DraftStep })));
export const LazyReviewStep = React.lazy(() => import('./steps/ReviewStep').then(m => ({ default: m.ReviewStep })));
export const LazyExportStep = React.lazy(() => import('./steps/ExportStep').then(m => ({ default: m.ExportStep })));

// Suspenseラッパー付きステップコンポーネント
export const CharacterStepWithSuspense = withSuspense(LazyCharacterStep, { stepName: 'キャラクター設定' });
export const PlotStep1WithSuspense = withSuspense(LazyPlotStep1, { stepName: 'プロット（基本設定）' });
export const PlotStep2WithSuspense = withSuspense(LazyPlotStep2, { stepName: 'プロット（構成）' });
export const SynopsisStepWithSuspense = withSuspense(LazySynopsisStep, { stepName: 'あらすじ' });
export const ChapterStepWithSuspense = withSuspense(LazyChapterStep, { stepName: '章構成' });
export const DraftStepWithSuspense = withSuspense(LazyDraftStep, { stepName: '執筆' });
export const ReviewStepWithSuspense = withSuspense(LazyReviewStep, { stepName: 'レビュー' });
export const ExportStepWithSuspense = withSuspense(LazyExportStep, { stepName: 'エクスポート' });
