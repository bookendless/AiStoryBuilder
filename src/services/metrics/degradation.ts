/**
 * 章順に並べた指標の傾き（劣化検出）
 *
 * 一括生成やまとめ書きでは、後半の章ほど描写が痩せ、同じ言い回しが増える傾向がある。
 * 章番号を x、指標を y とした最小二乗の傾きで、その方向と大きさを見る。AI呼び出しなし。
 */

/** 傾きを出すのに必要な最小の点数。3点以下では1章の外れ値で符号が反転する */
export const MIN_POINTS_FOR_TREND = 4;

export interface TrendResult {
    /** 1章あたりの変化量（最小二乗の傾き）。判定不能なら null */
    slope: number | null;
    /** 傾きを「指標の平均に対する1章あたりの割合」に直した値。指標間の比較用 */
    relativeSlope: number | null;
    /** 計測に使った点の数（null を除いた章数） */
    points: number;
}

/**
 * 章順の系列から傾きを求める。
 * null（計測不能だった章）は詰めずに読み飛ばし、元の章番号を x として使う
 * （詰めると、計測できない章が続いた区間の傾きが実際より急になる）。
 */
export function computeTrend(series: (number | null)[]): TrendResult {
    const points: { x: number; y: number }[] = [];
    series.forEach((value, index) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            points.push({ x: index, y: value });
        }
    });

    if (points.length < MIN_POINTS_FOR_TREND) {
        return { slope: null, relativeSlope: null, points: points.length };
    }

    const n = points.length;
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (const { x, y } of points) {
        numerator += (x - meanX) * (y - meanY);
        denominator += (x - meanX) ** 2;
    }

    // 全点が同じ章番号（＝1章しか実データが無い）でない限り denominator は正
    if (denominator === 0) {
        return { slope: null, relativeSlope: null, points: n };
    }

    const slope = numerator / denominator;
    // 平均が0付近の指標（反復率など）で相対値が発散しないよう、平均が極小なら出さない
    const relativeSlope = Math.abs(meanY) > 1e-9 ? slope / Math.abs(meanY) : null;

    return { slope, relativeSlope, points: n };
}

/** 傾きの向きを表示用のラベルにする（しきい値未満は「横ばい」） */
export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

/** 「横ばい」と見なす相対傾きの上限（1章あたり1%） */
export const TREND_FLAT_THRESHOLD = 0.01;

export function toTrendDirection(trend: TrendResult): TrendDirection {
    if (trend.relativeSlope === null) return 'unknown';
    if (trend.relativeSlope > TREND_FLAT_THRESHOLD) return 'up';
    if (trend.relativeSlope < -TREND_FLAT_THRESHOLD) return 'down';
    return 'flat';
}
