import { describe, it, expect } from 'vitest';
import { detectHeadings } from '../../services/chapterSplit/detectHeadings';
import {
    buildDefaultBoundaries,
    sliceByBoundaries,
    validateBoundaries,
    findLocatorOffset,
    snapToLineStart,
    PREAMBLE_TITLE,
} from '../../services/chapterSplit/splitDraft';

describe('buildDefaultBoundaries', () => {
    it('最初の見出し前の本文を「前文」章として補う', () => {
        const text = 'これは前書き。\n第一章　出会い\n本文。';
        const boundaries = buildDefaultBoundaries(text, detectHeadings(text));
        expect(boundaries).toHaveLength(2);
        expect(boundaries[0]).toEqual({ offset: 0, title: PREAMBLE_TITLE });
        expect(boundaries[1].title).toBe('第一章　出会い');
    });

    it('見出しが無ければ全文1章（タイトル空）', () => {
        const text = '見出しのない純粋な本文。\n段落が続く。';
        expect(buildDefaultBoundaries(text, detectHeadings(text))).toEqual([{ offset: 0, title: '' }]);
    });

    it('先頭行が見出しなら前文章を作らない', () => {
        const text = '第一章\n本文。\n第二章\n本文。';
        const boundaries = buildDefaultBoundaries(text, detectHeadings(text));
        expect(boundaries.map(b => b.title)).toEqual(['第一章', '第二章']);
        expect(boundaries[0].offset).toBe(0);
    });
});

describe('sliceByBoundaries', () => {
    it('逐語不変条件: join("") === 原文（見出し行はbodyに残る）', () => {
        const text = '前書き。\n第一章　出会い\n本文A。\n第二章　別れ\n本文B。';
        const boundaries = buildDefaultBoundaries(text, detectHeadings(text));
        const slices = sliceByBoundaries(text, boundaries);
        expect(slices.map(s => s.draft).join('')).toBe(text);
        expect(slices[1].draft).toContain('第一章　出会い');
    });

    it('絵文字・サロゲートペアを含む本文でも逐語一致する', () => {
        const text = '🎉前書き𠮷田の話。\n第一章\n絵文字🚀本文。\n第二章\n𩸽を食べた。';
        const boundaries = buildDefaultBoundaries(text, detectHeadings(text));
        const slices = sliceByBoundaries(text, boundaries);
        expect(slices.map(s => s.draft).join('')).toBe(text);
    });

    it('末尾改行を含む本文でも逐語一致する', () => {
        const text = '第一章\n本文。\n第二章\n本文。\n\n';
        const boundaries = buildDefaultBoundaries(text, detectHeadings(text));
        const slices = sliceByBoundaries(text, boundaries);
        expect(slices.map(s => s.draft).join('')).toBe(text);
    });
});

describe('validateBoundaries', () => {
    const text = 'ABC\nDEF\nGHI';

    it('正常な境界はエラーなし', () => {
        expect(validateBoundaries(text, [{ offset: 0, title: 'a' }, { offset: 4, title: 'b' }])).toEqual([]);
    });

    it('空リスト・先頭が0でない・範囲外・行頭でない・逆順/重複を検出する', () => {
        expect(validateBoundaries(text, []).length).toBe(1);
        expect(validateBoundaries(text, [{ offset: 4, title: '' }]).length).toBeGreaterThan(0);
        expect(validateBoundaries(text, [{ offset: 0, title: '' }, { offset: 99, title: '' }]).length).toBeGreaterThan(0);
        // offset 2 は行の途中（'C' の位置）
        expect(validateBoundaries(text, [{ offset: 0, title: '' }, { offset: 2, title: '' }]).length).toBeGreaterThan(0);
        expect(
            validateBoundaries(text, [
                { offset: 0, title: '' },
                { offset: 8, title: '' },
                { offset: 4, title: '' },
            ]).length
        ).toBeGreaterThan(0);
        expect(
            validateBoundaries(text, [{ offset: 0, title: '' }, { offset: 4, title: '' }, { offset: 4, title: '' }]).length
        ).toBeGreaterThan(0);
    });
});

describe('snapToLineStart', () => {
    const text = 'ABC\nDEF\nGHI';

    it('行の途中のオフセットを直前の行頭へスナップする', () => {
        expect(snapToLineStart(text, 6)).toBe(4);
        expect(snapToLineStart(text, 4)).toBe(4);
        expect(snapToLineStart(text, 2)).toBe(0);
        expect(snapToLineStart(text, 0)).toBe(0);
    });

    it('範囲外はクランプする', () => {
        expect(snapToLineStart(text, -5)).toBe(0);
        expect(snapToLineStart(text, 999)).toBe(8);
    });
});

describe('findLocatorOffset', () => {
    it('完全一致を indexOf で見つける', () => {
        const text = '前文。\n第一章　出会い\n本文。';
        expect(findLocatorOffset(text, '第一章　出会い')).toBe(4);
    });

    it('同名見出しは fromOffset で次の出現を解決する', () => {
        const text = '幕間\nA。\n幕間\nB。';
        const first = findLocatorOffset(text, '幕間');
        expect(first).toBe(0);
        const second = findLocatorOffset(text, '幕間', first + 1);
        expect(second).toBe('幕間\nA。\n'.length);
    });

    it('空白の揺れ（全角→半角）を空白無視の行比較で救済する', () => {
        const text = '本文。\n　　第二章　旅立ち\n本文。';
        // AIが全角空白を半角に変えて返したケース（indexOf では見つからない）
        const offset = findLocatorOffset(text, '第二章 旅立ち');
        expect(offset).toBe('本文。\n'.length);
    });

    it('本文に無いロケータは -1', () => {
        expect(findLocatorOffset('本文だけ。', '存在しない章')).toBe(-1);
        expect(findLocatorOffset('本文だけ。', '')).toBe(-1);
    });
});
