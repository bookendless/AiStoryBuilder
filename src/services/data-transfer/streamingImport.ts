/**
 * ストリーミング方式のデータ取り込み
 *
 * ファイル全体をJSON.parseすると数百MBのファイルでタブごと落ちるため、
 * チャンク単位で解析し、レコードが溜まるたびにDBへ書き出す。
 * メモリ使用量はファイルサイズではなく「1レコード＋バッチ」で頭打ちになる。
 */
import { JSONParser } from '@streamparser/json';
import type {
  StoredProject,
  ProjectBackup,
  AppSettings,
  StoredChapterHistoryEntry,
  StoredAILogEntry,
  StoredImage,
} from '../databaseService';
import type { ImportCounts, ImportProgress, ImportSummary, ImportTable } from './types';
import { EXPORT_FORMAT_VERSION, createEmptyCounts } from './types';
import {
  normalizeProjectRecord,
  normalizeBackupRecord,
  normalizeSettingsRecord,
  normalizeHistoryRecord,
  normalizeAILogRecord,
  normalizeImageRecord,
} from './normalizeImportRecords';
import { utf8ByteLength } from '../../utils/formatBytes';

/** 取り込めない形式のファイルを与えられたときのエラー */
export class ImportFormatError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ImportFormatError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** 書き込み先テーブル。Dexie.Tableの構造的部分集合なのでテストではモックを渡せる */
export interface ImportTargetTables {
  projects: { bulkPut(items: StoredProject[]): PromiseLike<unknown> };
  backups: { bulkPut(items: ProjectBackup[]): PromiseLike<unknown> };
  settings: { bulkPut(items: AppSettings[]): PromiseLike<unknown> };
  chapterHistories: { bulkPut(items: StoredChapterHistoryEntry[]): PromiseLike<unknown> };
  aiLogs: { bulkPut(items: StoredAILogEntry[]): PromiseLike<unknown> };
  images: { bulkPut(items: StoredImage[]): PromiseLike<unknown> };
}

export interface ImportFromChunksOptions {
  db: ImportTargetTables;
  onProgress?: (progress: ImportProgress) => void;
  totalBytes?: number;
  /** テーブルごとのバッチ件数（テスト用に上書きできる） */
  batchLimits?: Partial<Record<ImportTable, number>>;
}

const SECTION_KEYS = [
  'version',
  'exportedAt',
  'projects',
  'backups',
  'settings',
  'histories',
  'aiLogs',
  'images',
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

const PARSER_PATHS = [
  '$.version',
  '$.exportedAt',
  '$.projects.*',
  '$.backups.*',
  '$.settings.*',
  '$.histories.*',
  '$.aiLogs.*',
  '$.images.*',
];

const DEFAULT_BATCH_LIMITS: Record<ImportTable, number> = {
  projects: 5,
  backups: 10,
  settings: 10,
  histories: 200,
  aiLogs: 200,
  images: 5,
};

function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value);
}

/**
 * 値がエクスポートJSONのどのセクションに属するかを判定する
 * 配列要素のときはスタックにセクション名が、トップレベルの値のときはkeyに入る
 */
export function sectionOf(
  stack: ReadonlyArray<{ key?: unknown }>,
  key: unknown
): SectionKey | undefined {
  for (const entry of stack) {
    if (isSectionKey(entry.key)) return entry.key;
  }
  return isSectionKey(key) ? key : undefined;
}

