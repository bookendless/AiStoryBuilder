/**
 * メモリリーク防止用のカスタムフック
 * Phase 1: メモリリークの修正とクリーンアップ強化
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

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

/**
 * タイマー管理用フック
 * setInterval/setTimeoutの適切なクリーンアップを保証
 */
export const useTimer = () => {
  const timersRef = useRef<Set<number>>(new Set());

  const setTimer = useCallback((callback: () => void, delay: number): number => {
    const timerId = window.setTimeout(() => {
      timersRef.current.delete(timerId);
      callback();
    }, delay);
    
    timersRef.current.add(timerId);
    return timerId;
  }, []);

  const setInterval = useCallback((callback: () => void, delay: number): number => {
    const timerId = window.setInterval(callback, delay);
    timersRef.current.add(timerId);
    return timerId;
  }, []);

  const clearTimer = useCallback((timerId: number) => {
    window.clearTimeout(timerId);
    window.clearInterval(timerId);
    timersRef.current.delete(timerId);
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timerId => {
      window.clearTimeout(timerId);
      window.clearInterval(timerId);
    });
    timersRef.current.clear();
  }, []);

  // コンポーネントのアンマウント時にすべてのタイマーをクリア
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    setTimer,
    setInterval,
    clearTimer,
    clearAllTimers
  };
};

