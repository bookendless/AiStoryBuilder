import type { AISuggestion } from './types';
import { HISTORY_STORAGE_PREFIX } from './constants';

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
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .map((item: { title?: string; body?: string }, index: number) => ({
          id: `parsed-${Date.now()}-${index}`,
          title: item?.title?.trim() || `提案 ${index + 1}`,
          body: item?.body?.trim() || '',
        }))
        .filter((item: AISuggestion) => item.body);
    }
  } catch {
    // フォールバック処理へ
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

export const downloadTextFileInBrowser = (filename: string, content: string) => {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


