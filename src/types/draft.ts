import { HistoryEntryType } from '../constants/draft';

// HistoryEntryTypeを再エクスポート（後方互換性のため）
export type { HistoryEntryType };

export interface ChapterHistoryEntry {
  id: string;
  timestamp: number;
  content: string;
  type: HistoryEntryType;
  label: string;
}

export type AISuggestionType = 'rewrite' | 'tone' | 'summary';

export interface AISuggestion {
  id: string;
  title: string;
  body: string;
}

export interface ImprovementLog {
  id: string;
  timestamp: number;
  chapterId: string;
  phase1Critique: string; // フェーズ1の評価結果
  phase2Summary: string; // フェーズ2の改善戦略要約
  phase2Changes: string[]; // 主な変更点
  originalLength: number;
  revisedLength: number;
}

export type GenerationAction =
  | 'fullDraft'
  | 'continue'
  | 'description'
  | 'style'
  | 'shorten'
  | 'improve'
  | 'selfRefine';

export type SecondaryTab = 'ai' | 'display' | 'history' | 'project' | 'aiLogs';

export type AIStatusTone = 'emerald' | 'blue' | 'purple';

export type AILogType = 'generateSingle' | 'continue' | 'suggestions';

export interface SuggestionPromptPayload {
  selectedText: string;
  chapterTitle?: string;
  chapterSummary?: string;
  projectTitle?: string;
}
