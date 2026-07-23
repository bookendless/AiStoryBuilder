import { describe, it, expect } from 'vitest';
import { buildDraftContext, truncateAtSentence } from '../../../services/rag/buildDraftContext';
import { RagChunk, RagSourceType, RetrievedChunk } from '../../../services/rag/types';
import { makeProject, makeChapter, makeCharacter } from './fixtures';

const makeRetrieved = (
    id: string,
    sourceType: RagSourceType,
    text: string,
    label = id,
    score = 0.5
): RetrievedChunk => ({
    score,
    chunk: {
        id,
        projectId: 'p1',
        sourceType,
        sourceId: id,
        sourceKey: `${sourceType}:${id}`,
        chunkIndex: 0,
        label,
        text,
        contentHash: 'h',
        updatedAt: 0,
    } as RagChunk,
});

const longSummary = (seed: string): string => `${seed}。`.repeat(80); // 約400-800文字

describe('truncateAtSentence', () => {
    it('上限以内ならそのまま返す', () => {
        expect(truncateAtSentence('短い文。', 100)).toBe('短い文。');
    });

    it('文境界で切り詰める', () => {
        const result = truncateAtSentence('一つ目の文。二つ目の文。三つ目の文。', 15);
        expect(result).toBe('一つ目の文。二つ目の文。');
    });
});

describe('buildDraftContext', () => {
    const bigProject = makeProject({
        id: 'p1',
        chapters: [
            ...Array.from({ length: 15 }, (_, i) =>
                makeChapter({ id: `ch${i + 1}`, title: `章${i + 1}`, summary: longSummary(`第${i + 1}章の出来事`) })
            ),
            makeChapter({ id: 'target', title: '生成対象', summary: '対象章', characters: ['c1'] }),
        ],
        characters: [
            makeCharacter({ id: 'c1', name: '主人公', personality: '勇敢', background: '村の出身' }),
            makeCharacter({ id: 'c2', name: '脇役', personality: '臆病' }),
        ],
    });
    const targetChapter = bigProject.chapters[15];

    const retrieved = [
        makeRetrieved('ch2sum', 'chapterSummary', '第2章で主人公は剣を手に入れた。', '第2章「章2」(あらすじ)', 0.9),
        makeRetrieved('c2', 'character', '脇役 (友人)\n  性格: 臆病', 'キャラクター: 脇役', 0.7),
        makeRetrieved('w1', 'worldSetting', '王都の構造。城壁に囲まれた三層都市。', '設定: 王都', 0.6),
        makeRetrieved('g1', 'glossary', '聖剣: 伝説の武器。', '用語: 聖剣', 0.5),
        makeRetrieved('f1', 'foreshadowing', '伏線「古い指輪」（設置済み・未回収）\n祖父の遺品', '伏線: 古い指輪', 0.4),
    ];

    it('大規模プロジェクトではRAGコンテキストが構築される', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        });
        expect(ctx).not.toBeNull();
    });

    it('合計が予算内に収まる', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        })!;
        const total =
            ctx.previousStory.length +
            ctx.projectCharacters.length +
            ctx.worldSettings.length +
            ctx.glossary.length;
        expect(total).toBeLessThanOrEqual(8500 - 1000);
    });

    it('割当キャラは全文で強制包含される', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        })!;
        expect(ctx.projectCharacters).toContain('主人公');
        expect(ctx.projectCharacters).toContain('村の出身');
    });

    it('直前章のあらすじが previousStory の先頭に入る', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        })!;
        expect(ctx.previousStory).toContain('第15章「章15」（直前の章）');
    });

    it('伏線は previousStory に【】マーカー付きで入る', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        })!;
        expect(ctx.previousStory).toContain('【この章に関連する伏線】');
    });

    it('出力に <> を含まない（サニタイザ互換）', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 8500,
            previousChapterEndLength: 1000,
        })!;
        const all = ctx.previousStory + ctx.projectCharacters + ctx.worldSettings + ctx.glossary;
        expect(all).not.toMatch(/[<>]/);
    });

    it('小規模プロジェクト（全量が予算内）では null を返しフォールバックさせる', () => {
        const smallProject = makeProject({
            id: 'p2',
            chapters: [
                makeChapter({ id: 'ch1', title: '一章', summary: '短いあらすじ' }),
                makeChapter({ id: 'target', title: '対象', summary: '対象章' }),
            ],
            characters: [makeCharacter({ id: 'c1', name: '主人公' })],
        });
        const ctx = buildDraftContext({
            project: smallProject,
            currentChapter: smallProject.chapters[1],
            retrieved: [],
            budget: 8500,
            previousChapterEndLength: 0,
        });
        expect(ctx).toBeNull();
    });

    it('予算が極端に小さくても最低限のコンテキストを返す', () => {
        const ctx = buildDraftContext({
            project: bigProject,
            currentChapter: targetChapter,
            retrieved,
            budget: 800,
            previousChapterEndLength: 1000,
        });
        expect(ctx).not.toBeNull();
    });
});
