/**
 * What-ifレポートのバリデーション
 *
 * AI応答のJSONを WhatIfReport に正規化する。chapterImpacts の chapterTitle は
 * 実在する章タイトルと照合して chapterId を付与する（一致しない場合はIDなしで保持）。
 */

import { Chapter } from '../../types/project';
import { WhatIfChapterImpact, WhatIfImpactSeverity, WhatIfReport } from '../../types/whatIf';
import { toProbability } from '../../utils/probabilityBadge';

const VALID_SEVERITIES: ReadonlySet<string> = new Set(['major', 'moderate', 'minor']);

const toStringArray = (value: unknown, maxItems: number): string[] =>
    Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.trim())
            .slice(0, maxItems)
        : [];

/**
 * newPossibilities を正規化する。
 * 確率つきの `{ text, probability }` と、確率のない文字列のどちらでも受け取れるようにし、
 * 混在していても取りこぼさない。文字列配列側は常に完全な一覧になるため、
 * 表示や保存済みデータの読み込みはこれまでどおり newPossibilities だけを見ればよい。
 */
const toPossibilities = (
    value: unknown,
    maxItems: number
): { texts: string[]; details: { text: string; probability?: number }[] } => {
    if (!Array.isArray(value)) return { texts: [], details: [] };

    const details: { text: string; probability?: number }[] = [];
    for (const item of value) {
        if (details.length >= maxItems) break;

        if (typeof item === 'string') {
            const text = item.trim();
            if (text) details.push({ text });
        } else if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            const text = typeof record.text === 'string' ? record.text.trim() : '';
            if (text) details.push({ text, probability: toProbability(record.probability) });
        }
    }

    return { texts: details.map(d => d.text), details };
};

export function parseWhatIfReport(data: unknown, chapters: Chapter[]): WhatIfReport | null {
    if (!data || typeof data !== 'object') return null;
    const raw = data as Record<string, unknown>;

    const immediate = typeof raw.immediate === 'string' ? raw.immediate.trim() : '';
    const verdict = typeof raw.verdict === 'string' ? raw.verdict.trim() : '';
    if (!immediate || !verdict) return null;

    const chapterImpacts: WhatIfChapterImpact[] = [];
    if (Array.isArray(raw.chapterImpacts)) {
        for (const item of raw.chapterImpacts) {
            if (!item || typeof item !== 'object') continue;
            const impactRaw = item as Record<string, unknown>;
            const title = typeof impactRaw.chapterTitle === 'string' ? impactRaw.chapterTitle.trim() : '';
            const impact = typeof impactRaw.impact === 'string' ? impactRaw.impact.trim() : '';
            if (!title || !impact) continue;

            // 章タイトル照合（完全一致 → 部分一致の順）
            const matched =
                chapters.find(c => c.title === title) ??
                chapters.find(c => c.title.includes(title) || title.includes(c.title));

            const severity: WhatIfImpactSeverity = VALID_SEVERITIES.has(String(impactRaw.severity))
                ? (impactRaw.severity as WhatIfImpactSeverity)
                : 'moderate';

            chapterImpacts.push({
                chapterId: matched?.id ?? '',
                title: matched?.title ?? title,
                impact,
                severity,
            });
        }
    }

    const possibilities = toPossibilities(raw.newPossibilities, 5);

    return {
        immediate,
        chapterImpacts,
        brokenForeshadowings: toStringArray(raw.brokenForeshadowings, 10),
        relationshipChanges: toStringArray(raw.relationshipChanges, 10),
        newPossibilities: possibilities.texts,
        newPossibilityDetails: possibilities.details.some(d => typeof d.probability === 'number')
            ? possibilities.details
            : undefined,
        verdict,
    };
}
