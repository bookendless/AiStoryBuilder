export const MODAL_TEXTAREA_MIN_HEIGHT = 260;
export const MODAL_TEXTAREA_MAX_HEIGHT = 1000;
export const MODAL_TEXTAREA_DEFAULT_HEIGHT = 420;
export const MODAL_TEXTAREA_HEIGHT_STEP = 80;
export const MODAL_FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24];
export const MODAL_LINE_HEIGHT_OPTIONS = [1.4, 1.6, 1.8];
export const MODAL_DEFAULT_FONT_SIZE = 16;
export const MODAL_DEFAULT_LINE_HEIGHT = 1.6;

export const HISTORY_STORAGE_PREFIX = 'chapterHistory';
export const HISTORY_MAX_ENTRIES = 30;
export const HISTORY_AUTO_SAVE_DELAY = 20000;

export type HistoryEntryType = 'auto' | 'manual' | 'restore';

export const HISTORY_TYPE_LABELS: Record<HistoryEntryType, string> = {
  auto: '自動保存',
  manual: '手動保存',
  restore: '復元前',
};

export const HISTORY_BADGE_CLASSES: Record<HistoryEntryType, string> = {
  auto: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  manual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  restore: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};

export const MAX_SUGGESTION_TEXT_LENGTH = 2000;

export type AIStatusTone = 'emerald' | 'blue' | 'purple';

export const AI_STATUS_STYLES: Record<
  AIStatusTone,
  {
    container: string;
    icon: string;
    title: string;
    detail: string;
  }
> = {
  emerald: {
    container: 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200',
    icon: 'bg-emerald-500 text-white',
    title: 'text-emerald-700 dark:text-emerald-200',
    detail: 'text-emerald-600 dark:text-emerald-300',
  },
  blue: {
    container: 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    icon: 'bg-blue-500 text-white',
    title: 'text-blue-700 dark:text-blue-200',
    detail: 'text-blue-600 dark:text-blue-300',
  },
  purple: {
    container: 'bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-200',
    icon: 'bg-purple-500 text-white',
    title: 'text-purple-700 dark:text-purple-200',
    detail: 'text-purple-600 dark:text-purple-300',
  },
};

