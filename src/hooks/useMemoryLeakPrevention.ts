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

/**
 * イベントリスナー管理用フック
 * イベントリスナーの適切なクリーンアップを保証
 */
export const useEventListener = () => {
  const listenersRef = useRef<Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  }>>([]);

  const addEventListener = useCallback((
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    element.addEventListener(event, handler, options);
    listenersRef.current.push({ element, event, handler, options });
  }, []);

  const removeEventListener = useCallback((
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    element.removeEventListener(event, handler, options);
    listenersRef.current = listenersRef.current.filter(
      listener => !(
        listener.element === element &&
        listener.event === event &&
        listener.handler === handler
      )
    );
  }, []);

  const removeAllListeners = useCallback(() => {
    listenersRef.current.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    listenersRef.current = [];
  }, []);

  // コンポーネントのアンマウント時にすべてのイベントリスナーを削除
  useEffect(() => {
    return () => {
      removeAllListeners();
    };
  }, [removeAllListeners]);

  return {
    addEventListener,
    removeEventListener,
    removeAllListeners
  };
};

/**
 * アニメーションフレーム管理用フック
 * requestAnimationFrameの適切なクリーンアップを保証
 */
export const useAnimationFrame = () => {
  const animationFramesRef = useRef<Set<number>>(new Set());

  const requestAnimationFrame = useCallback((callback: FrameRequestCallback): number => {
    const frameId = window.requestAnimationFrame(callback);
    animationFramesRef.current.add(frameId);
    return frameId;
  }, []);

  const cancelAnimationFrame = useCallback((frameId: number) => {
    window.cancelAnimationFrame(frameId);
    animationFramesRef.current.delete(frameId);
  }, []);

  const cancelAllAnimationFrames = useCallback(() => {
    animationFramesRef.current.forEach(frameId => {
      window.cancelAnimationFrame(frameId);
    });
    animationFramesRef.current.clear();
  }, []);

  // コンポーネントのアンマウント時にすべてのアニメーションフレームをキャンセル
  useEffect(() => {
    return () => {
      cancelAllAnimationFrames();
    };
  }, [cancelAllAnimationFrames]);

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    cancelAllAnimationFrames
  };
};

/**
 * オブザーバー管理用フック
 * IntersectionObserver、MutationObserver等の適切なクリーンアップを保証
 */
export const useObserver = () => {
  const observersRef = useRef<Set<{ disconnect: () => void }>>(new Set());

  const addObserver = useCallback((observer: { disconnect: () => void }) => {
    observersRef.current.add(observer);
  }, []);

  const removeObserver = useCallback((observer: { disconnect: () => void }) => {
    observer.disconnect();
    observersRef.current.delete(observer);
  }, []);

  const removeAllObservers = useCallback(() => {
    observersRef.current.forEach(observer => {
      observer.disconnect();
    });
    observersRef.current.clear();
  }, []);

  // コンポーネントのアンマウント時にすべてのオブザーバーを切断
  useEffect(() => {
    return () => {
      removeAllObservers();
    };
  }, [removeAllObservers]);

  return {
    addObserver,
    removeObserver,
    removeAllObservers
  };
};

/**
 * メモリ使用量監視用フック
 * メモリリークの早期発見と警告
 */
export const useMemoryMonitor = (threshold: number = 80) => {
  const [memoryUsage, setMemoryUsage] = useState({
    used: 0,
    total: 0,
    percentage: 0
  });

  const [isHighMemory, setIsHighMemory] = useState(false);

  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      if (memory) {
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const percentage = (used / total) * 100;

        setMemoryUsage({ used, total, percentage });
        setIsHighMemory(percentage > threshold);

        if (percentage > threshold) {
          console.warn(`メモリ使用量が高いです: ${percentage.toFixed(2)}%`);
        }
      }
    }
  }, [threshold]);

  const { setInterval, clearAllTimers } = useTimer();

  useEffect(() => {
    // 5秒ごとにメモリ使用量をチェック
    setInterval(checkMemoryUsage, 5000);
    
    return () => {
      clearAllTimers();
    };
  }, [checkMemoryUsage, setInterval, clearAllTimers]);

  return {
    memoryUsage,
    isHighMemory,
    checkMemoryUsage
  };
};

/**
 * リソース管理用フック
 * 複数のリソースを統合管理
 */
export const useResourceManager = () => {
  const { setTimer, setInterval, clearAllTimers } = useTimer();
  const { addEventListener, removeAllListeners } = useEventListener();
  const { requestAnimationFrame, cancelAllAnimationFrames } = useAnimationFrame();
  const { addObserver, removeAllObservers } = useObserver();

  const cleanup = useCallback(() => {
    clearAllTimers();
    removeAllListeners();
    cancelAllAnimationFrames();
    removeAllObservers();
  }, [clearAllTimers, removeAllListeners, cancelAllAnimationFrames, removeAllObservers]);

  // コンポーネントのアンマウント時にすべてのリソースをクリーンアップ
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    setTimer,
    setInterval,
    addEventListener,
    requestAnimationFrame,
    addObserver,
    cleanup
  };
};

/**
 * デバウンス付きの値更新フック
 * メモリリークを防ぎながらデバウンス機能を提供
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const { setTimer, clearTimer } = useTimer();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimer(timeoutRef.current);
    }

    timeoutRef.current = setTimer(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimer(timeoutRef.current);
      }
    };
  }, [value, delay, setTimer, clearTimer]);

  return debouncedValue;
};

/**
 * スロットル付きのコールバックフック
 * メモリリークを防ぎながらスロットル機能を提供
 */
export const useThrottledCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const { setTimer, clearTimer } = useTimer();

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimer(timeoutRef.current);
      }
      
      timeoutRef.current = setTimer(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  }, [callback, delay, setTimer, clearTimer]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimer(timeoutRef.current);
      }
    };
  }, [clearTimer]);

  return throttledCallback as T;
};
