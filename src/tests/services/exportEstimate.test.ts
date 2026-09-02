import { describe, it, expect } from 'vitest';
import {
    DEFAULT_EXPORT_CONTENT,
    buildExportFilename,
    estimateExportSize,
    estimateProjectSize,
    sumAutoBackups,
    type ExportContentOptions,
} from '../../services/data-transfer/exportEstimate';
import type { ProjectStorageInfo, StorageBreakdown } from '../../services/data-transfer/types';

function makeInfo(id: string, overrides: Partial<ProjectStorageInfo> = {}): ProjectStorageInfo {
    return {
        projectId: id,
        title: `作品${id}`,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        projectBytes: 1000,
        manualBackupCount: 1,
        manualBackupBytes: 100,
        autoBackupCount: 10,
        autoBackupBytes: 10000,
        historyCount: 2,
        historyBytes: 200,
        aiLogCount: 3,
        aiLogBytes: 300,
        imageCount: 1,
        imageBytes: 3000,
        ...overrides,
    };
}

const breakdown: StorageBreakdown = {
    projects: [makeInfo('p1'), makeInfo('p2')],
    settingsBytes: 500,
    totalAutoBackupCount: 25,
    totalAutoBackupBytes: 25000,
};

const allOff: ExportContentOptions = {
    includeManualBackups: false,
    includeAutoBackups: false,
    includeHistories: false,
    includeAILogs: false,
    includeImages: false,
    includeSettings: false,
};

describe('DEFAULT_EXPORT_CONTENT', () => {
    it('自動バックアップだけ既定で外れている', () => {
        expect(DEFAULT_EXPORT_CONTENT.includeAutoBackups).toBe(false);
        expect(DEFAULT_EXPORT_CONTENT.includeManualBackups).toBe(true);
        expect(DEFAULT_EXPORT_CONTENT.includeHistories).toBe(true);
        expect(DEFAULT_EXPORT_CONTENT.includeAILogs).toBe(true);
        expect(DEFAULT_EXPORT_CONTENT.includeImages).toBe(true);
    });
});

describe('estimateProjectSize', () => {
    it('何も含めなければ作品本体のみ', () => {
        expect(estimateProjectSize(makeInfo('p1'), allOff)).toBe(1000);
    });

    it('選んだ内容だけ加算する', () => {
        expect(estimateProjectSize(makeInfo('p1'), { ...allOff, includeManualBackups: true })).toBe(1100);
        expect(estimateProjectSize(makeInfo('p1'), { ...allOff, includeAutoBackups: true })).toBe(11000);
        expect(estimateProjectSize(makeInfo('p1'), { ...allOff, includeHistories: true })).toBe(1200);
        expect(estimateProjectSize(makeInfo('p1'), { ...allOff, includeAILogs: true })).toBe(1300);
    });

    it('画像はBase64化で約4/3になる', () => {
        expect(estimateProjectSize(makeInfo('p1'), { ...allOff, includeImages: true })).toBe(1000 + 4000);
    });
});

describe('estimateExportSize', () => {
    it('選択した作品だけ合計する', () => {
        const oneSelected = estimateExportSize(breakdown, new Set(['p1']), allOff);
        const twoSelected = estimateExportSize(breakdown, new Set(['p1', 'p2']), allOff);
        expect(twoSelected - oneSelected).toBe(1000);
    });

    it('設定を含めるときだけ設定分を足す', () => {
        const without = estimateExportSize(breakdown, new Set(['p1']), allOff);
        const withSettings = estimateExportSize(breakdown, new Set(['p1']), { ...allOff, includeSettings: true });
        expect(withSettings - without).toBe(500);
    });

    it('自動バックアップを含めるとサイズが大きく増える', () => {
        const without = estimateExportSize(breakdown, new Set(['p1', 'p2']), allOff);
        const withAuto = estimateExportSize(breakdown, new Set(['p1', 'p2']), { ...allOff, includeAutoBackups: true });
        expect(withAuto - without).toBe(20000);
    });

    it('何も選ばなければ外枠のぶんだけ', () => {
        expect(estimateExportSize(breakdown, new Set(), allOff)).toBeLessThan(200);
    });
});

describe('sumAutoBackups', () => {
    it('選択した作品の自動バックアップを合計する', () => {
        expect(sumAutoBackups(breakdown, new Set(['p1']))).toEqual({ count: 10, bytes: 10000 });
        expect(sumAutoBackups(breakdown, new Set(['p1', 'p2']))).toEqual({ count: 20, bytes: 20000 });
        expect(sumAutoBackups(breakdown, new Set())).toEqual({ count: 0, bytes: 0 });
    });
});

describe('buildExportFilename', () => {
    const date = new Date('2026-03-04T05:06:07.000Z');

    it('1作品だけならタイトルを入れる', () => {
        expect(buildExportFilename([{ title: '銀河の果て' }], false, date))
            .toBe('story-builder-銀河の果て-2026-03-04.json');
    });

    it('ファイル名に使えない文字を置き換える', () => {
        expect(buildExportFilename([{ title: '作品:名/2' }], false, date))
            .toBe('story-builder-作品_名_2-2026-03-04.json');
    });

    it('複数作品やすべて選択のときは共通の名前にする', () => {
        expect(buildExportFilename([{ title: 'A' }, { title: 'B' }], false, date))
            .toBe('story-builder-backup-2026-03-04.json');
        expect(buildExportFilename([{ title: 'A' }], true, date))
            .toBe('story-builder-backup-2026-03-04.json');
    });

    it('軽量エクスポートは専用の名前にする', () => {
        expect(buildExportFilename([{ title: 'A' }], false, date, 'lightweight'))
            .toBe('story-builder-lightweight-2026-03-04.json');
    });

    it('タイトルが空でも名前を作れる', () => {
        expect(buildExportFilename([{ title: '' }], false, date))
            .toBe('story-builder-無題-2026-03-04.json');
    });
});
