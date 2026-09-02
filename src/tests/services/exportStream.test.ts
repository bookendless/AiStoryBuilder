import { describe, it, expect } from 'vitest';
import {
    buildExportChunks,
    resolveExportOptions,
    collectImageIds,
    stripImageBoardUrls,
    serializeImage,
    type ExportSource,
    type BackupType,
} from '../../services/data-transfer/exportStream';
import { normalizeImageRecord } from '../../services/data-transfer/normalizeImportRecords';
import type { ExportedImage } from '../../services/data-transfer/types';
import type {
    StoredProject,
    ProjectBackup,
    AppSettings,
    StoredChapterHistoryEntry,
    StoredAILogEntry,
    StoredImage,
} from '../../services/databaseService';

function makeProject(id: string, imageIds: string[] = []): StoredProject {
    return {
        id,
        title: `作品${id}`,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        version: 1,
        lastSaved: new Date('2026-01-01T00:00:00.000Z'),
        imageBoard: imageIds.map((imageId, index) => ({
            id: `board-${index}`,
            url: 'data:image/webp;base64,AAAA',
            imageId,
            title: '画像',
            category: 'reference' as const,
            addedAt: new Date('2026-01-01T00:00:00.000Z'),
        })),
    } as unknown as StoredProject;
}

function makeBackup(id: string, projectId: string, type: BackupType): ProjectBackup {
    return {
        id,
        projectId,
        type,
        data: '{"id":"p1"}',
        compressed: false,
        description: type === 'auto' ? '自動バックアップ' : '手動',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
}

function makeImage(id: string): StoredImage {
    return {
        id,
        blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
        originalFormat: 'image/png',
        originalSize: 40,
        compressedSize: 4,
        width: 8,
        height: 8,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastAccessed: new Date('2026-01-02T00:00:00.000Z'),
        referenceCount: 1,
    };
}

interface SourceData {
    projects?: StoredProject[];
    backups?: ProjectBackup[];
    settings?: AppSettings[];
    histories?: StoredChapterHistoryEntry[];
    aiLogs?: StoredAILogEntry[];
    images?: StoredImage[];
}

function makeSource(data: SourceData): ExportSource {
    const projects = data.projects ?? [];
    const backups = data.backups ?? [];
    const settings = data.settings ?? [];
    const histories = data.histories ?? [];
    const aiLogs = data.aiLogs ?? [];
    const images = data.images ?? [];

    return {
        async *projects() { yield* projects; },
        async *backups(types) {
            for (const backup of backups) {
                if (types.includes(backup.type)) yield backup;
            }
        },
        async *histories() { yield* histories; },
        async *aiLogs() { yield* aiLogs; },
        settings: () => Promise.resolve(settings),
        async *images(imageIds) {
            for (const image of images) {
                if (imageIds.includes(image.id)) yield image;
            }
        },
    };
}

/** エクスポートJSONの構造（テストでの検証用） */
interface ExportedDocument {
    version: number;
    exportedAt: string;
    projects: StoredProject[];
    backups: ProjectBackup[];
    settings: AppSettings[];
    histories: StoredChapterHistoryEntry[];
    aiLogs: StoredAILogEntry[];
    images: ExportedImage[];
}

function parseExport(json: string): ExportedDocument {
    return JSON.parse(json) as ExportedDocument;
}

async function collect(source: ExportSource, options = resolveExportOptions()): Promise<string> {
    let json = '';
    for await (const chunk of buildExportChunks(source, options)) {
        json += chunk;
    }
    return json;
}

describe('resolveExportOptions', () => {
    it('既定ではすべて含め、設定も含める', () => {
        const options = resolveExportOptions();
        expect(options.includeManualBackups).toBe(true);
        expect(options.includeAutoBackups).toBe(true);
        expect(options.includeImages).toBe(true);
        expect(options.includeSettings).toBe(true);
    });

    it('作品を指定したときは設定を含めない', () => {
        expect(resolveExportOptions({ projectIds: ['p1'] }).includeSettings).toBe(false);
        expect(resolveExportOptions({ projectIds: ['p1'], includeSettings: true }).includeSettings).toBe(true);
    });

    it('圧縮はBlob出力のときだけ有効になる', () => {
        expect(resolveExportOptions({ compress: true }).compress).toBe(false);
        expect(resolveExportOptions({ compress: true, returnBlob: true }).compress).toBe(true);
    });
});

describe('collectImageIds / stripImageBoardUrls', () => {
    it('imageIdを持つ画像だけ集める', () => {
        const project = makeProject('p1', ['img1', 'img2']);
        expect(collectImageIds(project)).toEqual(['img1', 'img2']);
        expect(collectImageIds({ imageBoard: [] })).toEqual([]);
    });

    it('urlを落として他のフィールドは残す', () => {
        const stripped = stripImageBoardUrls(makeProject('p1', ['img1']));
        expect(stripped.imageBoard[0]).not.toHaveProperty('url');
        expect(stripped.imageBoard[0].imageId).toBe('img1');
        expect(stripped.imageBoard[0].title).toBe('画像');
    });
});

describe('buildExportChunks', () => {
    it('整形なしのJSONを生成し、version 3で全キーを含む', async () => {
        const json = await collect(makeSource({
            projects: [makeProject('p1')],
            backups: [makeBackup('b1', 'p1', 'manual')],
            settings: [{ id: 'main' } as AppSettings],
        }));

        expect(json).not.toContain('\n');
        const parsed = parseExport(json);
        expect(parsed.version).toBe(3);
        expect(Object.keys(parsed)).toEqual([
            'version', 'exportedAt', 'projects', 'backups', 'settings', 'histories', 'aiLogs', 'images',
        ]);
        expect(parsed.projects).toHaveLength(1);
        expect(parsed.backups).toHaveLength(1);
        expect(parsed.histories).toEqual([]);
        expect(parsed.images).toEqual([]);
    });

    it('バックアップの種類で絞り込む', async () => {
        const source = makeSource({
            projects: [makeProject('p1')],
            backups: [makeBackup('b1', 'p1', 'manual'), makeBackup('b2', 'p1', 'auto')],
        });

        const withoutAuto = parseExport(await collect(source, resolveExportOptions({ includeAutoBackups: false })));
        expect(withoutAuto.backups.map(b => b.id)).toEqual(['b1']);

        const none = parseExport(await collect(source, resolveExportOptions({
            includeAutoBackups: false,
            includeManualBackups: false,
        })));
        expect(none.backups).toEqual([]);
    });

    it('設定を含めない指定では空配列になる', async () => {
        const json = await collect(
            makeSource({ settings: [{ id: 'main' } as AppSettings] }),
            resolveExportOptions({ includeSettings: false })
        );
        expect(parseExport(json).settings).toEqual([]);
    });

    it('excludeImageDataでimageBoardのurlを落とす', async () => {
        const json = await collect(
            makeSource({ projects: [makeProject('p1', ['img1'])] }),
            resolveExportOptions({ excludeImageData: true })
        );
        expect(json).not.toContain('data:image/webp');
    });

    it('参照されている画像だけをBase64で書き出し、取り込み側で復元できる', async () => {
        const json = await collect(makeSource({
            projects: [makeProject('p1', ['img1'])],
            images: [makeImage('img1'), makeImage('img2')],
        }));

        const parsed = parseExport(json);
        expect(parsed.images).toHaveLength(1);
        expect(parsed.images[0].id).toBe('img1');
        expect(typeof parsed.images[0].blob).toBe('string');

        const restored = normalizeImageRecord(parsed.images[0]);
        expect(restored!.blob.size).toBe(4);
        expect(restored!.width).toBe(8);
    });

    it('画像を含めない指定では画像を書き出さない', async () => {
        const json = await collect(
            makeSource({ projects: [makeProject('p1', ['img1'])], images: [makeImage('img1')] }),
            resolveExportOptions({ includeImages: false })
        );
        expect(parseExport(json).images).toEqual([]);
    });
});

describe('serializeImage', () => {
    it('BlobをBase64にし、サムネイルも変換する', async () => {
        const image = makeImage('img1');
        image.thumbnail = new Blob([new Uint8Array([9, 9])], { type: 'image/webp' });

        const exported = await serializeImage(image);
        expect(exported.blobType).toBe('image/webp');
        expect(typeof exported.blob).toBe('string');
        expect(typeof exported.thumbnail).toBe('string');
        expect(exported.compressedSize).toBe(4);
    });
});
