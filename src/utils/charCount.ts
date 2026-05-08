/**
 * 文字数カウンターの色を比率に応じて切り替える共通関数。
 *  - 80% 以下: 通常（若草色）
 *  - 80% 超 100% 以下: 警告（山吹色）
 *  - 100% 超: 危険（桜色＝赤）
 *
 * Tailwindのクラス名を返すため、利用側は `className` にそのまま注入できる。
 */
export interface CountColor {
    /** プログレスバー背景クラス */
    bar: string;
    /** カウント数値テキストクラス */
    text: string;
}

export function getCountColor(current: number, max: number): CountColor {
    if (max <= 0) {
        return { bar: 'bg-wakagusa-500', text: 'text-sumi-400' };
    }
    const r = current / max;
    if (r > 1.0) return { bar: 'bg-red-500', text: 'text-red-500' };
    if (r > 0.8) return { bar: 'bg-yamabuki-500', text: 'text-yamabuki-600' };
    return { bar: 'bg-wakagusa-500', text: 'text-sumi-400' };
}

/**
 * バーの幅（%）を 0〜100 にクランプして返す。
 */
export function getCountBarWidth(current: number, max: number): number {
    if (max <= 0) return 0;
    return Math.min(100, Math.max(0, (current / max) * 100));
}
