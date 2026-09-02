import { describe, it, expect, vi } from 'vitest';
import {
    importFromChunks,
    sectionOf,
    ImportFormatError,
    type ImportTargetTables,
} from '../../services/data-transfer/streamingImport';
import type { ImportProgress } from '../../services/data-transfer/types';
import { uint8ArrayToBase64 } from '../../utils/base64';
import type {
    StoredProject,
    ProjectBackup,
    AppSettings,
    StoredChapterHistoryEntry,
    StoredAILogEntry,
    StoredImage,
} from '../../services/databaseService';

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

/** 文字列をバイト列に変換し、指定サイズで分割して流す */
async function* byteChunks(text: string, size: number): AsyncIterable<Uint8Array> {
    const bytes = new TextEncoder().encode(text);
    for (let offset = 0; offset < bytes.length; offset += size) {
        yield bytes.subarray(offset, offset + size);
    }
}

async function* single(text: string): AsyncIterable<string> {
    yield text;
}

const versionOneDocument = JSON.stringify({
    projects: [{ id: 'p1', title: '作品1', updatedAt: '2026-01-01T00:00:00.000Z' }],
    backups: [{ id: 'b1', projectId: 'p1', type: 'auto', data: '{}', createdAt: '2026-01-01T00:00:00.000Z' }],
    settings: [{ id: 'main', theme: 'dark' }],
});

const versionTwoDocument = JSON.stringify({
    version: 2,
    exportedAt: '2026-01-01T00:00:00.000Z',
    projects: [{ id: 'p1', title: '作品1' }, { id: 'p2', title: '作品2' }],
    backups: [],
    settings: [],
    histories: [{ id: 'h1', projectId: 'p1', chapterId: 'c1', timestamp: 100 }],
    aiLogs: [{ id: 'l1', projectId: 'p1', timestamp: '2026-01-01T00:00:00.000Z' }],
});

const versionThreeDocument = JSON.stringify({
    version: 3,
    exportedAt: '2026-01-01T00:00:00.000Z',
    projects: [{ id: 'p1', title: '物語のタイトル', draft: '吾輩は猫である😺' }],
    backups: [],
    settings: [],
    histories: [],
    aiLogs: [],
    images: [{
        id: 'img1',
        blob: uint8ArrayToBase64(new Uint8Array([1, 2, 3, 4])),
        blobType: 'image/webp',
        width: 8,
        height: 8,
        compressedSize: 4,
    }],
});

describe('sectionOf', () => {
    it('スタックからセクション名を見つける', () => {
        expect(sectionOf([{ key: null }, { key: 'projects' }], 0)).toBe('projects');
        expect(sectionOf([{ key: null }], 'version')).toBe('version');
    });

    it('未知のキーはundefinedを返す', () => {
        expect(sectionOf([{ key: null }], 'unknown')).toBeUndefined();
        expect(sectionOf([], undefined)).toBeUndefined();
    });
});

