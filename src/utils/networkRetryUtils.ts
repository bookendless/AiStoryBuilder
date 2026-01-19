/**
 * ネットワークリトライユーティリティ
 * 
 * 不安定なモバイルネットワークでのAI機能の信頼性を向上させるため、
 * 指数バックオフによる自動リトライとオフラインキューを提供します。
 */

// リトライオプション
export interface RetryOptions {
    /** 最大リトライ回数（デフォルト: 3） */
    maxRetries?: number;
    /** 初期待機時間（ミリ秒）（デフォルト: 1000） */
    initialDelay?: number;
    /** 最大待機時間（ミリ秒）（デフォルト: 30000） */
    maxDelay?: number;
    /** バックオフ係数（デフォルト: 2） */
    backoffFactor?: number;
    /** リトライ対象のエラー判定関数 */
    retryCondition?: (error: unknown) => boolean;
    /** リトライ時のコールバック */
    onRetry?: (attempt: number, delay: number, error: unknown) => void;
    /** ジッター（ランダム性）を追加するかどうか */
    jitter?: boolean;
    /** キャンセル用のAbortSignal */
    signal?: AbortSignal;
}

// キューアイテムの状態
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

// オフラインキューアイテム
export interface QueueItem<T = unknown> {
    id: string;
    request: () => Promise<T>;
    status: QueueItemStatus;
    retryCount: number;
    createdAt: number;
    lastAttemptAt?: number;
    error?: string;
    result?: T;
    priority: number;
    metadata?: Record<string, unknown>;
}

// キューイベント
export interface QueueEvents<T = unknown> {
    onItemAdded?: (item: QueueItem<T>) => void;
    onItemCompleted?: (item: QueueItem<T>) => void;
    onItemFailed?: (item: QueueItem<T>) => void;
    onQueueEmpty?: () => void;
    onOnlineResume?: () => void;
}

/**
 * 指数バックオフで待機時間を計算
 */
export function calculateBackoffDelay(
    attempt: number,
    options: RetryOptions = {}
): number {
    const {
        initialDelay = 1000,
        maxDelay = 30000,
        backoffFactor = 2,
        jitter = true,
    } = options;

    // 指数バックオフの計算
    let delay = initialDelay * Math.pow(backoffFactor, attempt);

    // ジッターを追加（0.5〜1.5倍のランダムな変動）
    if (jitter) {
        const jitterFactor = 0.5 + Math.random();
        delay = delay * jitterFactor;
    }

    // 最大待機時間を超えないように制限
    return Math.min(delay, maxDelay);
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function isRetryableError(error: unknown): boolean {
    // ネットワークエラー
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    // HTTPステータスコードによる判定
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        // 5xx サーバーエラー、408 タイムアウト、429 レート制限
        return status >= 500 || status === 408 || status === 429;
    }

    // AbortError（ユーザーによるキャンセル）はリトライ対象外
    if (error instanceof Error && error.name === 'AbortError') {
        return false; // キャンセルはリトライしない
    }

    // ネットワーク関連のエラーメッセージ
    if (error instanceof Error) {
        const retryableMessages = [
            'network',
            'timeout',
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'fetch failed',
            'Failed to fetch',
        ];
        return retryableMessages.some(msg =>
            error.message.toLowerCase().includes(msg.toLowerCase())
        );
    }

    return false;
}

