/**
 * ストレージクォータ管理ユーティリティ
 * 
 * IndexedDB のストレージ使用量を監視し、
 * 容量不足時の警告・自動クリーンアップを行います。
 */

// ストレージ使用量情報
export interface StorageQuotaInfo {
    /** 使用中のストレージ（バイト） */
    usage: number;
    /** ストレージクォータ（バイト） */
    quota: number;
    /** 使用率（0-100） */
    percentage: number;
    /** 人間が読める形式の使用量 */
    usageFormatted: string;
    /** 人間が読める形式のクォータ */
    quotaFormatted: string;
    /** 残り容量 */
    available: number;
    /** 残り容量（人間が読める形式） */
    availableFormatted: string;
    /** 容量が不足しているかどうか */
    isLow: boolean;
    /** 容量が危機的かどうか */
    isCritical: boolean;
}

// クリーンアップオプション
export interface CleanupOptions {
    /** 古いバックアップを削除するかどうか */
    deleteOldBackups?: boolean;
    /** 古い履歴を削除するかどうか */
    deleteOldHistory?: boolean;
    /** 古いAIログを削除するかどうか */
    deleteOldAILogs?: boolean;
    /** 未使用の画像を削除するかどうか */
    deleteUnusedImages?: boolean;
    /** 削除対象の日数（デフォルト: 30日） */
    retentionDays?: number;
}

// 閾値定義
const WARNING_THRESHOLD = 80; // 80%で警告
const CRITICAL_THRESHOLD = 95; // 95%で危機的

// バイトを人間が読める形式に変換
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * ストレージクォータ情報を取得
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
    // Storage API が利用可能かチェック
    if (!navigator.storage || !navigator.storage.estimate) {
        console.warn('[StorageQuota] Storage API がサポートされていません');
        return null;
    }

    try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (usage / quota) * 100 : 0;
        const available = quota - usage;

        return {
            usage,
            quota,
            percentage: Math.round(percentage * 10) / 10,
            usageFormatted: formatBytes(usage),
            quotaFormatted: formatBytes(quota),
            available,
            availableFormatted: formatBytes(available),
            isLow: percentage >= WARNING_THRESHOLD,
            isCritical: percentage >= CRITICAL_THRESHOLD,
        };
    } catch (error) {
        console.error('[StorageQuota] クォータ取得エラー:', error);
        return null;
    }
}

/**
 * ストレージ使用量が閾値を超えているかチェック
 */
export async function isStorageLow(
    warningThreshold = WARNING_THRESHOLD
): Promise<boolean> {
    const info = await getStorageQuota();
    return info ? info.percentage >= warningThreshold : false;
}

/**
 * ストレージ使用量が危機的かチェック
 */
export async function isStorageCritical(
    criticalThreshold = CRITICAL_THRESHOLD
): Promise<boolean> {
    const info = await getStorageQuota();
    return info ? info.percentage >= criticalThreshold : false;
}

/**
 * 永続ストレージを要求
 * モバイルブラウザでデータが自動削除されるのを防ぐ
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
        console.warn('[StorageQuota] Persistent Storage API がサポートされていません');
        return false;
    }

    try {
        // 既に永続化されているかチェック
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
            console.log('[StorageQuota] ストレージは既に永続化されています');
            return true;
        }

        // 永続化を要求
        const granted = await navigator.storage.persist();
        if (granted) {
            console.log('[StorageQuota] ストレージの永続化が許可されました');
        } else {
            console.warn('[StorageQuota] ストレージの永続化が拒否されました');
        }
        return granted;
    } catch (error) {
        console.error('[StorageQuota] 永続化要求エラー:', error);
        return false;
    }
}

/**
 * ストレージが永続化されているかチェック
 */
export async function isStoragePersisted(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persisted) {
        return false;
    }

    try {
        return await navigator.storage.persisted();
    } catch (error) {
        console.error('[StorageQuota] 永続化確認エラー:', error);
        return false;
    }
}

/**
 * 保存前にストレージ容量をチェック
 * 容量不足の場合は警告またはエラーを返す
 */
