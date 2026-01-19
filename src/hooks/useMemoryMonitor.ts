/**
 * メモリ使用量監視フック
 * 
 * モバイル機器でのメモリ不足を早期検出し、
 * 必要に応じてユーザーに警告を表示します。
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Chrome の performance.memory API の型定義
interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
    memory?: PerformanceMemory;
}

// メモリ使用量情報
export interface MemoryInfo {
    /** 使用中のJSヒープサイズ（バイト） */
    used: number;
    /** 合計JSヒープサイズ（バイト） */
    total: number;
    /** ヒープサイズ制限（バイト） */
    limit: number;
    /** 使用率（0-100） */
    percentage: number;
    /** 人間が読める形式の使用量 */
    usedFormatted: string;
    /** メモリ使用量が高いかどうか */
    isHigh: boolean;
    /** メモリ使用量が危機的かどうか */
    isCritical: boolean;
}

// オプション
export interface UseMemoryMonitorOptions {
    /** 更新間隔（ミリ秒）- デフォルト: 10000（10秒） */
    interval?: number;
    /** 警告閾値（%）- デフォルト: 70 */
    warningThreshold?: number;
    /** 危機的閾値（%）- デフォルト: 85 */
    criticalThreshold?: number;
    /** 閾値超過時のコールバック */
    onThresholdExceeded?: (info: MemoryInfo) => void;
    /** 危機的レベル到達時のコールバック */
    onCriticalLevel?: (info: MemoryInfo) => void;
    /** 有効かどうか - デフォルト: true */
    enabled?: boolean;
}

// バイトを人間が読める形式に変換
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// メモリ情報が利用可能かチェック
function isMemoryApiAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const perf = performance as PerformanceWithMemory;
    return !!perf.memory;
}

/**
 * メモリ使用量を監視するカスタムフック
 */
export function useMemoryMonitor(options: UseMemoryMonitorOptions = {}): {
    memoryInfo: MemoryInfo | null;
    isSupported: boolean;
    requestGC: () => void;
    refresh: () => void;
} {
    const {
        interval = 10000,
        warningThreshold = 70,
        criticalThreshold = 85,
        onThresholdExceeded,
        onCriticalLevel,
        enabled = true,
    } = options;

    const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
    const [isSupported] = useState(() => isMemoryApiAvailable());

    // コールバックの最新参照を保持
    const onThresholdExceededRef = useRef(onThresholdExceeded);
    const onCriticalLevelRef = useRef(onCriticalLevel);

    useEffect(() => {
        onThresholdExceededRef.current = onThresholdExceeded;
        onCriticalLevelRef.current = onCriticalLevel;
    }, [onThresholdExceeded, onCriticalLevel]);

    // メモリ情報を取得
    const getMemoryInfo = useCallback((): MemoryInfo | null => {
        if (!isSupported) return null;

        const perf = performance as PerformanceWithMemory;
        if (!perf.memory) return null;

        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory;
        const percentage = (usedJSHeapSize / jsHeapSizeLimit) * 100;
        const isHigh = percentage >= warningThreshold;
        const isCritical = percentage >= criticalThreshold;

        return {
            used: usedJSHeapSize,
            total: totalJSHeapSize,
            limit: jsHeapSizeLimit,
            percentage: Math.round(percentage * 10) / 10,
            usedFormatted: formatBytes(usedJSHeapSize),
            isHigh,
            isCritical,
        };
    }, [isSupported, warningThreshold, criticalThreshold]);

    // メモリ情報を更新
    const refresh = useCallback(() => {
        const info = getMemoryInfo();
        if (info) {
            setMemoryInfo(info);

            // 閾値超過時のコールバック
            if (info.isCritical && onCriticalLevelRef.current) {
                onCriticalLevelRef.current(info);
            } else if (info.isHigh && onThresholdExceededRef.current) {
                onThresholdExceededRef.current(info);
            }
        }
    }, [getMemoryInfo]);

    // ガベージコレクションを促進（直接制御はできないが、参照解除でGC対象を増やす）
    const requestGC = useCallback(() => {
        // メモリ解放を促すためのヒント
        // 実際のGCはブラウザが決定する
        if (typeof window !== 'undefined') {
            // 一時的なオブジェクトを作成して破棄
            // これにより、GCのトリガーになる可能性がある
            const tempArrays: ArrayBuffer[] = [];
            for (let i = 0; i < 10; i++) {
                tempArrays.push(new ArrayBuffer(1024 * 1024)); // 1MB
            }
            tempArrays.length = 0;

            console.log('[MemoryMonitor] ガベージコレクションをリクエストしました');
        }
    }, []);

    // 定期的な監視
    useEffect(() => {
        if (!enabled || !isSupported) return;

        // 初回取得
        refresh();

        // 定期更新
        const timer = setInterval(refresh, interval);

        return () => {
            clearInterval(timer);
        };
    }, [enabled, isSupported, interval, refresh]);

    return {
        memoryInfo,
        isSupported,
        requestGC,
        refresh,
    };
}

/**
 * メモリ使用量が高い場合にコンソールに警告を出力するシンプルなフック
 */
export function useMemoryWarning(
    warningThreshold = 70,
    criticalThreshold = 85
): void {
    useMemoryMonitor({
        warningThreshold,
        criticalThreshold,
        onThresholdExceeded: (info) => {
            console.warn(
                `[MemoryWarning] メモリ使用量が高くなっています: ${info.usedFormatted} (${info.percentage}%)`
            );
        },
        onCriticalLevel: (info) => {
            console.error(
                `[MemoryWarning] メモリ使用量が危険レベルです: ${info.usedFormatted} (${info.percentage}%)`
            );
        },
    });
}

export default useMemoryMonitor;
