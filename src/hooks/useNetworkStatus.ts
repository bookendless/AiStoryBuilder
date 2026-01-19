/**
 * ネットワーク状態監視フック
 * 
 * ネットワークの接続状態と品質を監視し、
 * オフライン復帰時のイベントを提供します。
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 接続品質
export type ConnectionQuality = 'offline' | 'slow' | 'good' | 'unknown';

// ネットワーク情報（Navigator Connection API）
interface NetworkInformation {
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

// ネットワーク状態
export interface NetworkStatus {
    /** オンラインかどうか */
    isOnline: boolean;
    /** 接続品質 */
    quality: ConnectionQuality;
    /** 有効な接続タイプ（2g, 3g, 4g など） */
    effectiveType?: string;
    /** ダウンリンク速度（Mbps） */
    downlink?: number;
    /** ラウンドトリップ時間（ms） */
    rtt?: number;
    /** データセーバーモードかどうか */
    saveData?: boolean;
    /** 最後にオフラインになった時刻 */
    lastOfflineAt?: Date;
    /** 最後にオンラインになった時刻 */
    lastOnlineAt?: Date;
}

// オプション
export interface UseNetworkStatusOptions {
    /** オンライン復帰時のコールバック */
    onOnline?: () => void;
    /** オフライン時のコールバック */
    onOffline?: () => void;
    /** 接続品質変化時のコールバック */
    onQualityChange?: (quality: ConnectionQuality) => void;
}

/**
 * 接続品質を判定
 */
function getConnectionQuality(
    isOnline: boolean,
    connection?: NetworkInformation
): ConnectionQuality {
    if (!isOnline) return 'offline';

    if (connection) {
        const { effectiveType, downlink, rtt } = connection;

        // effectiveType による判定
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            return 'slow';
        }

        // ダウンリンク速度による判定（1Mbps未満は低速）
        if (downlink !== undefined && downlink < 1) {
            return 'slow';
        }

        // RTTによる判定（500ms以上は低速）
        if (rtt !== undefined && rtt > 500) {
            return 'slow';
        }

        if (effectiveType === '4g' || (downlink !== undefined && downlink >= 5)) {
            return 'good';
        }

        return 'good';
    }

    return 'unknown';
}

/**
 * Network Connection API を取得
 */
function getNetworkConnection(): NetworkInformation | undefined {
    if (typeof navigator === 'undefined') return undefined;

    const nav = navigator as NavigatorWithConnection;
    return nav.connection || nav.mozConnection || nav.webkitConnection;
}

/**
 * ネットワーク状態を監視するカスタムフック
 */
export function useNetworkStatus(
    options: UseNetworkStatusOptions = {}
): NetworkStatus {
    const { onOnline, onOffline, onQualityChange } = options;

    // コールバックの最新参照を保持
    const onOnlineRef = useRef(onOnline);
    const onOfflineRef = useRef(onOffline);
    const onQualityChangeRef = useRef(onQualityChange);

    useEffect(() => {
        onOnlineRef.current = onOnline;
        onOfflineRef.current = onOffline;
        onQualityChangeRef.current = onQualityChange;
    }, [onOnline, onOffline, onQualityChange]);

    const [status, setStatus] = useState<NetworkStatus>(() => {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const connection = getNetworkConnection();

        return {
            isOnline,
            quality: getConnectionQuality(isOnline, connection),
            effectiveType: connection?.effectiveType,
            downlink: connection?.downlink,
            rtt: connection?.rtt,
            saveData: connection?.saveData,
            lastOnlineAt: isOnline ? new Date() : undefined,
        };
    });

    // ネットワーク状態の更新
    const updateNetworkStatus = useCallback(() => {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        const connection = getNetworkConnection();
        const quality = getConnectionQuality(isOnline, connection);

        setStatus(prev => {
            const newStatus: NetworkStatus = {
                isOnline,
                quality,
                effectiveType: connection?.effectiveType,
                downlink: connection?.downlink,
                rtt: connection?.rtt,
                saveData: connection?.saveData,
                lastOfflineAt: !isOnline && prev.isOnline ? new Date() : prev.lastOfflineAt,
                lastOnlineAt: isOnline && !prev.isOnline ? new Date() : prev.lastOnlineAt,
            };

            // 品質変化コールバック
            if (prev.quality !== quality) {
                onQualityChangeRef.current?.(quality);
            }

            return newStatus;
        });
    }, []);

    // オンライン/オフラインイベントハンドラ
    const handleOnline = useCallback(() => {
        console.log('[NetworkStatus] オンラインに復帰');
        updateNetworkStatus();
        onOnlineRef.current?.();
    }, [updateNetworkStatus]);

    const handleOffline = useCallback(() => {
        console.log('[NetworkStatus] オフラインを検知');
        updateNetworkStatus();
        onOfflineRef.current?.();
    }, [updateNetworkStatus]);

    // イベントリスナーの設定
    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Network Information API の変化を監視
        const connection = getNetworkConnection();
        if (connection?.addEventListener) {
            connection.addEventListener('change', updateNetworkStatus);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);

            if (connection?.removeEventListener) {
                connection.removeEventListener('change', updateNetworkStatus);
            }
        };
    }, [handleOnline, handleOffline, updateNetworkStatus]);

    return status;
}

/**
 * ネットワークがオンラインかどうかを監視するシンプルなフック
 */
export function useIsOnline(): boolean {
    const { isOnline } = useNetworkStatus();
    return isOnline;
}

/**
 * ネットワーク接続品質が低いかどうかを判定するフック
 */
export function useIsSlowConnection(): boolean {
    const { quality } = useNetworkStatus();
    return quality === 'slow';
}

/**
 * オフラインキューのサイズを監視するフック
 */
export function useOfflineQueueSize(): number {
    const [size, setSize] = useState(0);

    useEffect(() => {
        // 動的インポートで循環参照を回避
        import('../utils/networkRetryUtils').then(({ getOfflineQueueManager }) => {
            const queue = getOfflineQueueManager();

            const updateSize = () => {
                setSize(queue.pendingCount());
            };

            // 初期値を設定
            updateSize();

            // ポーリングで更新（オブザーバーパターンがないため）
            const interval = setInterval(updateSize, 1000);

            return () => {
                clearInterval(interval);
            };
        });
    }, []);

    return size;
}

export default useNetworkStatus;
