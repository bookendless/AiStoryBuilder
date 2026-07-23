import { describe, it, expect } from 'vitest';
import { buildBm25Index } from '../../../services/rag/bm25';
import { RagChunk } from '../../../services/rag/types';

const makeChunk = (id: string, text: string, label = ''): RagChunk => ({
    id,
    projectId: 'p1',
    sourceType: 'chapterDraft',
    sourceId: id,
    sourceKey: `chapterDraft:${id}`,
    chunkIndex: 0,
    label,
    text,
    contentHash: 'h',
    updatedAt: 0,
});

describe('buildBm25Index', () => {
    it('クエリに関連するチャンクが上位に来る', () => {
        const index = buildBm25Index([
            makeChunk('a', '彼は魔法学院の門をくぐった。入学式の朝だった。'),
            makeChunk('b', '海辺の町で漁師たちが網を引いていた。'),
            makeChunk('c', '剣術の稽古が中庭で行われていた。'),
        ]);
        const results = index.search('魔法学院の入学式', 10);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].id).toBe('a');
    });

    it('一致しないクエリは結果を返さない', () => {
        const index = buildBm25Index([makeChunk('a', '海辺の町の物語')]);
        expect(index.search('宇宙船エンジン', 10)).toEqual([]);
    });

    it('ラベルも検索対象になる', () => {
        const index = buildBm25Index([
            makeChunk('a', '無関係な本文テキスト', 'キャラクター: 田中太郎'),
            makeChunk('b', '別の無関係テキスト', ''),
        ]);
        const results = index.search('田中太郎', 10);
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('a');
    });

    it('topK 件数で打ち切る', () => {
        const chunks = Array.from({ length: 10 }, (_, i) => makeChunk(`c${i}`, `魔法の話 その${i}`));
        const index = buildBm25Index(chunks);
        expect(index.search('魔法', 3).length).toBe(3);
    });

    it('空インデックスで検索してもエラーにならない', () => {
        const index = buildBm25Index([]);
        expect(index.search('魔法', 10)).toEqual([]);
    });
});