/**
 * リトライ付きでPromiseを実行（キャンセル対応）
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        retryCondition = isRetryableError,
        onRetry,
        signal,
    } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // キャンセルチェック
        if (signal?.aborted) {
            const abortError = new Error('リクエストがキャンセルされました');
            abortError.name = 'AbortError';
            throw abortError;
        }

        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // AbortErrorの場合はリトライせずに即座にスロー
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }

            // 最後の試行、またはリトライ不可能なエラー
            if (attempt >= maxRetries || !retryCondition(error)) {
                throw error;
            }

            // 待機時間を計算
            const delay = calculateBackoffDelay(attempt, options);

            // リトライコールバック
            if (onRetry) {
                onRetry(attempt + 1, delay, error);
            }

            console.log(
                `[NetworkRetry] リトライ ${attempt + 1}/${maxRetries} - ${delay}ms後に再試行`
            );

            // キャンセル可能な待機
            await abortableDelay(delay, signal);
        }
    }

    throw lastError;
}

/**
 * キャンセル可能な遅延
 */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            const abortError = new Error('リクエストがキャンセルされました');
            abortError.name = 'AbortError';
            reject(abortError);
            return;
        }

        const timeoutId = setTimeout(resolve, ms);

        if (signal) {
            const abortHandler = () => {
                clearTimeout(timeoutId);
                const abortError = new Error('リクエストがキャンセルされました');
                abortError.name = 'AbortError';
                reject(abortError);
            };

            signal.addEventListener('abort', abortHandler, { once: true });

            // タイムアウト完了時にリスナーを削除
            const originalResolve = resolve;
            resolve = () => {
                signal.removeEventListener('abort', abortHandler);
                originalResolve();
            };
        }
    });
}

/**
 * オフラインキューマネージャー
 */
export class OfflineQueueManager<T = unknown> {
    private queue: Map<string, QueueItem<T>> = new Map();
    private isProcessing = false;
    private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private events: QueueEvents<T> = {};
    private retryOptions: RetryOptions;
    private storageKey = 'offline_queue_metadata';

    constructor(
        retryOptions: RetryOptions = {},
        events: QueueEvents<T> = {}
    ) {
        this.retryOptions = {
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 60000,
            jitter: true,
            ...retryOptions,
        };
        this.events = events;

        // オンライン状態の監視
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            window.addEventListener('offline', this.handleOffline);
        }

