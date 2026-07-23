import { describe, it, expect, beforeEach } from 'vitest';
import { retrieveForDraft, retrieveForContinue, retrieveRecapSummaries, buildDraftQuery } from '../../../services/rag/retrieval';
import { ensureIndexFresh } from '../../../services/rag/indexer';
import { MemoryRagStore } from '../../../services/rag/ragStore';
import { clearBm25Cache } from '../../../services/rag/bm25';
import { makeProject, makeChapter, makeCharacter } from './fixtures';

describe('buildDraftQuery', () => {
    it('章メタ情報と割当キャラ名を連結する', () => {
        const project = makeProject({
            id: 'p1',
            characters: [makeCharacter({ id: 'c1', name: '太郎' })],
        });
        const chapter = makeChapter({
            id: 'ch1',
            title: '決戦',
            summary: '塔での戦い',
            keyEvents: ['魔王との対峙'],
            setting: '古の塔',
            mood: '緊迫',
            characters: ['c1'],
        });
        const query = buildDraftQuery(project, chapter);
        expect(query).toContain('決戦');
        expect(query).toContain('魔王との対峙');
        expect(query).toContain('太郎');
    });
});

describe('retrieveForDraft', () => {
    beforeEach(() => clearBm25Cache());

    const project = makeProject({
        id: 'p1',
        chapters: [
            makeChapter({ id: 'ch1', title: '出会い', summary: '主人公が魔法学院で賢者と出会う', draft: '魔法学院の門前で、老いた賢者が主人公を待っていた。' }),
            makeChapter({ id: 'ch2', title: '修行', summary: '山での修行の日々', draft: '山中での厳しい修行が続いた。' }),
            makeChapter({ id: 'ch3', title: '決戦', summary: '魔法学院での最終決戦' }),
            makeChapter({ id: 'ch4', title: '未来の章', summary: '魔法学院のその後の物語' }),
        ],
        characters: [makeCharacter({ id: 'c1', name: '賢者', personality: '魔法学院の長老' })],
        worldSettings: [{
            id: 'w1', category: 'magic', title: '魔法学院', content: '大陸最古の魔法教育機関。入学には資質試験がある。',
            createdAt: new Date(), updatedAt: new Date(),
        }],
    });

    it('関連チャンクが検索され、生成対象章と未来章は除外される', async () => {
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);

        const retrieved = await retrieveForDraft(project, project.chapters[2], store);
        expect(retrieved.length).toBeGreaterThan(0);

        for (const { chunk } of retrieved) {
            if (chunk.sourceType === 'chapterDraft' || chunk.sourceType === 'chapterSummary') {
                // ch3（生成対象）と ch4（未来章）は含まれない
                expect(['ch1', 'ch2']).toContain(chunk.sourceId);
            }
        }
    });

    it('世界観設定・キャラクターも候補に入る', async () => {
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);

        const retrieved = await retrieveForDraft(project, project.chapters[2], store);
        const types = retrieved.map((r) => r.chunk.sourceType);
        expect(types).toContain('worldSetting');
        expect(types).toContain('character');
    });

    it('インデックスが空なら空配列を返す', async () => {
        const store = new MemoryRagStore();
        const retrieved = await retrieveForDraft(project, project.chapters[2], store);
        expect(retrieved).toEqual([]);
    });
});

describe('retrieveForContinue', () => {
    beforeEach(() => clearBm25Cache());

    it('草案末尾の内容がクエリに効き、章メタに無い関連設定も拾う', async () => {
        const project = makeProject({
            id: 'p2',
            chapters: [
                makeChapter({ id: 'ch1', title: '旅立ち', summary: '村を出る' }),
                makeChapter({ id: 'ch2', title: '道中', summary: '街道を進む' }),
            ],
            worldSettings: [{
                id: 'w1', category: 'geography', title: '竜の湖', content: '底に古代竜が眠ると伝わる湖。水面は常に凪いでいる。',
                createdAt: new Date(), updatedAt: new Date(),
            }],
        });
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);

        // 章メタ（道中/街道）は湖に触れないが、草案末尾が竜の湖に言及している
        const draft = '一行は歩き続けた。やがて視界が開け、竜の湖のほとりに出た。';
        const retrieved = await retrieveForContinue(project, project.chapters[1], draft, store);
        expect(retrieved.some((r) => r.chunk.sourceId === 'w1')).toBe(true);
    });

    it('未来章は除外される', async () => {
        const project = makeProject({
            id: 'p3',
            chapters: [
                makeChapter({ id: 'ch1', title: '一章', summary: '魔法の話', draft: '魔法の修行をした。' }),
                makeChapter({ id: 'ch2', title: '二章', summary: '執筆中の章' }),
                makeChapter({ id: 'ch3', title: '三章', summary: '魔法の最終決戦' }),
            ],
        });
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);

        const retrieved = await retrieveForContinue(project, project.chapters[1], '魔法について考えた。', store);
        for (const { chunk } of retrieved) {
            expect(chunk.sourceId).not.toBe('ch3');
            expect(chunk.sourceId).not.toBe('ch2');
        }
    });
});

describe('retrieveRecapSummaries', () => {
    beforeEach(() => clearBm25Cache());

    it('章あらすじのみを関連度順で返す（未来章の除外なし）', async () => {
        const project = makeProject({
            id: 'p4',
            chapters: [
                makeChapter({ id: 'ch1', title: '一章', summary: '海辺の町の日常', draft: '海辺の本文' }),
                makeChapter({ id: 'ch2', title: '二章', summary: '魔法学院への入学' }),
                makeChapter({ id: 'ch3', title: '三章', summary: '魔法学院での試験' }),
            ],
            characters: [makeCharacter({ id: 'c1', name: '賢者', personality: '魔法学院の長老' })],
        });
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);

        const ranked = await retrieveRecapSummaries(project, '魔法学院', store);
        expect(ranked.length).toBe(2);
        expect(ranked.every((r) => r.chunk.sourceType === 'chapterSummary')).toBe(true);
        expect(ranked.map((r) => r.chunk.sourceId).sort()).toEqual(['ch2', 'ch3']);
    });

    it('該当チャンクが無ければ空配列', async () => {
        const project = makeProject({ id: 'p5' });
        const store = new MemoryRagStore();
        await ensureIndexFresh(project, store);
        expect(await retrieveRecapSummaries(project, '何か', store)).toEqual([]);
    });
});
