/**
 * 遅延読み込みコンポーネント
 * 必要になった時点でコンポーネントを読み込むことで初期バンドルサイズを削減
 */

import React, { Suspense, lazy } from 'react';

// 画像ボードの遅延読み込み版
const LazyImageBoardComponent = lazy(() => 
  import('./ImageBoard').then(module => ({ default: module.ImageBoard }))
);

export const LazyImageBoard: React.FC<{ isOpen: boolean; onClose: () => void; fallback?: React.ReactNode }> = ({ 
  isOpen, 
  onClose, 
  fallback 
}) => (
  <Suspense fallback={fallback || (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">画像ボードを読み込み中...</p>
      </div>
    </div>
  )}>
    <LazyImageBoardComponent isOpen={isOpen} onClose={onClose} />
  </Suspense>
);

// データ管理の遅延読み込み版
const LazyDataManagerComponent = lazy(() => 
  import('./DataManager').then(module => ({ default: module.DataManager }))
);

export const LazyDataManager: React.FC<{ isOpen: boolean; onClose: () => void; fallback?: React.ReactNode }> = ({ 
  isOpen, 
  onClose, 
  fallback 
}) => (
  <Suspense fallback={fallback || (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">データ管理を読み込み中...</p>
      </div>
    </div>
  )}>
    <LazyDataManagerComponent isOpen={isOpen} onClose={onClose} />
  </Suspense>
);

// AI設定の遅延読み込み版
const LazyAISettingsComponent = lazy(() => 
  import('./AISettings').then(module => ({ default: module.AISettings }))
);

export const LazyAISettings: React.FC<{ isOpen: boolean; onClose: () => void; fallback?: React.ReactNode }> = ({ 
  isOpen, 
  onClose, 
  fallback 
}) => (
  <Suspense fallback={fallback || (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">AI設定を読み込み中...</p>
      </div>
    </div>
  )}>
    <LazyAISettingsComponent isOpen={isOpen} onClose={onClose} />
  </Suspense>
);
