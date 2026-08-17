import { ChapterHistorySource } from '../../../services/chapterHistoryService';

export interface StructureProgress {
  introduction: boolean;
  development: boolean;
  climax: boolean;
  conclusion: boolean;
}

export interface ChapterHistory {
  id: string;
  chapterId: string;
  timestamp: Date;
  /** 変更のソース種別（手動編集、AI生成、AI強化、復元） */
  source?: ChapterHistorySource;
  data: {
    title: string;
    summary: string;
    characters: string[];
    setting: string;
    mood: string;
    keyEvents: string[];
  };
}

export type SidebarSectionId = 'tableOfContents' | 'aiAssistant' | 'structureProgress' | 'aiLogs';

export interface ChapterFormData {
  title: string;
  summary: string;
  characters: string[];
  setting: string;
  mood: string;
  keyEvents: string[];
  /** この章の終わりに誰が何を知る／知らないままか */
  knowledge: string;
  /** この章で張る・仄めかす・回収する伏線 */
  foreshadowing: string;
}























































































