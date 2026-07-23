/**
 * FNV-1a ベースの軽量ハッシュ（差分判定用・暗号用途ではない）
 * シード違いの 32bit FNV-1a を2本連結して衝突耐性を確保する。
 */

const fnv1a32 = (text: string, seed: number): number => {
    let hash = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        // FNV prime 16777619 の乗算を 32bit で行う
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
};

export const fnv1a64 = (text: string): string => {
    const h1 = fnv1a32(text, 0x811c9dc5);
    const h2 = fnv1a32(text, 0x01000193);
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
};
