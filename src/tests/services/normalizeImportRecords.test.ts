import { describe, it, expect } from 'vitest';
import {
    safeDateConversion,
    normalizeProjectRecord,
    normalizeBackupRecord,
    normalizeSettingsRecord,
    normalizeHistoryRecord,
    normalizeAILogRecord,
    normalizeImageRecord,
} from '../../services/data-transfer/normalizeImportRecords';
import { uint8ArrayToBase64 } from '../../utils/base64';

describe('safeDateConversion', () => {
    it('Dateはそのまま返す', () => {
        const date = new Date('2026-01-02T03:04:05.000Z');
        expect(safeDateConversion(date)).toBe(date);
    });

    it('ISO文字列と数値をDateに変換する', () => {
        expect(safeDateConversion('2026-01-02T03:04:05.000Z').toISOString())
            .toBe('2026-01-02T03:04:05.000Z');
        expect(safeDateConversion(0).getTime()).toBe(0);
    });

    it('不正な値では現在時刻を返す', () => {
        expect(safeDateConversion(undefined)).toBeInstanceOf(Date);
        expect(Number.isNaN(safeDateConversion('まったく日付ではない').getTime())).toBe(false);
    });
});

describe('normalizeProjectRecord', () => {
    it('日付フィールドをDateへ戻す', () => {
        const record = normalizeProjectRecord({
            id: 'p1',
            title: '物語',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            imageBoard: [{ id: 'i1', url: '', addedAt: '2026-01-15T00:00:00.000Z' }],
            chapters: [{ id: 'c1', createdAt: '2026-01-20T00:00:00.000Z' }],
        });

        expect(record).not.toBeNull();
        expect(record!.createdAt).toBeInstanceOf(Date);
        expect(record!.updatedAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
        expect(record!.imageBoard[0].addedAt).toBeInstanceOf(Date);
        expect((record!.chapters[0] as { createdAt?: Date }).createdAt).toBeInstanceOf(Date);
    });

    it('索引に使うversion/lastSavedを補う', () => {
        const record = normalizeProjectRecord({ id: 'p1', title: 'A', updatedAt: '2026-02-01T00:00:00.000Z' });
        expect(record!.version).toBe(1);
        expect(record!.lastSaved.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('imageBoardやchaptersが配列でなければ空配列にする', () => {
        const record = normalizeProjectRecord({ id: 'p1', title: 'A', imageBoard: null, chapters: 'x' });
        expect(record!.imageBoard).toEqual([]);
        expect(record!.chapters).toEqual([]);
    });

    it('idが無いレコードはnullを返す', () => {
        expect(normalizeProjectRecord({ title: 'idなし' })).toBeNull();
        expect(normalizeProjectRecord({ id: '', title: '空id' })).toBeNull();
        expect(normalizeProjectRecord('文字列')).toBeNull();
        expect(normalizeProjectRecord(null)).toBeNull();
    });
});

describe('normalizeBackupRecord', () => {
    it('圧縮済みの文字列データはそのまま保つ', () => {
        const record = normalizeBackupRecord({
            id: 'b1',
            projectId: 'p1',
            data: 'H4sIAAAA',
            compressed: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            type: 'auto',
            description: '自動バックアップ',
        });

        expect(record!.data).toBe('H4sIAAAA');
        expect(record!.compressed).toBe(true);
        expect(record!.createdAt).toBeInstanceOf(Date);
    });

    it('旧形式のオブジェクトデータはJSON文字列にする', () => {
        const record = normalizeBackupRecord({
            id: 'b2',
            projectId: 'p1',
            data: { id: 'p1', title: '物語', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
            createdAt: '2026-01-02T00:00:00.000Z',
            type: 'manual',
            description: '手動',
        });

        expect(typeof record!.data).toBe('string');
        expect(record!.compressed).toBe(false);
        const parsedBackupData = JSON.parse(record!.data as string) as { title: string };
        expect(parsedBackupData.title).toBe('物語');
    });

    it('dataが文字列でもオブジェクトでもなければnull', () => {
        expect(normalizeBackupRecord({ id: 'b3', data: 42 })).toBeNull();
    });
});

describe('normalizeSettingsRecord / normalizeHistoryRecord / normalizeAILogRecord', () => {
    it('設定はidが必要', () => {
        expect(normalizeSettingsRecord({ id: 'main', theme: 'dark' })).not.toBeNull();
        expect(normalizeSettingsRecord({ theme: 'dark' })).toBeNull();
    });

    it('履歴のtimestampが数値でなければ現在時刻で補う', () => {
        const withNumber = normalizeHistoryRecord({ id: 'h1', projectId: 'p1', timestamp: 1234 });
        expect(withNumber!.timestamp).toBe(1234);

        const withoutNumber = normalizeHistoryRecord({ id: 'h2', projectId: 'p1', timestamp: 'x' });
        expect(typeof withoutNumber!.timestamp).toBe('number');
    });

    it('AIログのtimestampはDateに変換する', () => {
        const record = normalizeAILogRecord({ id: 'l1', projectId: 'p1', timestamp: '2026-03-01T00:00:00.000Z' });
        expect(record!.timestamp).toBeInstanceOf(Date);
    });
});

describe('normalizeImageRecord', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const base64 = uint8ArrayToBase64(bytes);

    it('Base64をBlobへ戻す', async () => {
        const record = normalizeImageRecord({
            id: 'img1',
            blob: base64,
            blobType: 'image/webp',
            originalFormat: 'image/png',
            originalSize: 100,
            compressedSize: 5,
            width: 32,
            height: 16,
            createdAt: '2026-01-01T00:00:00.000Z',
            lastAccessed: '2026-01-02T00:00:00.000Z',
            referenceCount: 2,
        });

        expect(record).not.toBeNull();
        expect(record!.blob).toBeInstanceOf(Blob);
        expect(record!.blob.type).toBe('image/webp');
        expect(record!.blob.size).toBe(5);
        expect(record!.width).toBe(32);
        expect(record!.referenceCount).toBe(2);
        expect(record!.createdAt).toBeInstanceOf(Date);
        expect(Array.from(new Uint8Array(await record!.blob.arrayBuffer()))).toEqual([1, 2, 3, 4, 5]);
    });

    it('サムネイルがあれば一緒に戻す', () => {
        const record = normalizeImageRecord({ id: 'img2', blob: base64, thumbnail: base64 });
        expect(record!.thumbnail).toBeInstanceOf(Blob);
    });

    it('欠けた数値フィールドは既定値で補う', () => {
        const record = normalizeImageRecord({ id: 'img3', blob: base64 });
        expect(record!.blob.type).toBe('image/webp');
        expect(record!.compressedSize).toBe(5);
        expect(record!.referenceCount).toBe(0);
    });

    it('blobが無ければnull', () => {
        expect(normalizeImageRecord({ id: 'img4' })).toBeNull();
        expect(normalizeImageRecord({ id: 'img5', blob: '' })).toBeNull();
    });
});
