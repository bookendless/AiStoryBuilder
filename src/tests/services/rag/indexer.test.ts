import { describe, it, expect } from 'vitest';
import { ensureIndexFresh, reindexProject, deleteProjectIndex } from '../../../services/rag/indexer';
import { MemoryRagStore } from '../../../services/rag/ragStore';
import { extractSourceDocs, chunkSourceDoc } from '../../../services/rag/chunkSources';
import { makeProject, makeChapter, makeCharacter } from './fixtures';

const longText = (seed: string, length: number): string => {
    let text = '';
    let i = 0;
    while (text.length < length) {
        text += `${seed}についての文章その${i}。`;
        i++;
    }
    return text;
};

describe('extractSourceDocs / chunkSourceDoc', () => {
    it('章・キャラ・設定・用語・伏線からソース文書を抽出する', () => {
        const project = makeProject({
            id: 'p1',
            chapters: [makeChapter({ id: 'ch1', title: '始まり', summary: '物語の始まり', draft: '本文テキスト' })],
            characters: [makeCharacter({ id: 'c1', name: '太郎', personality: '勇敢' })],
            worldSettings: [{
                id: 'w1', category: 'magic', title: '魔法体系', content: '詠唱が必要',
                createdAt: new Date(), updatedAt: new Date(),
            }],
            glossary: [{ id: 'g1', term: '賢者の石', definition: '伝説の触媒', category: 'item', createdAt: new Date() }],
            foreshadowings: [{
                id: 'f1', title: '古い指輪', description: '祖父の遺品', importance: 'high',
                status: 'planted', category: 'mystery', points: [], createdAt: new Date(), updatedAt: new Date(),
            }],
        });
        const docs = extractSourceDocs(project);
        const types = docs.map((d) => d.sourceType);
        expect(types).toContain('chapterDraft');
        expect(types).toContain('chapterSummary');
        expect(types).toContain('character');
        expect(types).toContain('worldSetting');
        expect(types).toContain('glossary');
        expect(types).toContain('foreshadowing');
    });

    it('チャンクIDは決定的（同一入力から同一ID）', () => {
        const project = makeProject({
            id: 'p1',
            chapters: [makeChapter({ id: 'ch1', title: 'a', draft: longText('冒険', 2000) })],
        });
        const docs = extractSourceDocs(project);
        const chunks1 = chunkSourceDoc('p1', docs[0]);
        const chunks2 = chunkSourceDoc('p1', docs[0]);
        expect(chunks1.map((c) => c.id)).toEqual(chunks2.map((c) => c.id));
        expect(chunks1[0].id).toBe('p1:chapterDraft:ch1:0');
        expect(chunks1.length).toBeGreaterThan(1);
    });

    it('長い草案は複数チャンクに分割され contentHash は全チャンク同値', () => {
        const project = makeProject({
            id: 'p1',
            chapters: [makeChapter({ id: 'ch1', title: 'a', draft: longText('魔法', 3000) })],
        });
        const doc = extractSourceDocs(project).find((d) => d.sourceType === 'chapterDraft')!;
        const chunks = chunkSourceDoc('p1', doc);
        expect(chunks.length).toBeGreaterThan(2);
        expect(new Set(chunks.map((c) => c.contentHash)).size).toBe(1);
    });
});

describe('ensureIndexFresh', () => {
    it('初回は全ソースをインデックスする', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            chapters: [makeChapter({ id: 'ch1', title: 'a', summary: 'あらすじ', draft: '本文' })],
            characters: [makeCharacter({ id: 'c1', name: '太郎' })],
        });
        const result = await ensureIndexFresh(project, store);
        expect(result.changed).toBe(true);
        expect(result.chunkCount).toBe(3); // draft + summary + character
    });

    it('変更が無ければ何もしない', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            chapters: [makeChapter({ id: 'ch1', title: 'a', summary: 'あらすじ' })],
        });
        await ensureIndexFresh(project, store);
        const second = await ensureIndexFresh(project, store);
        expect(second.changed).toBe(false);
    });

    it('変更されたソースのみ更新される（他ソースのチャンクは維持）', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            chapters: [
                makeChapter({ id: 'ch1', title: 'a', summary: '変わらないあらすじ', draft: '元の本文' }),
            ],
        });
        await ensureIndexFresh(project, store);
        const summaryBefore = (await store.getChunksByProject('p1')).find(
            (c) => c.sourceType === 'chapterSummary'
        )!;

        const edited = {
            ...project,
            chapters: [{ ...project.chapters[0], draft: '編集後の本文' }],
        };
        const result = await ensureIndexFresh(edited, store);
        expect(result.changed).toBe(true);

        const after = await store.getChunksByProject('p1');
        const draftAfter = after.find((c) => c.sourceType === 'chapterDraft')!;
        const summaryAfter = after.find((c) => c.sourceType === 'chapterSummary')!;
        expect(draftAfter.text).toBe('編集後の本文');
        // summary は未変更のため updatedAt も維持される（再書き込みされていない）
        expect(summaryAfter.updatedAt).toBe(summaryBefore.updatedAt);
    });

    it('削除されたソースのチャンクは消える', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            characters: [makeCharacter({ id: 'c1', name: '太郎' }), makeCharacter({ id: 'c2', name: '花子' })],
        });
        await ensureIndexFresh(project, store);
        expect((await store.getChunksByProject('p1')).length).toBe(2);

        const removed = { ...project, characters: [project.characters[0]] };
        await ensureIndexFresh(removed, store);
        const chunks = await store.getChunksByProject('p1');
        expect(chunks.length).toBe(1);
        expect(chunks[0].sourceId).toBe('c1');
    });
});

describe('reindexProject / deleteProjectIndex', () => {
    it('再構築で全チャンクが作り直される', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            characters: [makeCharacter({ id: 'c1', name: '太郎' })],
        });
        await ensureIndexFresh(project, store);
        const result = await reindexProject(project, store);
        expect(result.changed).toBe(true);
        expect(result.chunkCount).toBe(1);
    });

    it('deleteProjectIndex でチャンクとメタが消える', async () => {
        const store = new MemoryRagStore();
        const project = makeProject({
            id: 'p1',
            characters: [makeCharacter({ id: 'c1', name: '太郎' })],
        });
        await ensureIndexFresh(project, store);
        await deleteProjectIndex('p1', store);
        expect((await store.getChunksByProject('p1')).length).toBe(0);
        expect(await store.getMeta('p1')).toBeUndefined();
    });
});
