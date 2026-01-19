/**
 * キャンセル可能なリクエストフック
 * 
 * コンポーネントのアンマウント時やキャンセルボタン押下時に
 * 進行中のリクエストを安全に中断できます。
 */

import { useCallback, useRef, useEffect } from 'react';
import { withRetry, RetryOptions } from '../utils/networkRetryUtils';

// リクエスト状態
export interface RequestState<T> {
    data: T | null;
    error: Error | null;
    isLoading: boolean;
    isAborted: boolean;
}

// フックの戻り値
export interface UseAbortableRequestReturn<T> {
    /** リクエストを実行（自動リトライ付き） */
    execute: (fn: () => Promise<T>, options?: RetryOptions) => Promise<T>;
    /** 進行中のリクエストをキャンセル */
    abort: () => void;
    /** リクエストがアクティブかどうか */
    isActive: boolean;
    /** 新しいAbortControllerを取得 */
    getSignal: () => AbortSignal;
}

/**
 * キャンセル可能なリクエストフック
 * 
 * 使用例:
 * ```tsx
 * const { execute, abort, isActive, getSignal } = useAbortableRequest();
 * 
 * // AI生成リクエスト
 * const handleGenerate = async () => {
 *   try {
 *     const result = await execute(
 *       () => fetch('/api/generate', { signal: getSignal() }),
 *       { maxRetries: 3 }
 *     );
 *     setContent(result);
 *   } catch (error) {
 *     if (error.name === 'AbortError') {
 *       console.log('リクエストがキャンセルされました');
 *     }
 *   }
 * };
 * 
 * // キャンセルボタン
 * <button onClick={abort} disabled={!isActive}>キャンセル</button>
 * ```
 */
export function useAbortableRequest<T = unknown>(): UseAbortableRequestReturn<T> {
    const abortControllerRef = useRef<AbortController | null>(null);
    const isActiveRef = useRef(false);

    // コンポーネントのアンマウント時に自動キャンセル
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    // 現在のAbortSignalを取得（なければ新規作成）
    const getSignal = useCallback((): AbortSignal => {
        if (!abortControllerRef.current) {
            abortControllerRef.current = new AbortController();
        }
        return abortControllerRef.current.signal;
    }, []);

    // リクエストをキャンセル
    const abort = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[useAbortableRequest] リクエストをキャンセル');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            isActiveRef.current = false;
        }
    }, []);

    // リクエストを実行
    const execute = useCallback(
        async (fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
            // 前のリクエストをキャンセル
            abort();

            // 新しいAbortControllerを作成
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;
            isActiveRef.current = true;

            try {
                const result = await withRetry(fn, {
                    ...options,
                    signal,
                });
                isActiveRef.current = false;
                return result;
            } catch (error) {
                isActiveRef.current = false;
                throw error;
            }
        },
        [abort]
    );

    return {
        execute,
        abort,
        isActive: isActiveRef.current,
        getSignal,
    };
}

/**
 * 複数のリクエストを管理するフック
 */
export function useAbortableRequests(): {
    createController: (id: string) => AbortController;
    abortOne: (id: string) => void;
    abortAll: () => void;
    getSignal: (id: string) => AbortSignal | undefined;
} {
    const controllersRef = useRef<Map<string, AbortController>>(new Map());

    // 全てキャンセル（アンマウント時）
    useEffect(() => {
        return () => {
            controllersRef.current.forEach(controller => controller.abort());
            controllersRef.current.clear();
        };
    }, []);

    const createController = useCallback((id: string): AbortController => {
        // 既存のコントローラーをキャンセル
        const existing = controllersRef.current.get(id);
        if (existing) {
            existing.abort();
        }

        const controller = new AbortController();
        controllersRef.current.set(id, controller);
        return controller;
    }, []);

    const abortOne = useCallback((id: string) => {
        const controller = controllersRef.current.get(id);
        if (controller) {
            controller.abort();
            controllersRef.current.delete(id);
        }
    }, []);

    const abortAll = useCallback(() => {
        controllersRef.current.forEach(controller => controller.abort());
        controllersRef.current.clear();
    }, []);

    const getSignal = useCallback((id: string): AbortSignal | undefined => {
        return controllersRef.current.get(id)?.signal;
    }, []);

    return {
        createController,
        abortOne,
        abortAll,
        getSignal,
    };
}

export default useAbortableRequest;
