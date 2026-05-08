/**
 * キャラクターアバター用の決定論的カラー選定ユーティリティ。
 * 名前から安定したハッシュを生成し、固定パレットの色を返す。
 */

const AVATAR_COLORS = [
    '#f97316', // orange-500
    '#3b82f6', // blue-500
    '#22c55e', // green-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
] as const;

export function getAvatarColor(name: string | null | undefined): string {
    if (!name) return AVATAR_COLORS[0];
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * 表示用の頭文字を取り出す（空名は「？」）。
 */
export function getAvatarInitial(name: string | null | undefined): string {
    if (!name) return '？';
    const trimmed = name.trim();
    if (!trimmed) return '？';
    return [...trimmed][0] ?? '？';
}
