import type { AISuggestion } from './types';
import { HISTORY_STORAGE_PREFIX } from './constants';
import { exportFile } from '../../../utils/mobileExportUtils';
import { parseJsonLoose } from '../../../services/summarization/parseJson';
import { toProbability } from '../../../utils/probabilityBadge';

export const getHistoryStorageKey = (projectId: string, chapterId: string) =>
  `${HISTORY_STORAGE_PREFIX}_${projectId}_${chapterId}`;

export const formatTimestamp = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return `${timestamp}`;
  }
};

export const parseAISuggestions = (raw: string): AISuggestion[] => {
  // コードブロックや前後の説明文が付いた応答も拾う（素の JSON.parse では失敗して
  // 段落分割のフォールバックに落ちていた）。解析できない場合は null が返る。
  const parsed = parseJsonLoose<{
    suggestions?: { title?: string; body?: string; probability?: unknown }[];
  }>(raw);

  // 形が合っていれば、中身が空でもそのまま返す。ここで段落分割にフォールバックすると
  // 生のJSON文字列が提案本文になり、適用でそれが原稿に書き込まれてしまう
  // （0件は呼び出し側がエラーとして扱う）
  if (parsed && Array.isArray(parsed.suggestions)) {
    return parsed.suggestions
      .map((item, index) => ({
        id: `parsed-${Date.now()}-${index}`,
        title: item?.title?.trim() || `提案 ${index + 1}`,
        body: item?.body?.trim() || '',
        probability: toProbability(item?.probability),
      }))
      .filter((item) => item.body);
  }

  const fallbackSegments = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (fallbackSegments.length) {
    return fallbackSegments.map((segment, index) => ({
      id: `fallback-${Date.now()}-${index}`,
      title: `提案 ${index + 1}`,
      body: segment,
    }));
  }

  return [
    {
      id: `raw-${Date.now()}`,
      title: 'AI提案',
      body: raw.trim(),
    },
  ];
};

// プラットフォーム検出関数は共通ユーティリティからインポート
export { isTauriEnvironment, isAndroidEnvironment } from '../../../utils/platformUtils';

export const sanitizeFilename = (filename: string) => filename.replace(/[\\/:*?"<>|]/g, '_');

/**
 * テキストファイルをブラウザでダウンロード（モバイル対応）
 * mobileExportUtilsのexportFileを使用してTauriダイアログ/Share API/ブラウザダウンロードにフォールバック
 */
export const downloadTextFileInBrowser = async (filename: string, content: string): Promise<void> => {
  if (typeof window === 'undefined') return;

  await exportFile({
    filename,
    content,
    mimeType: 'text/plain',
    title: filename.replace(/\.[^/.]+$/, ''), // 拡張子を除いたファイル名
  });
};
