/**
 * 定型表現の密度計測
 *
 * AI呼び出しなしの決定的な処理。1000字あたりの出現数と、実際に当たった表現を返す。
 * 密度そのものに「良い／悪い」の基準は無い（[slopDictionary](./slopDictionary.ts) 参照）。
 * 章どうしの比較や、プロンプト変更の前後比較に使う。
 */

import { SLOP_PATTERNS } from './slopDictionary';

/** 密度の基準となる文字数 */
export const SLOP_DENSITY_BASE_CHARS = 1000;

export interface SlopHit {
    label: string;
    count: number;
}

export interface SlopResult {
    /** 総出現回数 */
    totalCount: number;
    /** 1000字あたりの出現数 */
    density: number;
    /** 当たった表現（多い順）。書き手が現物を確認できるように返す */
    hits: SlopHit[];
}

export function computeSlop(text: string): SlopResult {
    const target = text ?? '';
    const hits: SlopHit[] = [];
    let totalCount = 0;

    for (const { label, pattern } of SLOP_PATTERNS) {
        // 辞書の RegExp は g フラグ付きの共有インスタンスだが、String#match は
        // グローバル正規表現に対して lastIndex を 0 に戻してから全件走査する仕様のため、
        // 呼び出しをまたいで状態が持ち越されることはない（exec に変える場合は要リセット）
        const count = (target.match(pattern) ?? []).length;
        if (count > 0) {
            hits.push({ label, count });
            totalCount += count;
        }
    }

    hits.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const density = target.length > 0
        ? (totalCount * SLOP_DENSITY_BASE_CHARS) / target.length
        : 0;

    return { totalCount, density, hits };
}
