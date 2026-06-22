import { describe, it, expect } from 'vitest';
import { suggestBoundariesAI } from '../../services/chapterSplit/suggestBoundariesAI';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

const settings: AISettings = {
    provider: 'local',
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1000,
    localContextLength: 1000, // budget=800 となり長文テストで複数チャンクを強制
};

describe('suggestBoundariesAI', () => {
    it('コードフェンス付きJSONを解釈し、境界を行頭スナップ済みオフセットで返す', async () => {
        const text = '前文の本文。\n第一章　出会い\n本文A。\n第二章　別れ\n本文B。';
        const run: AIRunner = async () =>
            '```json\n' +
            JSON.stringify({
                boundaries: [
                    { title: '出会い', locator: '第一章　出会い' },
                    { title: '別れ', locator: '第二章　別れ' },
                ],
            }) +
            '\n```';

        const result = await suggestBoundariesAI(text, { settings, run });
        expect(result.skipped).toBe(0);
        expect(result.boundaries).toHaveLength(2);
        expect(result.boundaries[0]).toEqual({ offset: '前文の本文。\n'.length, title: '出会い' });
        expect(text.slice(result.boundaries[1].offset)).toMatch(/^第二章/);
    });

    it('行の途中に一致するロケータは行頭にスナップされる', async () => {
        const text = '本文。\nそして第二章が始まる夜\n本文。';
        const run: AIRunner = async () =>
            JSON.stringify({ boundaries: [{ title: '', locator: '第二章が始まる夜' }] });

        const result = await suggestBoundariesAI(text, { settings, run });
        expect(result.boundaries).toHaveLength(1);
        expect(result.boundaries[0].offset).toBe('本文。\n'.length);
        // title が空ならロケータ先頭から補う
        expect(result.boundaries[0].title).toBe('第二章が始まる夜');
    });

    it('本文に無いロケータはスキップして件数を返す', async () => {
        const text = '第一章\n本文。';
        const run: AIRunner = async () =>
            JSON.stringify({
                boundaries: [
                    { title: 'a', locator: '第一章' },
                    { title: 'b', locator: '存在しない見出し' },
                ],
            });

        const result = await suggestBoundariesAI(text, { settings, run });
        expect(result.boundaries).toHaveLength(1);
        expect(result.skipped).toBe(1);
    });

    it('JSONとして読めない応答は無視する（境界0件）', async () => {
        const run: AIRunner = async () => 'すみません、わかりませんでした。';
        const result = await suggestBoundariesAI('第一章\n本文。', { settings, run });
        expect(result.boundaries).toEqual([]);
        expect(result.skipped).toBe(0);
    });

    it('長文は複数チャンクで呼ばれ、ロケータは全文オフセットに解決される', async () => {
        const chapter1 = '第一章\n' + 'あ'.repeat(700) + '\n\n';
        const chapter2 = '第二章\n' + 'い'.repeat(700) + '\n';
        const text = (chapter1 + chapter2).trim();

        let calls = 0;
        const run: AIRunner = async (prompt) => {
            calls++;
            const boundaries: Array<{ title: string; locator: string }> = [];
            if (prompt.includes('第一章')) boundaries.push({ title: '一', locator: '第一章' });
            if (prompt.includes('第二章')) boundaries.push({ title: '二', locator: '第二章' });
            return JSON.stringify({ boundaries });
        };

        const result = await suggestBoundariesAI(text, { settings, run });
        expect(calls).toBeGreaterThan(1);
        expect(result.boundaries.map(b => b.title)).toEqual(['一', '二']);
        expect(result.boundaries[0].offset).toBe(0);
        expect(text.slice(result.boundaries[1].offset)).toMatch(/^第二章/);
    });

    it('中断シグナルで AbortError を投げる', async () => {
        const controller = new AbortController();
        controller.abort();
        const run: AIRunner = async () => JSON.stringify({ boundaries: [] });
        await expect(
            suggestBoundariesAI('第一章\n本文。', { settings, run, signal: controller.signal })
        ).rejects.toThrow();
    });
});
