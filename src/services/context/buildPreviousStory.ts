/**
 * 「前章までのあらすじ」の予算つき組み立て
 *
 * 以前は前の全章の summary を無制限に連結していた。章が増えるほどここだけが肥大し、
 * プロンプト全体のCAPに当たると中抜きで**途中の章がまるごと消える**（しかも消えたことは
 * 表に出ない）。ここで明示的に予算配分すれば、何を残して何を削ったかが決定的になる。
 *
 * 記憶3層の考え方に沿って、直近ほど厚く、古いほど薄くする:
 *   1. 直近2章 … あらすじ全文（次章の書き出しに直接効く）
 *   2. それ以前 … 各120字に圧縮
 *   3. 予算超過分 … 古い章から順に「第N章「タイトル」」だけに落とす
 *
 * 章の順序と番号は常に保つ。抜けを作らず薄くしていくことで、
 * AIが「その章は存在しない」と誤解するのを防ぐ。
 */

import { Chapter } from '../../types/project/chapter';
import { truncateAtSentence } from '../../utils/textTruncate';

/** あらすじを全文のまま残す直近の章数 */
export const RECENT_FULL_CHAPTERS = 2;
/** それ以前の章のあらすじの圧縮先 */
export const OLDER_SUMMARY_CHARS = 120;
/** 「前章までのあらすじ」全体の文字数予算 */
export const PREVIOUS_STORY_BUDGET = 3000;

const NO_SUMMARY = '（あらすじなし）';

const titleOnlyLine = (chapter: Chapter, number: number): string =>
    `第${number}章「${chapter.title}」`;

const summaryLine = (chapter: Chapter, number: number, maxChars: number | null): string => {
    const summary = (chapter.summary ?? '').trim();
    if (!summary) return `${titleOnlyLine(chapter, number)}\nあらすじ: ${NO_SUMMARY}`;
    const body = maxChars === null ? summary : truncateAtSentence(summary, maxChars);
    return `${titleOnlyLine(chapter, number)}\nあらすじ: ${body}`;
};

/**
 * 現在の章より前の章から「前章までのあらすじ」を組み立てる。
 *
 * @param chapters 作品の全章（順序どおり）
 * @param currentIndex 生成対象の章の位置。0 なら前章が無いので空文字を返す
 * @returns 連結済みの文字列（前章が無ければ空文字。呼び出し側で「これが最初の章です。」等に置き換える）
 */
export function buildPreviousStory(
    chapters: Chapter[],
    currentIndex: number,
    budget: number = PREVIOUS_STORY_BUDGET
): string {
    const previous = chapters.slice(0, Math.max(0, currentIndex));
    if (previous.length === 0) return '';

    // 直近 RECENT_FULL_CHAPTERS 章は全文、それ以前は圧縮
    const recentFrom = Math.max(0, previous.length - RECENT_FULL_CHAPTERS);
    const lines = previous.map((chapter, index) =>
        summaryLine(chapter, index + 1, index >= recentFrom ? null : OLDER_SUMMARY_CHARS)
    );

    const joinedLength = (parts: string[]): number =>
        parts.reduce((sum, part) => sum + part.length, 0) + Math.max(0, parts.length - 1) * 2;

    // 予算を超えている間、古い章から順にタイトルだけへ落とす。
    // 直近の章まで削ると接続の手がかりが消えるため、最後の1章は必ずあらすじを残す
    for (let i = 0; i < lines.length - 1 && joinedLength(lines) > budget; i++) {
        lines[i] = titleOnlyLine(previous[i], i + 1);
    }

    return lines.join('\n\n');
}
