/**
 * 章ドラフトの逐語分割ロジック
 *
 * 不変条件: 分割結果の draft を連結すると元テキストと完全一致する
 * （`slices.map(s => s.draft).join('') === text`）。AIや整形を一切通さない
 * char オフセットの連続スライスでこれを保証する。
 *
 * 境界（SplitBoundary.offset）は常に「行頭」（位置0 か `\n` の直後）に置く。
 * これによりサロゲートペアや書記素の途中で本文が割れることはない。
 */

import { HeadingMatch } from './detectHeadings';

export interface SplitBoundary {
    /** 章の開始位置（全文中の char オフセット。常に行頭） */
    offset: number;
    /** 章タイトル（ユーザー編集可） */
    title: string;
}

export interface DraftSlice {
    title: string;
    /** 逐語スライス（見出し行も含む） */
    draft: string;
}

/** 前文（最初の見出しより前の本文）に与える既定タイトル */
export const PREAMBLE_TITLE = '前文';

/**
 * 見出し検出結果から既定の境界リストを作る。
 * - 先頭（offset 0）に見出しが無い場合、前文を独立した先頭章として補う（取りこぼし防止）
 * - 見出しが1つも無い場合は全文1章（タイトルは空文字 = 呼び出し側で章名等を補う）
 */
export function buildDefaultBoundaries(text: string, headings: HeadingMatch[]): SplitBoundary[] {
    if (!text) return [];
    const sorted = [...headings].sort((a, b) => a.offset - b.offset);

    if (sorted.length === 0) {
        return [{ offset: 0, title: '' }];
    }

    const boundaries: SplitBoundary[] = sorted.map(h => ({ offset: h.offset, title: h.title }));
    if (boundaries[0].offset !== 0) {
        // 先頭見出しより前にある本文（前書き等）を先頭章として保全する
        boundaries.unshift({ offset: 0, title: PREAMBLE_TITLE });
    }
    return boundaries;
}

/**
 * 境界で本文を逐語スライスする。境界は validateBoundaries で検証済みであること。
 */
export function sliceByBoundaries(text: string, boundaries: SplitBoundary[]): DraftSlice[] {
    return boundaries.map((b, i) => {
        const end = i + 1 < boundaries.length ? boundaries[i + 1].offset : text.length;
        return { title: b.title, draft: text.slice(b.offset, end) };
    });
}

/**
 * 境界リストを検証し、日本語のエラーメッセージ配列を返す（空配列なら有効）。
 */
export function validateBoundaries(text: string, boundaries: SplitBoundary[]): string[] {
    const errors: string[] = [];

    if (boundaries.length === 0) {
        errors.push('分割位置がありません。');
        return errors;
    }
    if (boundaries[0].offset !== 0) {
        errors.push('先頭の章は本文の先頭（位置0）から始まる必要があります。');
    }

    for (let i = 0; i < boundaries.length; i++) {
        const b = boundaries[i];
        if (b.offset < 0 || b.offset >= text.length) {
            errors.push(`${i + 1}番目の分割位置が本文の範囲外です。`);
            continue;
        }
        if (b.offset > 0 && text[b.offset - 1] !== '\n') {
            errors.push(`${i + 1}番目の分割位置が行頭ではありません。`);
        }
        if (i > 0 && b.offset <= boundaries[i - 1].offset) {
            errors.push(`${i + 1}番目の分割位置が直前の位置と重複または逆順です。`);
        }
    }

    return errors;
}

/**
 * 任意のオフセットを直前の行頭にスナップする。
 */
export function snapToLineStart(text: string, offset: number): number {
    const clamped = Math.max(0, Math.min(offset, text.length));
    if (clamped === 0) return 0;
    return text.lastIndexOf('\n', clamped - 1) + 1;
}

/** 空白（半角/全角）を除去した比較キー（AIの空白揺れ救済用） */
function stripWhitespace(s: string): string {
    return s.replace(/[\s\u3000]+/g, '');
}

/**
 * AIが返したロケータ（章冒頭の逐語文字列）を本文中のオフセットに解決する。
 * 1. fromOffset 以降の indexOf で完全一致を探す
 * 2. 見つからなければ、行単位で空白を無視した比較で探す
 *    （AIが全角空白を半角にする・行をまたいで連結する等の揺れを救済）
 * 見つからない場合は -1（呼び出し側でスキップ）。
 */
export function findLocatorOffset(text: string, locator: string, fromOffset: number = 0): number {
    const needle = (locator || '').trim();
    if (!needle) return -1;

    const start = Math.max(0, fromOffset);
    const exact = text.indexOf(needle, start);
    if (exact !== -1) return exact;

    // フォールバック: 空白を無視した行単位の比較
    const needleKey = stripWhitespace(needle);
    if (!needleKey) return -1;

    let lineStart = snapToLineStart(text, start);
    while (lineStart < text.length) {
        const lineEnd = text.indexOf('\n', lineStart);
        const end = lineEnd === -1 ? text.length : lineEnd;
        if (end > start) {
            const lineKey = stripWhitespace(text.slice(lineStart, end));
            if (lineKey && (lineKey === needleKey || lineKey.startsWith(needleKey) || needleKey.startsWith(lineKey))) {
                return lineStart;
            }
        }
        if (lineEnd === -1) break;
        lineStart = lineEnd + 1;
    }
    return -1;
}
