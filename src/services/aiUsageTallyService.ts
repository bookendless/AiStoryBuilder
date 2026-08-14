/**
 * AI利用の工程別タリー（累積記録）
 *
 * 投稿サイトのAI利用区分（小説家になろうの4区分・カクヨムの3タグ）を後から説明できるように、
 * 「どの作品のどの工程でAIを何回呼んだか」だけを永続的に数える。
 *
 * プロンプト本文は保存しない。本文つきのAIログ（databaseService の aiLogs）は保持期間と
 * 件数の上限があり、また画面経由の呼び出ししか通らないため、工程の記録としては不完全になる。
 * こちらは aiService.generateContent の1点で数えるため、先回り生成のような画面を経由しない
 * 生成も取りこぼさない。
 *
 * 本体スキーマのマイグレーションを避けるため、aiCostService と同様に専用DBを用いる。
 */

import Dexie from 'dexie';
import { AIUsagePurpose } from '../types/ai';
import { TalliedPurpose, UNCLASSIFIED_PURPOSE } from '../constants/aiLogTypes';

export interface AIUsageTallyEntry {
    projectId: string;
    purpose: TalliedPurpose;
    /** その工程でのAI呼び出し回数（生成結果を採用したかどうかは含まない） */
    count: number;
    /** 本文生成が対象とした章のID（開示サマリーで章数を示すのに使う） */
    chapterIds: string[];
    firstUsedAt: number;
    lastUsedAt: number;
}

class AIUsageTallyDatabase extends Dexie {
    usageTally!: Dexie.Table<AIUsageTallyEntry, [string, string]>;

    constructor() {
        super('AIUsageTallyDB');
        this.version(1).stores({
            usageTally: '[projectId+purpose], projectId, lastUsedAt',
        });
    }
}

let db: AIUsageTallyDatabase | null = null;

function getDb(): AIUsageTallyDatabase {
    if (!db) {
        db = new AIUsageTallyDatabase();
    }
    return db;
}

/**
 * AI呼び出しを1件記録する（fire-and-forget・失敗しても例外を投げない）。
 *
 * projectId が無い呼び出しは作品別に集計できないため記録しない。
 * purpose 未指定は「未分類」として記録する（type からの推定はしない。
 * 校正を本文生成と誤って申告するような取り違えを避けるため）。
 */
export async function recordUsagePurpose(params: {
    projectId?: string;
    purpose?: AIUsagePurpose;
    chapterId?: string;
}): Promise<void> {
    const projectId = params.projectId?.trim();
    if (!projectId) return;

    const purpose: TalliedPurpose = params.purpose ?? UNCLASSIFIED_PURPOSE;
    const now = Date.now();

    try {
        const database = getDb();
        await database.transaction('rw', database.usageTally, async () => {
            const existing = await database.usageTally.get([projectId, purpose]);
            if (existing) {
                const chapterIds = params.chapterId && !existing.chapterIds.includes(params.chapterId)
                    ? [...existing.chapterIds, params.chapterId]
                    : existing.chapterIds;
                await database.usageTally.put({
                    ...existing,
                    count: existing.count + 1,
                    chapterIds,
                    lastUsedAt: now,
                });
            } else {
                await database.usageTally.put({
                    projectId,
                    purpose,
                    count: 1,
                    chapterIds: params.chapterId ? [params.chapterId] : [],
                    firstUsedAt: now,
                    lastUsedAt: now,
                });
            }
        });
    } catch (error) {
        console.warn('AI利用記録の保存に失敗:', error);
    }
}

/** 指定プロジェクトの工程別タリーを返す（記録がなければ空配列） */
export async function getProjectTally(projectId: string): Promise<AIUsageTallyEntry[]> {
    try {
        return await getDb().usageTally.where('projectId').equals(projectId).toArray();
    } catch (error) {
        console.warn('AI利用記録の読み込みに失敗:', error);
        return [];
    }
}

/** 指定プロジェクトの記録を削除する（プロジェクト削除時の後始末） */
export async function clearProjectTally(projectId: string): Promise<void> {
    try {
        await getDb().usageTally.where('projectId').equals(projectId).delete();
    } catch (error) {
        console.warn('AI利用記録の削除に失敗:', error);
    }
}

/** すべての記録を削除する */
export async function clearAllTally(): Promise<void> {
    await getDb().usageTally.clear();
}