describe('importFromChunks', () => {
    it('version 1のファイル（履歴・AIログなし）を取り込む', async () => {
        const db = makeTables();
        const summary = await importFromChunks(single(versionOneDocument), { db });

        expect(summary.version).toBeNull();
        expect(summary.counts.projects).toBe(1);
        expect(summary.counts.backups).toBe(1);
        expect(summary.counts.settings).toBe(1);
        expect(summary.counts.histories).toBe(0);
        expect(db.projects.bulkPut).toHaveBeenCalledTimes(1);
    });

    it('version 2のファイルで履歴とAIログも取り込む', async () => {
        const db = makeTables();
        const summary = await importFromChunks(single(versionTwoDocument), { db });

        expect(summary.version).toBe(2);
        expect(summary.counts.projects).toBe(2);
        expect(summary.counts.histories).toBe(1);
        expect(summary.counts.aiLogs).toBe(1);
        expect(summary.counts.images).toBe(0);
    });

    it('version 3の画像をBlobとして取り込む', async () => {
        const db = makeTables();
        const summary = await importFromChunks(single(versionThreeDocument), { db });

        expect(summary.version).toBe(3);
        expect(summary.counts.images).toBe(1);

        const [images] = db.images.bulkPut.mock.calls[0];
        expect(images[0].blob).toBeInstanceOf(Blob);
        expect(images[0].blob.size).toBe(4);
    });

    it('多バイト文字の途中でチャンクが切れても壊れない', async () => {
        for (const chunkSize of [1, 3, 5, 64]) {
            const db = makeTables();
            await importFromChunks(byteChunks(versionThreeDocument, chunkSize), { db });

            const [projects] = db.projects.bulkPut.mock.calls[0];
            expect(projects[0].title).toBe('物語のタイトル');
            expect(projects[0].draft).toBe('吾輩は猫である😺');
        }
    });

    it('バッチ件数ごとに分けて書き込む', async () => {
        const document = JSON.stringify({
            version: 2,
            projects: [],
            histories: [
                { id: 'h1', projectId: 'p1', timestamp: 1 },
                { id: 'h2', projectId: 'p1', timestamp: 2 },
                { id: 'h3', projectId: 'p1', timestamp: 3 },
                { id: 'h4', projectId: 'p1', timestamp: 4 },
                { id: 'h5', projectId: 'p1', timestamp: 5 },
            ],
        });

        const db = makeTables();
        const summary = await importFromChunks(byteChunks(document, 16), {
            db,
            batchLimits: { histories: 2 },
        });

        expect(summary.counts.histories).toBe(5);
        expect(db.chapterHistories.bulkPut.mock.calls.length).toBeGreaterThan(1);
    });

    it('形式が不正なレコードはスキップして数える', async () => {
        const document = JSON.stringify({
            version: 3,
            projects: [{ id: 'p1', title: 'ok' }, { title: 'idなし' }, null],
            backups: [],
        });

        const db = makeTables();
        const summary = await importFromChunks(single(document), { db });

        expect(summary.counts.projects).toBe(1);
        expect(summary.skipped).toBe(2);
    });

    it('進捗を通知し、読み込みバイト数が増えていく', async () => {
        const db = makeTables();
        const seen: ImportProgress[] = [];
        const totalBytes = new TextEncoder().encode(versionTwoDocument).length;

        await importFromChunks(byteChunks(versionTwoDocument, 32), {
            db,
            totalBytes,
            onProgress: progress => seen.push({ ...progress, counts: { ...progress.counts } }),
        });

        expect(seen.length).toBeGreaterThan(1);
        for (let i = 1; i < seen.length; i++) {
            expect(seen[i].bytesRead).toBeGreaterThanOrEqual(seen[i - 1].bytesRead);
        }
        expect(seen[seen.length - 1].bytesRead).toBe(totalBytes);
    });

    it('末尾の改行があっても取り込める', async () => {
        const db = makeTables();
        const summary = await importFromChunks(byteChunks(`${versionTwoDocument}\n`, 32), { db });
        expect(summary.counts.projects).toBe(2);
    });

    it('壊れたJSONはImportFormatErrorになる', async () => {
        const db = makeTables();
        await expect(importFromChunks(single('これはJSONではない'), { db }))
            .rejects.toThrow(ImportFormatError);
    });

    it('途中で切れたファイルはImportFormatErrorになる', async () => {
        const db = makeTables();
        await expect(importFromChunks(single('{"version":3,"projects":[{"id":'), { db }))
            .rejects.toThrow(ImportFormatError);
    });

    it('エクスポートファイルではないJSONはImportFormatErrorになる', async () => {
        const db = makeTables();
        await expect(importFromChunks(single('[1,2,3]'), { db }))
            .rejects.toThrow(ImportFormatError);
    });

    it('新しいversionでも取り込みは続行する', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const db = makeTables();

        const summary = await importFromChunks(
            single(JSON.stringify({ version: 99, projects: [{ id: 'p1', title: 'A' }] })),
            { db }
        );

        expect(summary.counts.projects).toBe(1);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
