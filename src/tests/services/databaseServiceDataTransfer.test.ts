/**
 * データ移行まわりのDB結合テスト
 *
 * 実際のIndexedDB（fake-indexeddb）に対して動かし、
 * Dexieのクエリ（作品別の絞り込み・容量集計・一括削除）が意図どおりか確かめる。
 *
 * 注意: fake-indexeddb は Blob を保存できず空オブジェクトになるため、
 * 画像の書き出し・取り込みはここでは扱わない（exportStream / 往復テストで担保）。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    databaseService,
    db,
    type StoredProject,
    type ProjectBackup,
    type StoredChapterHistoryEntry,
    type StoredAILogEntry,
    type StoredImage,
    type AppSettings,
} from '../../services/databaseService';
import type { Project } from '../../contexts/ProjectContext';

interface ExportedDocument {
    version: number;
    projects: Array<{ id: string; title: string; imageBoard?: Array<{ imageId?: string; url?: string }> }>;
    backups: ProjectBackup[];
    settings: AppSettings[];
    histories: StoredChapterHistoryEntry[];
    aiLogs: StoredAILogEntry[];
    images: Array<{ id: string; blob: string }>;
}

function makeProject(id: string, imageId?: string): StoredProject {
    return {
        id,
        title: `作品${id}`,
        description: '',
        theme: '',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        version: 1,
        lastSaved: new Date('2026-01-01T00:00:00.000Z'),
        imageBoard: imageId
            ? [{
                id: `board-${id}`,
                url: '',
                imageId,
                title: '画像',
                category: 'reference' as const,
                addedAt: new Date('2026-01-01T00:00:00.000Z'),
            }]
            : [],
        characters: [],
        chapters: [],
        draft: '',
    } as unknown as StoredProject;
}

function makeBackup(id: string, projectId: string, type: 'manual' | 'auto'): ProjectBackup {
    return {
        id,
        projectId,
        type,
        data: `{"id":"${projectId}"}`,
        compressed: false,
        description: type === 'auto' ? '自動バックアップ' : '手動バックアップ',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
    };
}

function makeImage(id: string): StoredImage {
    return {
        id,
        blob: new Blob([new Uint8Array([1, 2, 3, 4, 5, 6])], { type: 'image/webp' }),
        originalFormat: 'image/png',
        originalSize: 60,
        compressedSize: 6,
        width: 16,
        height: 16,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastAccessed: new Date('2026-01-01T00:00:00.000Z'),
        referenceCount: 1,
    };
}

async function seed(): Promise<void> {
    await Promise.all([
        db.projects.clear(),
        db.backups.clear(),
        db.chapterHistories.clear(),
        db.aiLogs.clear(),
        db.images.clear(),
        db.settings.clear(),
    ]);

    await db.projects.bulkPut([makeProject('p1', 'img1'), makeProject('p2')]);
    await db.backups.bulkPut([
        makeBackup('b1', 'p1', 'manual'),
        makeBackup('b2', 'p1', 'auto'),
        makeBackup('b3', 'p2', 'auto'),
        makeBackup('b4', 'orphan', 'auto'), // 削除済みプロジェクトの残骸
    ]);
    await db.chapterHistories.bulkPut([
        { id: 'h1', projectId: 'p1', chapterId: 'c1', timestamp: 1 } as unknown as StoredChapterHistoryEntry,
        { id: 'h2', projectId: 'p2', chapterId: 'c1', timestamp: 2 } as unknown as StoredChapterHistoryEntry,
    ]);
    await db.aiLogs.bulkPut([
        { id: 'l1', projectId: 'p1', timestamp: new Date(), type: 'draft', prompt: '', response: '' } as unknown as StoredAILogEntry,
        { id: 'l2', projectId: 'p2', timestamp: new Date(), type: 'draft', prompt: '', response: '' } as unknown as StoredAILogEntry,
    ]);
    await db.images.bulkPut([makeImage('img1'), makeImage('img2')]);
    await db.settings.put({ id: 'main', theme: 'dark' } as AppSettings);
}

describe('databaseService のデータ移行機能', () => {
    beforeEach(async () => {
        await seed();
    });

    describe('exportData', () => {
        it('全件エクスポートではすべてのテーブルを書き出す', async () => {
            const json = await databaseService.exportData({ returnBlob: false, includeImages: false }) as string;
            const parsed = JSON.parse(json) as ExportedDocument;

            expect(parsed.version).toBe(3);
            expect(parsed.projects).toHaveLength(2);
            expect(parsed.backups).toHaveLength(4);
            expect(parsed.histories).toHaveLength(2);
            expect(parsed.aiLogs).toHaveLength(2);
            expect(parsed.settings).toHaveLength(1);
            expect(parsed.images).toEqual([]);
        });

        it('作品を指定するとバックアップ・履歴・AIログも絞り込まれる', async () => {
            const json = await databaseService.exportData({
                projectIds: ['p1'],
                returnBlob: false,
                includeImages: false,
            }) as string;
            const parsed = JSON.parse(json) as ExportedDocument;

            expect(parsed.projects.map(p => p.id)).toEqual(['p1']);
            expect(parsed.backups.map(b => b.id).sort()).toEqual(['b1', 'b2']);
            expect(parsed.histories.map(h => h.id)).toEqual(['h1']);
            expect(parsed.aiLogs.map(l => l.id)).toEqual(['l1']);
            // 作品を指定したときは端末全体の設定を含めない
            expect(parsed.settings).toEqual([]);
        });

        it('自動バックアップを外すと手動バックアップだけになる', async () => {
            const json = await databaseService.exportData({
                includeAutoBackups: false,
                includeImages: false,
                returnBlob: false,
            }) as string;
            const parsed = JSON.parse(json) as ExportedDocument;

            expect(parsed.backups.map(b => b.id)).toEqual(['b1']);
        });

        it('Blobで受け取れる', async () => {
            const blob = await databaseService.exportData({ returnBlob: true, includeImages: false }) as Blob;
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('application/json');

            // jsdomのBlobには text() が無いためバイト列から読む
            const text = new TextDecoder().decode(await blob.arrayBuffer());
            const parsed = JSON.parse(text) as ExportedDocument;
            expect(parsed.projects).toHaveLength(2);
        });
    });

    describe('importFile', () => {
        it('エクスポートしたファイルを取り込み直せる', async () => {
            const json = await databaseService.exportData({ returnBlob: false, includeImages: false }) as string;

            await db.projects.clear();
            await db.backups.clear();
            await db.chapterHistories.clear();

            const summary = await databaseService.importFile(new Blob([json]));

            expect(summary.version).toBe(3);
            expect(summary.counts.projects).toBe(2);
            expect(summary.counts.backups).toBe(4);
            expect(summary.counts.histories).toBe(2);
            expect(summary.skipped).toBe(0);
            expect(await db.projects.count()).toBe(2);
            expect(await db.backups.count()).toBe(4);

            const restored = await db.projects.get('p1');
            expect(restored?.title).toBe('作品p1');
            expect(restored?.updatedAt).toBeInstanceOf(Date);
        });

        it('進捗を通知する', async () => {
            const json = await databaseService.exportData({ returnBlob: false, includeImages: false }) as string;
            let calls = 0;
            await databaseService.importFile(new Blob([json]), () => { calls++; });
            expect(calls).toBeGreaterThan(0);
        });

        it('壊れたファイルはエラーになる', async () => {
            await expect(databaseService.importFile(new Blob(['壊れています'])))
                .rejects.toThrow(/無効なデータ形式です/);
        });
    });

    describe('getProjectStorageBreakdown', () => {
        it('プロジェクトごとの件数と容量を集計する', async () => {
            const breakdown = await databaseService.getProjectStorageBreakdown();

            expect(breakdown.projects.map(p => p.projectId).sort()).toEqual(['p1', 'p2']);

            const p1 = breakdown.projects.find(p => p.projectId === 'p1')!;
            expect(p1.manualBackupCount).toBe(1);
            expect(p1.autoBackupCount).toBe(1);
            expect(p1.historyCount).toBe(1);
            expect(p1.aiLogCount).toBe(1);
            expect(p1.imageCount).toBe(1);
            expect(p1.imageBytes).toBe(6);
            expect(p1.projectBytes).toBeGreaterThan(0);

            const p2 = breakdown.projects.find(p => p.projectId === 'p2')!;
            expect(p2.imageCount).toBe(0);

            // 削除済みプロジェクトの自動バックアップも総数には含む
            expect(breakdown.totalAutoBackupCount).toBe(3);
            expect(breakdown.settingsBytes).toBeGreaterThan(0);
        });
    });

    describe('deleteAutoBackupsForProjects', () => {
        it('指定した作品の自動バックアップだけ削除する', async () => {
            const { deleted, freedBytes } = await databaseService.deleteAutoBackupsForProjects(['p1']);

            expect(deleted).toBe(1);
            expect(freedBytes).toBeGreaterThan(0);
            expect(await db.backups.get('b1')).toBeDefined(); // 手動は残る
            expect(await db.backups.get('b2')).toBeUndefined();
            expect(await db.backups.get('b3')).toBeDefined();
        });

        it('allを指定すると孤立分も含めて削除する', async () => {
            const { deleted } = await databaseService.deleteAutoBackupsForProjects('all');

            expect(deleted).toBe(3);
            expect(await db.backups.count()).toBe(1);
            expect(await db.backups.get('b1')).toBeDefined();
        });

        it('空の配列では何も削除しない', async () => {
            const result = await databaseService.deleteAutoBackupsForProjects([]);
            expect(result).toEqual({ deleted: 0, freedBytes: 0 });
            expect(await db.backups.count()).toBe(4);
        });

        it('従来の1プロジェクト版も動く', async () => {
            expect(await databaseService.deleteAutoBackups('p2')).toBe(1);
            expect(await db.backups.get('b3')).toBeUndefined();
        });
    });

    describe('自動バックアップの重複抑止', () => {
        it('内容が変わっていなければ新しい自動バックアップを作らない', async () => {
            await db.backups.clear();
            // 実際のタイマーで待つため、間隔を短く設定する
            await databaseService.saveSettings({ autoSaveInterval: 60_000, autoBackupInterval: 40 });

            let current = makeProject('dedupe1') as unknown as Project;
            const getProject = () => current;
            const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            try {
                await databaseService.startAutoSave(getProject, () => { });

                // 何周期か待っても、内容が変わっていなければ1件のまま
                await wait(200);
                expect(await db.backups.count()).toBe(1);

                // 更新すると次の周期で作られる
                current = { ...current, updatedAt: new Date('2026-06-01T00:00:00.000Z') };
                await wait(200);
                expect(await db.backups.count()).toBe(2);
            } finally {
                databaseService.stopAutoSave();
                await databaseService.saveSettings({ autoSaveInterval: 180_000, autoBackupInterval: 300_000 });
            }
        });
    });
});
