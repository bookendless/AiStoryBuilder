export type HistoryEntryType = 'auto' | 'manual' | 'restore';

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
  phase1Critique: string;
  phase2Summary: string;
  phase2Changes: string[];
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

export type AIStatusTone = 'emerald' | 'blue' | 'purple';

export type SecondaryTab = 'ai' | 'display' | 'history' | 'project' | 'aiLogs';

export interface SuggestionPromptPayload {
  selectedText: string;
  chapterTitle?: string;
  chapterSummary?: string;
  projectTitle?: string;
}

export type AILogType = 'generateSingle' | 'continue' | 'suggestions';


