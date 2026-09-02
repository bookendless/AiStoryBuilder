/**
 * データ移行（エクスポート／インポート）で共有する型定義
 */
import type { Project } from '../../types/project';

/** エクスポートファイルの形式バージョン（3で画像を含むようになった） */
export const EXPORT_FORMAT_VERSION = 3;

/** エクスポートに含める内容の指定 */
export interface ExportDataOptions {
  /** 対象プロジェクトID。未指定なら全プロジェクト */
  projectIds?: string[];
  /** 手動バックアップを含める（既定: true） */
  includeManualBackups?: boolean;
  /** 自動バックアップを含める（既定: true。UIでは既定オフ） */
  includeAutoBackups?: boolean;
  /** 章の履歴を含める（既定: true） */
  includeHistories?: boolean;
  /** AIログを含める（既定: true） */
  includeAILogs?: boolean;
  /** 画像データを含める（既定: true） */
  includeImages?: boolean;
  /** アプリ設定を含める（既定: projectIds未指定のときのみtrue） */
  includeSettings?: boolean;
  /** imageBoardのurl（Base64）を除去する軽量モード（既定: false） */
  excludeImageData?: boolean;
  /** 文字列ではなくBlobを返す（既定: false） */
  returnBlob?: boolean;
  /** gzip圧縮する（returnBlob時のみ有効。既定: false） */
  compress?: boolean;
}

export type ResolvedExportOptions = Required<Omit<ExportDataOptions, 'projectIds'>> & {
  projectIds?: string[];
};

/** エクスポートJSONに載る画像レコード（BlobはBase64文字列にする） */
export interface ExportedImage {
  id: string;
  blob: string;
  blobType: string;
  thumbnail?: string;
  thumbnailType?: string;
  originalFormat: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  createdAt: string | Date;
  lastAccessed: string | Date;
  referenceCount: number;
}

export type ImportTable = 'projects' | 'backups' | 'settings' | 'histories' | 'aiLogs' | 'images';

export type ImportCounts = Record<ImportTable, number>;

export interface ImportProgress {
  /** 読み込み済みバイト数 */
  bytesRead: number;
  /** ファイル全体のバイト数（不明な場合はundefined） */
  totalBytes?: number;
  /** テーブルごとの取り込み済み件数 */
  counts: ImportCounts;
}

export interface ImportSummary {
  /** ファイルのversion。読み取れなければnull */
  version: number | null;
  counts: ImportCounts;
  /** 形式が不正で取り込めなかったレコード数 */
  skipped: number;
  bytesRead: number;
}

export function createEmptyCounts(): ImportCounts {
  return { projects: 0, backups: 0, settings: 0, histories: 0, aiLogs: 0, images: 0 };
}

/** プロジェクト単位の容量内訳 */
export interface ProjectStorageInfo {
  projectId: string;
  title: string;
  updatedAt: Date;
  projectBytes: number;
  manualBackupCount: number;
  manualBackupBytes: number;
  autoBackupCount: number;
  autoBackupBytes: number;
  historyCount: number;
  historyBytes: number;
  aiLogCount: number;
  aiLogBytes: number;
  imageCount: number;
  imageBytes: number;
}

export interface StorageBreakdown {
  /** 更新日時の降順 */
  projects: ProjectStorageInfo[];
  settingsBytes: number;
  /** 削除済みプロジェクトの孤立分も含む自動バックアップ総数 */
  totalAutoBackupCount: number;
  totalAutoBackupBytes: number;
}

export function createEmptyProjectStorageInfo(
  project: Pick<Project, 'id' | 'title'> & { updatedAt: Date }
): ProjectStorageInfo {
  return {
    projectId: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
    projectBytes: 0,
    manualBackupCount: 0,
    manualBackupBytes: 0,
    autoBackupCount: 0,
    autoBackupBytes: 0,
    historyCount: 0,
    historyBytes: 0,
    aiLogCount: 0,
    aiLogBytes: 0,
    imageCount: 0,
    imageBytes: 0,
  };
}