/** BlobをUint8Arrayのチャンク列に変換する */
export async function* blobToChunks(
  file: Blob,
  chunkSize = 4 * 1024 * 1024
): AsyncIterable<Uint8Array> {
  if (typeof file.stream === 'function') {
    const reader = file.stream().getReader();
    try {
      for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // File.streamが無い環境（古いWebView等）向けのフォールバック
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const slice = file.slice(offset, offset + chunkSize);
    yield new Uint8Array(await slice.arrayBuffer());
  }
}

interface BufferMap {
  projects: StoredProject[];
  backups: ProjectBackup[];
  settings: AppSettings[];
  histories: StoredChapterHistoryEntry[];
  aiLogs: StoredAILogEntry[];
  images: StoredImage[];
}

/**
 * チャンク列からデータを取り込む
 * @param chunks UTF-8バイト列または文字列の非同期イテラブル
 */
export async function importFromChunks(
  chunks: AsyncIterable<Uint8Array | string>,
  options: ImportFromChunksOptions
): Promise<ImportSummary> {
  const { db, onProgress, totalBytes } = options;
  const limits = { ...DEFAULT_BATCH_LIMITS, ...options.batchLimits };

  const buffers: BufferMap = {
    projects: [],
    backups: [],
    settings: [],
    histories: [],
    aiLogs: [],
    images: [],
  };
  const counts: ImportCounts = createEmptyCounts();

  let version: number | null = null;
  let skipped = 0;
  let sawSection = false;
  let bytesRead = 0;
  let parseError: Error | null = null;

  const parser = new JSONParser({ paths: PARSER_PATHS, keepStack: false });

  parser.onError = (err: Error) => {
    if (!parseError) parseError = err;
  };

  // onValueは同期で呼ばれる。ここでawaitしてはならない（解析の途中で書き込みを挟むと壊れる）
  parser.onValue = ({ value, key, stack, partial }) => {
    if (partial) return;
    const section = sectionOf(stack, key);
    if (!section) return;
    sawSection = true;

    switch (section) {
      case 'version':
        version = typeof value === 'number' ? value : null;
        return;
      case 'exportedAt':
        return;
      case 'projects': {
        const record = normalizeProjectRecord(value);
        if (record) buffers.projects.push(record); else skipped++;
        return;
      }
      case 'backups': {
        const record = normalizeBackupRecord(value);
        if (record) buffers.backups.push(record); else skipped++;
        return;
      }
      case 'settings': {
        const record = normalizeSettingsRecord(value);
        if (record) buffers.settings.push(record); else skipped++;
        return;
      }
      case 'histories': {
        const record = normalizeHistoryRecord(value);
        if (record) buffers.histories.push(record); else skipped++;
        return;
      }
      case 'aiLogs': {
        const record = normalizeAILogRecord(value);
        if (record) buffers.aiLogs.push(record); else skipped++;
        return;
      }
      case 'images': {
        const record = normalizeImageRecord(value);
        if (record) buffers.images.push(record); else skipped++;
        return;
      }
    }
  };

  const flush = async (table: ImportTable): Promise<void> => {
    switch (table) {
      case 'projects': {
        const batch = buffers.projects.splice(0);
        if (batch.length === 0) return;
        await db.projects.bulkPut(batch);
        counts.projects += batch.length;
        return;
      }
      case 'backups': {
        const batch = buffers.backups.splice(0);
        if (batch.length === 0) return;
        await db.backups.bulkPut(batch);
        counts.backups += batch.length;
        return;
      }
      case 'settings': {
        const batch = buffers.settings.splice(0);
        if (batch.length === 0) return;
        await db.settings.bulkPut(batch);
        counts.settings += batch.length;
        return;
      }
      case 'histories': {
        const batch = buffers.histories.splice(0);
        if (batch.length === 0) return;
        await db.chapterHistories.bulkPut(batch);
        counts.histories += batch.length;
        return;
      }
      case 'aiLogs': {
        const batch = buffers.aiLogs.splice(0);
        if (batch.length === 0) return;
        await db.aiLogs.bulkPut(batch);
        counts.aiLogs += batch.length;
        return;
      }
      case 'images': {
        const batch = buffers.images.splice(0);
        if (batch.length === 0) return;
        await db.images.bulkPut(batch);
        counts.images += batch.length;
        return;
      }
    }
  };

  const flushIfNeeded = async (force: boolean): Promise<void> => {
    for (const table of Object.keys(buffers) as ImportTable[]) {
      if (force || buffers[table].length >= limits[table]) {
        await flush(table);
      }
    }
  };

  const failIfParseError = (): void => {
    if (parseError) {
      throw new ImportFormatError(
        '無効なデータ形式です（JSONの解析に失敗しました）',
        { cause: parseError }
      );
    }
  };

  for await (const chunk of chunks) {
    // ドキュメントが閉じた後の余白（末尾の改行など）は読み飛ばす
    if (parser.isEnded) {
      bytesRead += typeof chunk === 'string' ? utf8ByteLength(chunk) : chunk.byteLength;
      continue;
    }

    parser.write(chunk);
    failIfParseError();

    bytesRead += typeof chunk === 'string' ? utf8ByteLength(chunk) : chunk.byteLength;

    // 解析が止まっているこの位置でのみDBへ書き出す
    await flushIfNeeded(false);
    onProgress?.({ bytesRead, totalBytes, counts: { ...counts } });
  }

  // 文書が閉じていれば isEnded は true。閉じていない場合だけ end() を呼び、
  // 「途中で切れている」ことを検出する
  if (!parser.isEnded) {
    parser.end();
    if (parseError) {
      throw new ImportFormatError(
        '無効なデータ形式です（ファイルが途中で終わっている可能性があります）',
        { cause: parseError }
      );
    }
  }

  await flushIfNeeded(true);

  if (!sawSection) {
    throw new ImportFormatError(
      '無効なデータ形式です（AI Story Builderのエクスポートファイルではありません）'
    );
  }

  if (version !== null && version > EXPORT_FORMAT_VERSION) {
    console.warn(
      `より新しい形式のファイルです（version ${version}）。一部のデータは取り込めない可能性があります。`
    );
  }

  onProgress?.({ bytesRead, totalBytes, counts: { ...counts } });

  return { version, counts, skipped, bytesRead };
}
