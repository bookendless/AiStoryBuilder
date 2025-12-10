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
}


































