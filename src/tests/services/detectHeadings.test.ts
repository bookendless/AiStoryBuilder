import { describe, it, expect } from 'vitest';
import { detectHeadings } from '../../services/chapterSplit/detectHeadings';

describe('detectHeadings', () => {
    it('「第」あり見出しを検出する（第3章 / 第三話）', () => {
        const text = '第3章\n本文。\n第三話\n本文。';
        const titles = detectHeadings(text).map(h => h.title);
        expect(titles).toEqual(['第3章', '第三話']);
    });

    it('「第」なし見出しを検出する（一話　/ ０１章 / 02章）', () => {
        const text = '一話　出会い\n本文。\n０１章\n本文。\n02章 The Beginning\n本文。';
        const titles = detectHeadings(text).map(h => h.title);
        expect(titles).toEqual(['一話　出会い', '０１章', '02章 The Beginning']);
    });

    it('話数物の「番号＋全角空白＋タイトル」を検出する（？！終わりも見出しとして許容）', () => {
        const text = '００　入学前の疑惑？\n本文。\n０１　決戦だ！\n本文。';
        const titles = detectHeadings(text).map(h => h.title);
        expect(titles).toEqual(['００　入学前の疑惑？', '０１　決戦だ！']);
    });

    it('数字のみの行・全角空白なしの番号行は見出しとしない', () => {
        const text = '１\n本文。\n２２\n本文。\n100人の村人がいた\n本文。';
        expect(detectHeadings(text)).toEqual([]);
    });

    it('markdown見出しを検出する（### 第5章 / ## タイトルのみ）', () => {
        const text = '### 第5章\n本文。\n## 出会いの夜\n本文。';
        const matches = detectHeadings(text);
        expect(matches.map(h => h.title)).toEqual(['第5章', '出会いの夜']);
        // rawLine は # 込みで保持（章bodyに残すため）
        expect(matches[0].rawLine).toBe('### 第5章');
    });

    it('特殊見出しを検出する（プロローグ / 序章　… / エピローグ）', () => {
        const text = 'プロローグ\n本文。\n序章　始まりの朝\n本文。\nエピローグ\n本文。';
        const titles = detectHeadings(text).map(h => h.title);
        expect(titles).toEqual(['プロローグ', '序章　始まりの朝', 'エピローグ']);
    });

    it('シーン区切り記号は既定では検出しない（◇◆◇ / *** / === / --- / ＊＊＊）', () => {
        const text = '本文。\n◇◆◇\n本文。\n***\n本文。\n===\n本文。\n---\n本文。\n＊＊＊\n本文。';
        expect(detectHeadings(text)).toEqual([]);
    });

    it('includeSceneBreaks 指定時はシーン区切りを kind:scene-break で返す', () => {
        const text = '本文。\n◇◆◇\n本文。\n＊　＊　＊\n本文。';
        const matches = detectHeadings(text, { includeSceneBreaks: true });
        expect(matches).toHaveLength(2);
        expect(matches.every(m => m.kind === 'scene-break')).toBe(true);
    });

    it('文中の数詞・本文行を見出しと誤検出しない', () => {
        const text = [
            '三話まで読んだ',       // 単位の直後に区切りがない
            '一日が終わった',       // 単位が対象外
            '彼は第三章を開いた。',  // 文末の句点
            '「第三章だな」',       // 台詞（「 で始まる）
            'この章は長い',         // 番号がない
        ].join('\n');
        expect(detectHeadings(text)).toEqual([]);
    });

    it('30文字を超える行は見出しとしない', () => {
        const long = '第一章　' + 'あ'.repeat(30);
        expect(detectHeadings(long)).toEqual([]);
    });

    it('offset は常に行頭を指す', () => {
        const text = '前文。\n第一章　出会い\n本文。';
        const matches = detectHeadings(text);
        expect(matches).toHaveLength(1);
        expect(matches[0].lineIndex).toBe(1);
        expect(matches[0].offset).toBe('前文。\n'.length);
        expect(text.slice(matches[0].offset)).toMatch(/^第一章/);
    });
});
