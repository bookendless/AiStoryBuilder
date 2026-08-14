/**
 * 確率つき複数案の「本命／意外」バッジ
 *
 * AIに案ごとの選びやすさ（probability）を出させても、値は 0.3 前後に固まりやすく、
 * 固定の閾値（例: 0.15未満なら意外）ではバッジがほとんど出ない。そのため絶対値ではなく
 * 候補群の中での相対順位で決める。
 *
 * 確率つきの案が2件未満のとき、または全部同じ値のときは、比較に意味がないので何も付けない。
 */

export type ProbabilityBadge = '本命' | '意外';

/**
 * AI応答の値を 0.0〜1.0 の確率に正規化する。
 * モデルは数値だけでなく "0.3" のように文字列で返すこともあるため、どちらも受け入れる。
 * 範囲外の値は丸め、数値として解釈できないものは undefined（＝確率なし）にする。
 */
export const toProbability = (v: unknown): number | undefined => {
    if (typeof v === 'string' && v.trim() === '') return undefined;
    if (typeof v !== 'number' && typeof v !== 'string') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined;
};

export function assignProbabilityBadges<T extends { id: string; probability?: number }>(
    items: T[]
): Record<string, ProbabilityBadge> {
    const withProbability = items.filter(
        (item): item is T & { probability: number } => typeof item.probability === 'number'
    );
    if (withProbability.length < 2) return {};

    const sorted = [...withProbability].sort((a, b) => b.probability - a.probability);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    if (highest.probability === lowest.probability) return {};

    return { [highest.id]: '本命', [lowest.id]: '意外' };
}
