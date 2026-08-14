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
  /**
   * AIがその案を選ぶ確率（0.0〜1.0）。低いほど大胆な案であることを示す。
   * AIが返さない場合や、段落分割のフォールバックで作った提案では undefined。
   */
  probability?: number;
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
  | 'selfRefine'
  | 'critique'
  | 'fixWeaknesses'
  | 'fixCharacter';

export type SecondaryTab = 'ai' | 'display' | 'history' | 'project' | 'aiLogs';

export type AIStatusTone = 'emerald' | 'blue' | 'purple';

export type AILogType = 'generateSingle' | 'continue' | 'suggestions';

export interface SuggestionPromptPayload {
  selectedText: string;
  chapterTitle?: string;
  chapterSummary?: string;
  projectTitle?: string;
}

export interface WeaknessItem {
  aspect?: string;
  problem?: string;
  score?: number;
  solutions?: string[];
  /** 問題の該当箇所の本文引用（AIが返さない場合もあるため欠落許容） */
  quote?: string;
}

/** AI章執筆時にプロンプトに含めるコンテキスト情報の設定 */
export interface ContextSettings {
  glossary: boolean;
  relationships: boolean;
  worldSettings: boolean;
  timeline: boolean;
}