        // 保存されたキューメタデータを復元（リクエスト関数は復元不可）
        this.restoreQueueMetadata();
    }

    private handleOnline = () => {
        this.isOnline = true;
        console.log('[OfflineQueue] オンライン状態に復帰');
        this.events.onOnlineResume?.();
        this.processQueue();
    };

    private handleOffline = () => {
        this.isOnline = false;
        console.log('[OfflineQueue] オフライン状態を検知');
    };

    /**
     * キューにリクエストを追加
     */
    add(
        request: () => Promise<T>,
        options: {
            id?: string;
            priority?: number;
            metadata?: Record<string, unknown>;
        } = {}
    ): string {
        const id = options.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const item: QueueItem<T> = {
            id,
            request,
            status: 'pending',
            retryCount: 0,
            createdAt: Date.now(),
            priority: options.priority || 0,
            metadata: options.metadata,
        };

        this.queue.set(id, item);
        this.saveQueueMetadata();
        this.events.onItemAdded?.(item);

        console.log(`[OfflineQueue] リクエストをキューに追加: ${id}`);

        // オンライン状態なら即座に処理開始
        if (this.isOnline && !this.isProcessing) {
            this.processQueue();
        }

        return id;
    }

    /**
     * キューからアイテムを削除
     */
    remove(id: string): boolean {
        const deleted = this.queue.delete(id);
        if (deleted) {
            this.saveQueueMetadata();
        }
        return deleted;
    }

    /**
     * キューをクリア
     */
    clear(): void {
        this.queue.clear();
        this.saveQueueMetadata();
    }

    /**
     * キューのサイズを取得
     */
    size(): number {
        return this.queue.size;
    }

    /**
     * ペンディング中のアイテム数を取得
     */
    pendingCount(): number {
        return Array.from(this.queue.values()).filter(
            item => item.status === 'pending'
        ).length;
    }

    /**
     * キュー内のアイテムを取得
     */
    getItems(): QueueItem<T>[] {
        return Array.from(this.queue.values());
    }

    /**
     * キューを処理
     */
    async processQueue(): Promise<void> {
        if (this.isProcessing || !this.isOnline) {
            return;
        }

        this.isProcessing = true;

        try {
            // 優先度順にソート（高い順）
            const pendingItems = Array.from(this.queue.values())
                .filter(item => item.status === 'pending')
                .sort((a, b) => b.priority - a.priority);

            for (const item of pendingItems) {
                if (!this.isOnline) {
                    console.log('[OfflineQueue] オフラインのため処理を中断');
                    break;
                }

                await this.processItem(item);
            }

            // キューが空になった場合
            if (this.pendingCount() === 0) {
                this.events.onQueueEmpty?.();
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 単一アイテムを処理
     */
    private async processItem(item: QueueItem<T>): Promise<void> {
        item.status = 'processing';
        item.lastAttemptAt = Date.now();
        this.saveQueueMetadata();

        try {
            const result = await withRetry(item.request, {
                ...this.retryOptions,
                onRetry: (attempt, _delay, error) => {
                    item.retryCount = attempt;
                    item.error = (error as Error).message;
                    this.saveQueueMetadata();
                    console.log(
                        `[OfflineQueue] ${item.id} リトライ ${attempt}/${this.retryOptions.maxRetries}`
                    );
                },
            });

            item.status = 'completed';
            item.result = result;
            this.saveQueueMetadata();
            this.events.onItemCompleted?.(item);

            console.log(`[OfflineQueue] ${item.id} 処理完了`);

            // 処理完了したアイテムは削除
            this.queue.delete(item.id);
            this.saveQueueMetadata();
        } catch (error) {
            item.status = 'failed';
            item.error = (error as Error).message;
            this.saveQueueMetadata();
            this.events.onItemFailed?.(item);

            console.error(`[OfflineQueue] ${item.id} 処理失敗:`, error);
        }
    }

    /**
     * キューメタデータをsessionStorageに保存
     */
    private saveQueueMetadata(): void {
        if (typeof sessionStorage === 'undefined') return;

        try {
            const metadata = Array.from(this.queue.values()).map(item => ({
                id: item.id,
                status: item.status,
                retryCount: item.retryCount,
                createdAt: item.createdAt,
                lastAttemptAt: item.lastAttemptAt,
                error: item.error,
                priority: item.priority,
                metadata: item.metadata,
            }));

            sessionStorage.setItem(this.storageKey, JSON.stringify(metadata));
        } catch (error) {
            console.warn('[OfflineQueue] メタデータ保存エラー:', error);
        }
    }

    /**
     * キューメタデータを復元（リクエスト関数は復元不可）
     */
    private restoreQueueMetadata(): void {
        if (typeof sessionStorage === 'undefined') return;

        try {
            const stored = sessionStorage.getItem(this.storageKey);
            if (stored) {
                const metadata = JSON.parse(stored);
                console.log(`[OfflineQueue] ${metadata.length}件のキューメタデータを検出`);
                // 注意: リクエスト関数は復元できないため、メタデータのみを保持
                // 実際のリクエストは再登録が必要
            }
        } catch (error) {
            console.warn('[OfflineQueue] メタデータ復元エラー:', error);
        }
    }

    /**
     * クリーンアップ
     */
    dispose(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
        }
        this.queue.clear();
    }
}

// シングルトンインスタンス
let defaultQueueManager: OfflineQueueManager | null = null;

/**
 * デフォルトのオフラインキューマネージャーを取得
 */
export function getOfflineQueueManager(): OfflineQueueManager {
    if (!defaultQueueManager) {
        defaultQueueManager = new OfflineQueueManager({
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 60000,
        });
    }
    return defaultQueueManager;
}

/**
 * オフライン時にリクエストをキューに追加、オンライン時は直接実行
 */
export async function executeWithOfflineQueue<T>(
    request: () => Promise<T>,
    options: {
        id?: string;
        priority?: number;
        metadata?: Record<string, unknown>;
        retryOptions?: RetryOptions;
    } = {}
): Promise<T | string> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
        // オンライン時は直接実行（リトライ付き）
        return withRetry(request, options.retryOptions);
    } else {
        // オフライン時はキューに追加
        const queue = getOfflineQueueManager();
        const id = queue.add(request, options);
        console.log(`[NetworkRetry] オフラインのためキューに追加: ${id}`);
        return id;
    }
}

export default {
    withRetry,
    calculateBackoffDelay,
    isRetryableError,
    OfflineQueueManager,
    getOfflineQueueManager,
    executeWithOfflineQueue,
};
