/**
 * 小説プローズを「処理ウィンドウ」に分割する。
 *
 * 章マーカーは考慮しない（章分割は別概念。v1 では原文を逐語保存し、章分割は行わない）。
 * 予算（getInputCharBudget の戻り値）以内の文字数で、段落境界 → 改行 → 句点 の優先順位で
 * 自然な位置を探して切る。境界で人物紹介などが割れるのを緩和するため、わずかにオーバーラップさせる。
 */

import { IMPORT_CHUNK_OVERLAP } from './constants';
import { normalizeLineEndings } from '../../utils/textEncoding';

export interface ProseChunk {
    index: number;
    text: string;
}

/**
 * @param text   分割対象のプローズ
 * @param budget 1チャンクの最大文字数（getInputCharBudget の戻り値を想定）
 * @param overlap 連続チャンク間で重複させる文字数
 */
export function chunkProse(text: string, budget: number, overlap: number = IMPORT_CHUNK_OVERLAP): ProseChunk[] {
    const clean = normalizeLineEndings(text).trim();
    if (!clean) return [];

    const safeBudget = Math.max(500, Math.floor(budget));
    if (clean.length <= safeBudget) {
        return [{ index: 0, text: clean }];
    }

    const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeBudget / 4)));
    // 早すぎる切断を避けるための下限位置（チャンクが極端に短くならないように）
    const minBoundary = Math.floor(safeBudget * 0.5);

    const chunks: ProseChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < clean.length) {
        let end = Math.min(start + safeBudget, clean.length);

        if (end < clean.length) {
            const window = clean.slice(start, end);
            const para = window.lastIndexOf('\n\n');
            const nl = window.lastIndexOf('\n');
            const period = Math.max(
                window.lastIndexOf('。'),
                window.lastIndexOf('！'),
                window.lastIndexOf('？')
            );

            let cut = -1;
            if (para >= minBoundary) cut = para + 2;
            else if (nl >= minBoundary) cut = nl + 1;
            else if (period >= minBoundary) cut = period + 1;

            if (cut > 0) end = start + cut;
        }

        const slice = clean.slice(start, end).trim();
        if (slice) {
            chunks.push({ index, text: slice });
            index++;
        }

        if (end >= clean.length) break;
        // 次の開始位置は必ず前進させる（無限ループ防止）
        start = Math.max(end - safeOverlap, start + 1);
    }

    return chunks;
}