export async function checkStorageBeforeSave(
    estimatedSize: number = 0
): Promise<{
    canSave: boolean;
    warning?: string;
    error?: string;
    quotaInfo?: StorageQuotaInfo;
}> {
    const info = await getStorageQuota();

    if (!info) {
        // API が利用できない場合は保存を許可
        return { canSave: true };
    }

    // 推定サイズを考慮した使用量をチェック
    const projectedUsage = info.usage + estimatedSize;
    const projectedPercentage = (projectedUsage / info.quota) * 100;

    if (projectedPercentage >= CRITICAL_THRESHOLD) {
        return {
            canSave: false,
            error: `ストレージ容量が不足しています。現在 ${info.usageFormatted} / ${info.quotaFormatted} (${info.percentage}%) を使用中です。不要なデータを削除してください。`,
            quotaInfo: info,
        };
    }

    if (projectedPercentage >= WARNING_THRESHOLD) {
        return {
            canSave: true,
            warning: `ストレージ容量が残り少なくなっています（${info.availableFormatted} 利用可能）。不要なバックアップや履歴を削除することをお勧めします。`,
            quotaInfo: info,
        };
    }

    return { canSave: true, quotaInfo: info };
}

/**
 * 自動クリーンアップを実行
 */
export async function performAutoCleanup(
    options: CleanupOptions = {}
): Promise<{
    success: boolean;
    freedSpace: number;
    details: string[];
}> {
    const {
        deleteOldBackups = true,
        deleteOldHistory = true,
        deleteOldAILogs = true,
        deleteUnusedImages = false, // デフォルトではオフ
        retentionDays = 30,
    } = options;

    const details: string[] = [];
    let freedSpace = 0;

    try {
        // 動的インポートでdatabaseServiceを読み込み（循環参照防止）
        const { databaseService } = await import('../services/databaseService');

        // 古いバックアップを削除
        if (deleteOldBackups) {
            // バックアップの古いもの（retentionDays以上前）を削除
            // 注意: この実装は簡易版です。実際にはプロジェクトごとにバックアップ数を確認する必要があります
            const projects = await databaseService.getAllProjects();
            for (const project of projects) {
                const backups = await databaseService.getBackups(project.id, 'auto');
                const oldBackups = backups.filter(b => {
                    const age = Date.now() - new Date(b.createdAt).getTime();
                    return age > retentionDays * 24 * 60 * 60 * 1000;
                });

                for (const backup of oldBackups) {
                    await databaseService.deleteBackup(backup.id);
                    freedSpace += 1000; // 推定サイズ（実際のサイズは不明）
                }

                if (oldBackups.length > 0) {
                    details.push(`${project.title}: ${oldBackups.length}件の古いバックアップを削除`);
                }
            }
        }

        // 古い履歴を削除
        if (deleteOldHistory) {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const deletedCount = await databaseService.deleteHistoryEntriesBeforeDate(cutoffDate);
            if (deletedCount > 0) {
                details.push(`${deletedCount}件の古い編集履歴を削除`);
                freedSpace += deletedCount * 500; // 推定サイズ
            }
        }

        // 古いAIログを削除
        if (deleteOldAILogs) {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const deletedCount = await databaseService.deleteAILogEntriesBeforeDate(cutoffDate);
            if (deletedCount > 0) {
                details.push(`${deletedCount}件の古いAIログを削除`);
                freedSpace += deletedCount * 2000; // 推定サイズ
            }
        }

        // 未使用の画像を削除（オプション）
        if (deleteUnusedImages) {
            // この機能はdatabaseServiceに実装が必要
            // 現時点では未実装
            details.push('未使用画像の削除は現在未対応です');
        }

        if (details.length === 0) {
            details.push('削除対象のデータはありませんでした');
        }

        console.log('[StorageQuota] 自動クリーンアップ完了:', details);
        return { success: true, freedSpace, details };
    } catch (error) {
        console.error('[StorageQuota] 自動クリーンアップエラー:', error);
        return {
            success: false,
            freedSpace: 0,
            details: [`エラー: ${(error as Error).message}`],
        };
    }
}

/**
 * ストレージ使用量をコンソールに出力
 */
export async function logStorageUsage(): Promise<void> {
    const info = await getStorageQuota();
    if (info) {
        console.log(
            `[StorageQuota] 使用量: ${info.usageFormatted} / ${info.quotaFormatted} ` +
            `(${info.percentage}%) - 残り: ${info.availableFormatted}`
        );

        if (info.isCritical) {
            console.error('[StorageQuota] ⚠️ ストレージ容量が危機的です！');
        } else if (info.isLow) {
            console.warn('[StorageQuota] ⚠️ ストレージ容量が不足しています');
        }
    }
}

export default {
    getStorageQuota,
    isStorageLow,
    isStorageCritical,
    requestPersistentStorage,
    isStoragePersisted,
    checkStorageBeforeSave,
    performAutoCleanup,
    logStorageUsage,
};
