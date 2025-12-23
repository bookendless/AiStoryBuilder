// 共通のAIログエントリ型
export interface ParsedChapter {
  title: string;
  summary: string;
  setting?: string;
  mood?: string;
  keyEvents?: string[];
  characters?: string[];
}

export interface ParsedCharacter {
  name: string;
  role?: string;
  appearance?: string;
  personality?: string;
  background?: string;
}

export interface AILogEntry {
  id: string;
  timestamp: Date;
  type: string;
  prompt: string;
  response: string;
  error?: string;
  // 追加のメタデータ（オプション）
  suggestionType?: string;
  parsedChapters?: ParsedChapter[];
  parsedCharacters?: ParsedCharacter[];
  characterName?: string;
  fieldLabel?: string;
  structureType?: string;
  chapterId?: string;
  [key: string]: unknown;
}

