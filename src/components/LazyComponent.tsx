/**
 * 遅延読み込みコンポーネント
 * 必要になった時点でコンポーネントを読み込むことで初期バンドルサイズを削減
 */

import React, { Suspense, lazy, ComponentType } from 'react';

interface LazyComponentProps {
  fallback?: React.ReactNode;
  [key: string]: unknown;
}

// ローディングフォールバック
const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

// 遅延読み込み用のHOC
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);
  
  return function WrappedLazyComponent(props: React.ComponentProps<T> & LazyComponentProps) {
    const { fallback: propFallback, ...restProps } = props;
    
    return (
      <Suspense fallback={propFallback || fallback || <DefaultFallback />}>
        <LazyComponent {...(restProps as React.ComponentProps<T>)} />
      </Suspense>
    );
  };
}

// よく使用されるコンポーネントの遅延読み込み版
export const LazyImageBoard = createLazyComponent(
  () => import('./ImageBoard'),
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
      <p className="text-sm text-gray-600">画像ボードを読み込み中...</p>
    </div>
  </div>
);

export const LazyDataManager = createLazyComponent(
  () => import('./DataManager'),
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
      <p className="text-sm text-gray-600">データ管理を読み込み中...</p>
    </div>
  </div>
);

export const LazyAISettings = createLazyComponent(
  () => import('./AISettings'),
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
      <p className="text-sm text-gray-600">AI設定を読み込み中...</p>
    </div>
  </div>
);
