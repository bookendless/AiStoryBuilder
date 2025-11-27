// 共通のAIログエントリ型
export interface AILogEntry {
  id: string;
  timestamp: Date;
  type: string;
  prompt: string;
  response: string;
  error?: string;
  // 追加のメタデータ（オプション）
  [key: string]: any;
}

