import { describe, it, expect } from 'vitest';
import {
    reciprocalRankFusion,
    selectWithQuotas,
    joinWithOverlap,
    mergeAdjacent,
} from '../../../services/rag/fusion';
import { RagChunk, RetrievedChunk, RagSourceType } from '../../../services/rag/types';

const makeChunk = (
    id: string,
    sourceType: RagSourceType = 'chapterDraft',
    overrides: Partial<RagChunk> = {}
): RagChunk => ({
    id,
    projectId: 'p1',
    sourceType,
    sourceId: id,
    sourceKey: `${sourceType}:${id}`,
    chunkIndex: 0,
    label: id,
    text: `text of ${id}`,
    contentHash: 'h',
    updatedAt: 0,
    ...overrides,
});

describe('reciprocalRankFusion', () => {
    it('単一ランキングでは元の順序を保つ', () => {
        const chunks = new Map([
            ['a', makeChunk('a')],
            ['b', makeChunk('b')],
        ]);
        const fused = reciprocalRankFusion([['a', 'b']], chunks);
        expect(fused.map((f) => f.chunk.id)).toEqual(['a', 'b']);
    });

    it('複数ランキングで両方に出現するチャンクが優位になる', () => {
        const chunks = new Map([
            ['a', makeChunk('a')],
            ['b', makeChunk('b')],
            ['c', makeChunk('c')],
        ]);
        // b は両ランキングの2位、a と c は片方の1位のみ
        const fused = reciprocalRankFusion([['a', 'b'], ['c', 'b']], chunks);
        expect(fused[0].chunk.id).toBe('b');
    });

    it('チャンク実体が無いIDは無視される', () => {
        const chunks = new Map([['a', makeChunk('a')]]);
        const fused = reciprocalRankFusion([['a', 'ghost']], chunks);
        expect(fused.length).toBe(1);
    });
});

describe('selectWithQuotas', () => {
    it('下位でも quota 対象タイプは確保される', () => {
        const fused: RetrievedChunk[] = [
            ...Array.from({ length: 30 }, (_, i) => ({
                chunk: makeChunk(`draft${i}`, 'chapterDraft'),
                score: 1 - i * 0.01,
            })),
            { chunk: makeChunk('world1', 'worldSetting'), score: 0.1 },
            { chunk: makeChunk('term1', 'glossary'), score: 0.05 },
        ];
        const selected = selectWithQuotas(fused, 10);
        const types = selected.map((s) => s.chunk.sourceType);
        expect(types).toContain('worldSetting');
        expect(types).toContain('glossary');
        expect(selected.length).toBe(10);
    });

    it('maxSelected を超えない', () => {
        const fused: RetrievedChunk[] = Array.from({ length: 50 }, (_, i) => ({
            chunk: makeChunk(`c${i}`),
            score: 1 - i * 0.01,
        }));
        expect(selectWithQuotas(fused, 5).length).toBe(5);
    });
});

describe('joinWithOverlap', () => {
    it('オーバーラップ部分を吸収して結合する', () => {
        const a = 'これは最初の文章です。共通の部分がここにある。';
        const b = '共通の部分がここにある。そして続きの文章。';
        expect(joinWithOverlap(a, b)).toBe(
            'これは最初の文章です。共通の部分がここにある。そして続きの文章。'
        );
    });

    it('重複が無ければ改行で連結する', () => {
        expect(joinWithOverlap('アアアアアアアアアアアア', 'イイイイイイイイイイイイ')).toBe(
            'アアアアアアアアアアアア\nイイイイイイイイイイイイ'
        );
    });
});

describe('mergeAdjacent', () => {
    it('同一ソースの連続チャンクをマージする', () => {
        const selected: RetrievedChunk[] = [
            { chunk: makeChunk('s:0', 'chapterDraft', { sourceKey: 'chapterDraft:s', chunkIndex: 0, text: '前半部分の本文。つなぎ目の共通テキスト。' }), score: 0.9 },
            { chunk: makeChunk('s:1', 'chapterDraft', { sourceKey: 'chapterDraft:s', chunkIndex: 1, text: 'つなぎ目の共通テキスト。後半部分の本文。' }), score: 0.5 },
        ];
        const merged = mergeAdjacent(selected);
        expect(merged.length).toBe(1);
        expect(merged[0].chunk.text).toBe('前半部分の本文。つなぎ目の共通テキスト。後半部分の本文。');
        expect(merged[0].score).toBe(0.9);
    });

    it('連続しないチャンクはマージしない', () => {
        const selected: RetrievedChunk[] = [
            { chunk: makeChunk('s:0', 'chapterDraft', { sourceKey: 'chapterDraft:s', chunkIndex: 0 }), score: 0.9 },
            { chunk: makeChunk('s:2', 'chapterDraft', { sourceKey: 'chapterDraft:s', chunkIndex: 2 }), score: 0.5 },
        ];
        expect(mergeAdjacent(selected).length).toBe(2);
    });
});
