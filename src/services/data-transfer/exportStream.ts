/**
 * エクスポートJSONの組み立て
 *
 * 全プロジェクト／作品別のどちらも同じ生成器で扱う。JSON文字列を
 * 少しずつ yield するので、呼び出し側は文字列に連結することも
 * Blobの断片として積むこともできる（巨大データでもヒープに全量を載せない）。
 */
import type { Project } from '../../types/project';
import type {
  StoredProject,
  ProjectBackup,
  AppSettings,
  StoredChapterHistoryEntry,
  StoredAILogEntry,
  StoredImage,
} from '../databaseService';
import type { ExportDataOptions, ResolvedExportOptions, ExportedImage } from './types';
import { EXPORT_FORMAT_VERSION } from './types';
import { blobToBase64 } from '../../utils/base64';

export type BackupType = 'manual' | 'auto';

/** エクスポート対象データの供給元。テストでは配列から作れる */
export interface ExportSource {
  projects(): AsyncIterable<StoredProject>;
  backups(types: BackupType[]): AsyncIterable<ProjectBackup>;
  histories(): AsyncIterable<StoredChapterHistoryEntry>;
  aiLogs(): AsyncIterable<StoredAILogEntry>;
  settings(): Promise<AppSettings[]>;
  images(imageIds: string[]): AsyncIterable<StoredImage>;
}

/** オプションの既定値を解決する */
export function resolveExportOptions(options?: ExportDataOptions): ResolvedExportOptions {
  const returnBlob = options?.returnBlob ?? false;
  return {
    projectIds: options?.projectIds,
    includeManualBackups: options?.includeManualBackups ?? true,
    includeAutoBackups: options?.includeAutoBackups ?? true,
    includeHistories: options?.includeHistories ?? true,
    includeAILogs: options?.includeAILogs ?? true,
    includeImages: options?.includeImages ?? true,
    // 作品別エクスポートに端末全体の設定を混ぜない
    includeSettings: options?.includeSettings ?? !options?.projectIds,
    excludeImageData: options?.excludeImageData ?? false,
    returnBlob,
    // 圧縮はBlob出力時のみ意味を持つ
    compress: (options?.compress ?? false) && returnBlob,
  };
}

/** プロジェクトが参照している画像IDを集める */
export function collectImageIds(project: Pick<Project, 'imageBoard'>): string[] {
  if (!Array.isArray(project.imageBoard)) return [];
  return project.imageBoard
    .map(img => img?.imageId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** imageBoardからurl（Base64データ）を落とした軽量版を作る */
export function stripImageBoardUrls<T extends Pick<Project, 'imageBoard'>>(project: T): T {
  return {
    ...project,
    imageBoard: (project.imageBoard ?? []).map(img => ({
      id: img.id,
      imageId: img.imageId,
      title: img.title,
      description: img.description,
      category: img.category,
      addedAt: img.addedAt,
    })),
  } as T;
}

/** 画像レコードをJSONに載せられる形へ変換する */
export async function serializeImage(image: StoredImage): Promise<ExportedImage> {
  const exported: ExportedImage = {
    id: image.id,
    blob: await blobToBase64(image.blob),
    blobType: image.blob.type || 'image/webp',
    originalFormat: image.originalFormat,
    originalSize: image.originalSize,
    compressedSize: image.compressedSize,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt,
    lastAccessed: image.lastAccessed,
    referenceCount: image.referenceCount,
  };

  if (image.thumbnail) {
    exported.thumbnail = await blobToBase64(image.thumbnail);
    exported.thumbnailType = image.thumbnail.type || exported.blobType;
  }

  return exported;
}

function selectedBackupTypes(options: ResolvedExportOptions): BackupType[] {
  const types: BackupType[] = [];
  if (options.includeManualBackups) types.push('manual');
  if (options.includeAutoBackups) types.push('auto');
  return types;
}

/**
 * エクスポートJSONを断片として生成する
 * 整形（インデント）は行わない。同じ内容でもファイルが2〜3割小さくなる
 */
export async function* buildExportChunks(
  source: ExportSource,
  options: ResolvedExportOptions,
  now: Date = new Date()
): AsyncGenerator<string> {
  yield `{"version":${EXPORT_FORMAT_VERSION},"exportedAt":${JSON.stringify(now.toISOString())},"projects":[`;

  const imageIds = new Set<string>();
  let first = true;
  for await (const project of source.projects()) {
    if (options.includeImages) {
      for (const id of collectImageIds(project)) {
        imageIds.add(id);
      }
    }
    const payload = options.excludeImageData ? stripImageBoardUrls(project) : project;
    yield `${first ? '' : ','}${JSON.stringify(payload)}`;
    first = false;
  }

  yield '],"backups":[';
  const types = selectedBackupTypes(options);
  if (types.length > 0) {
    first = true;
    for await (const backup of source.backups(types)) {
      if (!types.includes(backup.type)) continue;
      yield `${first ? '' : ','}${JSON.stringify(backup)}`;
      first = false;
    }
  }

  yield '],"settings":';
  yield options.includeSettings ? JSON.stringify(await source.settings()) : '[]';

  yield ',"histories":[';
  if (options.includeHistories) {
    first = true;
    for await (const history of source.histories()) {
      yield `${first ? '' : ','}${JSON.stringify(history)}`;
      first = false;
    }
  }

  yield '],"aiLogs":[';
  if (options.includeAILogs) {
    first = true;
    for await (const log of source.aiLogs()) {
      yield `${first ? '' : ','}${JSON.stringify(log)}`;
      first = false;
    }
  }

  yield '],"images":[';
  if (options.includeImages && imageIds.size > 0) {
    first = true;
    for await (const image of source.images([...imageIds])) {
      yield `${first ? '' : ','}${JSON.stringify(await serializeImage(image))}`;
      first = false;
    }
  }

  yield ']}';
}
