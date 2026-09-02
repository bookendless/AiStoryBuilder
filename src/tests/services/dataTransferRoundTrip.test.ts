import { describe, it, expect, vi } from 'vitest';
import {
    buildExportChunks,
    resolveExportOptions,
    type ExportSource,
} from '../../services/data-transfer/exportStream';
import {
    importFromChunks,
    type ImportTargetTables,
} from '../../services/data-transfer/streamingImport';
import type {
    StoredProject,
    ProjectBackup,
    AppSettings,
    StoredChapterHistoryEntry,
    StoredAILogEntry,
    StoredImage,
} from '../../services/databaseService';

/**
 * エクスポートしたJSONをそのまま取り込めることを確認する
 * 形式を片側だけ変えてしまう事故を防ぐための往復テスト
 */

const project = {
    id: 'p1',
    title: '物語のタイトル',
    description: '説明文',
    draft: '吾輩は猫である😺',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    version: 1,
    lastSaved: new Date('2026-02-01T00:00:00.000Z'),
    imageBoard: [{
        id: 'board1',
        url: '',
        imageId: 'img1',
        title: '参考画像',
        category: 'reference' as const,
        addedAt: new Date('2026-01-05T00:00:00.000Z'),
    }],
    chapters: [{ id: 'c1', title: '第一章', createdAt: new Date('2026-01-02T00:00:00.000Z') }],
} as unknown as StoredProject;

const backup: ProjectBackup = {
    id: 'b1',
    projectId: 'p1',
    type: 'manual',
    data: 'H4sIAAAAA',
    compressed: true,
    description: '手動バックアップ',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
};

const history = {
    id: 'h1',
    projectId: 'p1',
    chapterId: 'c1',
    timestamp: 1767225600000,
    content: '本文',
} as unknown as StoredChapterHistoryEntry;

const aiLog = {
    id: 'l1',
    projectId: 'p1',
    timestamp: new Date('2026-01-11T00:00:00.000Z'),
    type: 'draft',
    prompt: 'プロンプト',
    response: '応答',
} as unknown as StoredAILogEntry;

const image: StoredImage = {
    id: 'img1',
    blob: new Blob([new Uint8Array([10, 20, 30, 40, 50])], { type: 'image/webp' }),
    originalFormat: 'image/png',
    originalSize: 500,
    compressedSize: 5,
    width: 64,
    height: 48,
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    lastAccessed: new Date('2026-01-06T00:00:00.000Z'),
    referenceCount: 1,
};

const source: ExportSource = {
    async *projects() { yield project; },
    async *backups(types) { if (types.includes('manual')) yield backup; },
    async *histories() { yield history; },
    async *aiLogs() { yield aiLog; },
    settings: () => Promise.resolve([{ id: 'main', theme: 'dark' } as AppSettings]),
    async *images(ids) { if (ids.includes('img1')) yield image; },
};

/** bulkPutの呼び出し内容を検証できるモックテーブル一式 */
function makeTables() {
    const put = <T>() => vi.fn<(items: T[]) => Promise<void>>().mockResolvedValue(undefined);
    const tables = {
        projects: { bulkPut: put<StoredProject>() },
        backups: { bulkPut: put<ProjectBackup>() },
        settings: { bulkPut: put<AppSettings>() },
        chapterHistories: { bulkPut: put<StoredChapterHistoryEntry>() },
        aiLogs: { bulkPut: put<StoredAILogEntry>() },
        images: { bulkPut: put<StoredImage>() },
    };
    return tables satisfies ImportTargetTables;
}

async function* chunkify(text: string, size: number): AsyncIterable<Uint8Array> {
    const bytes = new TextEncoder().encode(text);
    for (let offset = 0; offset < bytes.length; offset += size) {
        yield bytes.subarray(offset, offset + size);
    }
}

describe('エクスポートとインポートの往復', () => {
    it('書き出したJSONを取り込むと同じ内容に戻る', async () => {
        let json = '';
        for await (const chunk of buildExportChunks(source, resolveExportOptions())) {
            json += chunk;
        }

        const db = makeTables();
        const summary = await importFromChunks(chunkify(json, 17), { db });

        expect(summary.version).toBe(3);
        expect(summary.skipped).toBe(0);
        expect(summary.counts).toEqual({
            projects: 1, backups: 1, settings: 1, histories: 1, aiLogs: 1, images: 1,
        });

        const [projects] = db.projects.bulkPut.mock.calls[0];
        expect(projects[0].id).toBe('p1');
        expect(projects[0].title).toBe('物語のタイトル');
        expect(projects[0].draft).toBe('吾輩は猫である😺');
        expect(projects[0].updatedAt).toBeInstanceOf(Date);
        expect(projects[0].updatedAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
        expect(projects[0].imageBoard[0].addedAt).toBeInstanceOf(Date);

        const [backups] = db.backups.bulkPut.mock.calls[0];
        expect(backups[0].data).toBe('H4sIAAAAA');
        expect(backups[0].compressed).toBe(true);
        expect(backups[0].createdAt).toBeInstanceOf(Date);

        const [histories] = db.chapterHistories.bulkPut.mock.calls[0];
        expect(histories[0].timestamp).toBe(1767225600000);

        const [logs] = db.aiLogs.bulkPut.mock.calls[0];
        expect(logs[0].timestamp).toBeInstanceOf(Date);

        const [images] = db.images.bulkPut.mock.calls[0];
        expect(images[0].blob).toBeInstanceOf(Blob);
        expect(images[0].blob.type).toBe('image/webp');
        expect(images[0].width).toBe(64);
        expect(Array.from(new Uint8Array(await images[0].blob.arrayBuffer())))
            .toEqual([10, 20, 30, 40, 50]);
    });

    it('作品別エクスポート（設定なし・自動バックアップなし）も取り込める', async () => {
        const options = resolveExportOptions({
            projectIds: ['p1'],
            includeAutoBackups: false,
        });

        let json = '';
        for await (const chunk of buildExportChunks(source, options)) {
            json += chunk;
        }

        const db = makeTables();
        const summary = await importFromChunks(chunkify(json, 4096), { db });

        expect(summary.counts.projects).toBe(1);
        expect(summary.counts.settings).toBe(0);
        expect(db.settings.bulkPut).not.toHaveBeenCalled();
    });
});
