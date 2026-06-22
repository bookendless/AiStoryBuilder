import { describe, it, expect } from 'vitest';
import { chunkProse } from '../../services/import/chunkProse';

describe('chunkProse', () => {
    it('空文字は空配列を返す', () => {
        expect(chunkProse('', 1000)).toEqual([]);
        expect(chunkProse('   \n  ', 1000)).toEqual([]);
    });

    it('予算以内のテキストは1チャンクにまとめる', () => {
        const text = 'これは短い小説本文です。';
        const chunks = chunkProse(text, 1000);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe(text);
        expect(chunks[0].index).toBe(0);
    });

    it('予算を超えるテキストは複数チャンクに分割し、各チャンクは予算以内', () => {
        // 段落を多数連結して予算を超える本文を作る
        const para = 'あ'.repeat(80) + '。\n\n';
        const text = para.repeat(40); // 約 3320 文字
        const budget = 800;
        const chunks = chunkProse(text, budget);

        expect(chunks.length).toBeGreaterThan(1);
        for (const c of chunks) {
            // オーバーラップ込みでも予算を大きく超えない
            expect(c.text.length).toBeLessThanOrEqual(budget);
            expect(c.text.length).toBeGreaterThan(0);
        }
        // index は連番
        chunks.forEach((c, i) => expect(c.index).toBe(i));
    });

    it('段落境界がない長文でも無限ループせず分割できる', () => {
        const text = 'あ'.repeat(5000); // 改行も句点もない
        const chunks = chunkProse(text, 1000);
        expect(chunks.length).toBeGreaterThan(1);
        // 全チャンクを結合すると元の文字をすべて含む（オーバーラップで重複はあり得る）
        const joined = chunks.map(c => c.text).join('');
        expect(joined.length).toBeGreaterThanOrEqual(text.length);
    });

    it('連続するチャンクはオーバーラップして文脈の断絶を緩和する', () => {
        const text = 'あ'.repeat(5000);
        const overlap = 100;
        const chunks = chunkProse(text, 1000, overlap);
        expect(chunks.length).toBeGreaterThan(1);
        // オーバーラップがあるため、全チャンク長の合計は元テキストより長くなる
        const totalLen = chunks.reduce((sum, c) => sum + c.text.length, 0);
        expect(totalLen).toBeGreaterThan(text.length);
    });

    it('CRのみ（lone \\r）改行でも段落境界で分割できる（1行化しない）', () => {
        const head = 'a'.repeat(600);
        const tail = 'b'.repeat(600);
        // \r\r = CRのみの空行（正規化後 \n\n の段落境界になる）
        const text = `${head}\r\r${tail}`;
        const chunks = chunkProse(text, 1000);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks[0].text).toBe(head);
        // \r がチャンクに残らない
        for (const c of chunks) {
            expect(c.text).not.toContain('\r');
        }
    });

    it('段落境界を優先して切る', () => {
        const head = 'a'.repeat(600);
        const tail = 'b'.repeat(600);
        const text = `${head}\n\n${tail}`;
        const chunks = chunkProse(text, 1000);
        expect(chunks.length).toBeGreaterThan(1);
        // 最初のチャンクは段落境界（head 部分）で切れる
        expect(chunks[0].text).toBe(head);
    });
});
