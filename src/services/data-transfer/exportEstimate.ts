/**
 * エクスポートサイズの推定とファイル名生成
 *
 * 容量内訳（StorageBreakdown）と選択状態から、実際に書き出す前に
 * おおよそのファイルサイズを求める。UIから同期的に呼べる純関数。
 */
import type { ProjectStorageInfo, StorageBreakdown } from './types';

/** エクスポートに含める内容（UIのチェックボックスと1対1） */
export interface ExportContentOptions {
  includeManualBackups: boolean;
  includeAutoBackups: boolean;
  includeHistories: boolean;
  includeAILogs: boolean;
  includeImages: boolean;
  includeSettings: boolean;
}

/** 既定値。肥大化の主因である自動バックアップだけ既定で外す */
export const DEFAULT_EXPORT_CONTENT: ExportContentOptions = {
  includeManualBackups: true,
  includeAutoBackups: false,
  includeHistories: true,
  includeAILogs: true,
  includeImages: true,
  includeSettings: true,
};

/** JSONの外枠（キー名や括弧）のおおよそのバイト数 */
const ENVELOPE_BYTES = 120;

/** Base64は元データの約4/3のサイズになる */
function base64Size(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/** プロジェクト1件をエクスポートしたときの推定バイト数 */
export function estimateProjectSize(
  info: ProjectStorageInfo,
  options: ExportContentOptions
): number {
  let total = info.projectBytes;
  if (options.includeManualBackups) total += info.manualBackupBytes;
  if (options.includeAutoBackups) total += info.autoBackupBytes;
  if (options.includeHistories) total += info.historyBytes;
  if (options.includeAILogs) total += info.aiLogBytes;
  if (options.includeImages) total += base64Size(info.imageBytes);
  return total;
}

/**
 * 選択したプロジェクト群のエクスポート推定バイト数
 * 複数のプロジェクトが同じ画像を参照している場合は重複して数えるため、
 * 実際のファイルサイズよりやや大きめに出る
 */
export function estimateExportSize(
  breakdown: StorageBreakdown,
  selectedIds: ReadonlySet<string>,
  options: ExportContentOptions
): number {
  let total = ENVELOPE_BYTES;
  for (const info of breakdown.projects) {
    if (!selectedIds.has(info.projectId)) continue;
    total += estimateProjectSize(info, options);
  }
  if (options.includeSettings) {
    total += breakdown.settingsBytes;
  }
  return total;
}

/** 選択したプロジェクトの自動バックアップ件数と容量を合計する */
export function sumAutoBackups(
  breakdown: StorageBreakdown,
  selectedIds: ReadonlySet<string>
): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  for (const info of breakdown.projects) {
    if (!selectedIds.has(info.projectId)) continue;
    count += info.autoBackupCount;
    bytes += info.autoBackupBytes;
  }
  return { count, bytes };
}

/** ファイル名に使えない文字を置き換える */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

function toDateStamp(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * エクスポートファイル名を組み立てる
 * 作品を1つだけ選んだときはタイトルを入れて、後から中身が分かるようにする
 */
export function buildExportFilename(
  selectedProjects: ReadonlyArray<{ title: string }>,
  allProjects: boolean,
  date: Date,
  variant: 'full' | 'lightweight' = 'full'
): string {
  const stamp = toDateStamp(date);

  if (variant === 'lightweight') {
    return `story-builder-lightweight-${stamp}.json`;
  }

  if (!allProjects && selectedProjects.length === 1) {
    const title = sanitizeFilename(selectedProjects[0].title || '無題').slice(0, 60).trim();
    return `story-builder-${title || '無題'}-${stamp}.json`;
  }

  return `story-builder-backup-${stamp}.json`;
}
