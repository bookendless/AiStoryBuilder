/**
 * インポートデータの正規化
 *
 * エクスポートファイルの中身は信頼できないため、各レコードをunknownとして
 * 検証しながらDBに入れられる形へ変換する。ストリーミング取り込みと
 * 従来の一括取り込みの両方から使う純関数群。
 */
import type {
  StoredProject,
  ProjectBackup,
  AppSettings,
  StoredChapterHistoryEntry,
  StoredAILogEntry,
  StoredImage,
} from '../databaseService';
import { base64ToBlob } from '../../utils/base64';

/** 型安全な日付変換 */
export function safeDateConversion(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 主キーが使える形かどうか。ここを通さないとbulkPutがバッチごと失敗する */
function hasValidId(value: unknown): value is Record<string, unknown> & { id: string } {
  return isObject(value) && typeof value.id === 'string' && value.id.length > 0;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** プロジェクトレコードの正規化（日付フィールドをDateへ戻す） */
export function normalizeProjectRecord(raw: unknown): StoredProject | null {
  if (!hasValidId(raw)) return null;

  const updatedAt = safeDateConversion(raw.updatedAt);

  const normalized = {
    ...raw,
    createdAt: safeDateConversion(raw.createdAt),
    updatedAt,
    imageBoard: isArray(raw.imageBoard)
      ? raw.imageBoard.map((img: unknown) => {
        if (!isObject(img)) return img;
        return { ...img, addedAt: safeDateConversion(img.addedAt) };
      })
      : [],
    chapters: isArray(raw.chapters)
      ? raw.chapters.map((chapter: unknown) => {
        if (!isObject(chapter)) return chapter;
        const result: Record<string, unknown> = { ...chapter };
        if (chapter.createdAt) {
          result.createdAt = safeDateConversion(chapter.createdAt);
        }
        if (chapter.updatedAt) {
          result.updatedAt = safeDateConversion(chapter.updatedAt);
        }
        return result;
      })
      : [],
    // 索引フィールドが欠けた古いファイルでも一覧に出せるように補う
    version: toNumber(raw.version, 1),
    lastSaved: raw.lastSaved ? safeDateConversion(raw.lastSaved) : updatedAt,
  };

  return normalized as unknown as StoredProject;
}

/** バックアップレコードの正規化（圧縮済みは文字列のまま、旧形式のオブジェクトはJSON文字列化） */
export function normalizeBackupRecord(raw: unknown): ProjectBackup | null {
  if (!hasValidId(raw)) return null;

  const backupData = raw.data;

  if (typeof backupData === 'string') {
    return {
      ...raw,
      createdAt: safeDateConversion(raw.createdAt),
      data: backupData,
      compressed: raw.compressed === true,
    } as unknown as ProjectBackup;
  }

  if (isObject(backupData)) {
    const jsonData = JSON.stringify({
      ...backupData,
      createdAt: safeDateConversion(backupData.createdAt),
      updatedAt: safeDateConversion(backupData.updatedAt),
      imageBoard: isArray(backupData.imageBoard)
        ? backupData.imageBoard.map((img: unknown) => {
          if (!isObject(img)) return img;
          return { ...img, addedAt: safeDateConversion(img.addedAt) };
        })
        : [],
    });

    return {
      ...raw,
      createdAt: safeDateConversion(raw.createdAt),
      data: jsonData,
      compressed: false,
    } as unknown as ProjectBackup;
  }

  return null;
}

/** アプリ設定レコードの正規化 */
export function normalizeSettingsRecord(raw: unknown): AppSettings | null {
  if (!hasValidId(raw)) return null;
  return raw as unknown as AppSettings;
}

/** 章履歴レコードの正規化（timestampは数値） */
export function normalizeHistoryRecord(raw: unknown): StoredChapterHistoryEntry | null {
  if (!hasValidId(raw)) return null;
  return {
    ...raw,
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
  } as unknown as StoredChapterHistoryEntry;
}

/** AIログレコードの正規化（timestampはDate） */
export function normalizeAILogRecord(raw: unknown): StoredAILogEntry | null {
  if (!hasValidId(raw)) return null;
  return {
    ...raw,
    timestamp: safeDateConversion(raw.timestamp),
  } as unknown as StoredAILogEntry;
}

/** 画像レコードの正規化（Base64をBlobへ戻す） */
export function normalizeImageRecord(raw: unknown): StoredImage | null {
  if (!hasValidId(raw)) return null;
  if (typeof raw.blob !== 'string' || raw.blob.length === 0) return null;

  const blobType = toStringValue(raw.blobType, 'image/webp');

  let blob: Blob;
  try {
    blob = base64ToBlob(raw.blob, blobType);
  } catch {
    return null;
  }

  let thumbnail: Blob | undefined;
  if (typeof raw.thumbnail === 'string' && raw.thumbnail.length > 0) {
    try {
      thumbnail = base64ToBlob(raw.thumbnail, toStringValue(raw.thumbnailType, blobType));
    } catch {
      thumbnail = undefined;
    }
  }

  return {
    id: raw.id,
    blob,
    thumbnail,
    originalFormat: toStringValue(raw.originalFormat, blobType),
    originalSize: toNumber(raw.originalSize, blob.size),
    compressedSize: toNumber(raw.compressedSize, blob.size),
    width: toNumber(raw.width, 0),
    height: toNumber(raw.height, 0),
    createdAt: safeDateConversion(raw.createdAt),
    lastAccessed: safeDateConversion(raw.lastAccessed),
    referenceCount: toNumber(raw.referenceCount, 0),
  };
}
