/**
 * メモリリーク防止用のカスタムフック
 * Phase 1: メモリリークの修正とクリーンアップ強化
 */

import React, { useEffect, useRef } from 'react';

/**
 * 安全なuseEffectフック
 * コンポーネントのアンマウント時に確実にクリーンアップを実行
 */
export const useSafeEffect = (
  effect: () => void | (() => void),
  deps: React.DependencyList
) => {
  const cleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // 前回のクリーンアップを実行
    cleanupRef.current?.();

    // 新しいエフェクトを実行
    const cleanup = effect();
    cleanupRef.current = cleanup || null;

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // コンポーネントのマウント状態を管理
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef.current;
};
