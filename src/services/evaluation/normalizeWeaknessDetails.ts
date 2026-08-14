/**
 * 講評の「引用つき改善点」の正規化
 *
 * 引用が評価対象テキストに実在しない場合、指摘そのものは残して引用だけを落とす。
 * 整合性ガード（実在しない指摘は破棄）や校正（適用ボタンを無効化）とは方針が異なるのは、
 * 講評の指摘は引用がなくても作者にとって意味があるため。引用は根拠の補助でしかない。
 */

import { EvaluationWeakness } from '../../types/evaluation';
import { normalizeForQuoteMatch, quoteExists } from '../quotes/verifyQuote';

export function normalizeWeaknessDetails(raw: unknown, content: string): EvaluationWeakness[] {
    if (!Array.isArray(raw)) return [];

    // AIが読んだのはサニタイズ後のテキストなので、照合も同じ形に揃える
    const normalizedText = normalizeForQuoteMatch(content);
    const details: EvaluationWeakness[] = [];

    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;

        const point = typeof record.point === 'string' ? record.point.trim() : '';
        if (!point) continue;

        const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
        details.push(quoteExists(quote, normalizedText) ? { point, quote } : { point });
    }

    return details;
}
