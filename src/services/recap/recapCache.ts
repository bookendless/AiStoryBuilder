/**
 * リキャップの localStorage キャッシュ / スヌーズ管理
 *
 * キャッシュは消えても再生成できるため、Project本体（IndexedDB・バックアップ対象）には保存しない。
 */

import { RecapCache } from '../../types/recap';

const CACHE_PREFIX = 'recap-cache:';
const SNOOZE_PREFIX = 'recap-snooze:';

/** ローカル日付（YYYY-MM-DD）。スヌーズの「今日」判定に使用 */
const todayKey = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function loadRecapCache(projectId: string): RecapCache | null {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + projectId);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RecapCache;
        if (
            parsed &&
            typeof parsed.signature === 'string' &&
            parsed.content &&
            typeof parsed.content.narrative === 'string'
        ) {
            return parsed;
        }
    } catch {
        // 壊れたキャッシュは無視（次回再生成）
    }
    return null;
}

export function saveRecapCache(cache: RecapCache): void {
    try {
        localStorage.setItem(CACHE_PREFIX + cache.projectId, JSON.stringify(cache));
    } catch {
        // 容量超過等は無視（キャッシュなしで動作継続）
    }
}

/** 「今日は表示しない」を記録する */
export function snoozeRecapToday(projectId: string): void {
    try {
        localStorage.setItem(SNOOZE_PREFIX + projectId, todayKey());
    } catch {
        // ignore
    }
}

/** 今日スヌーズ済みか */
export function isRecapSnoozedToday(projectId: string): boolean {
    try {
        return localStorage.getItem(SNOOZE_PREFIX + projectId) === todayKey();
    } catch {
        return false;
    }
}
