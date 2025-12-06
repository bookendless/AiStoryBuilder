/**
 * キャラクター憑依モード関連の型定義
 */

/**
 * 憑依セッション
 */
export interface CharacterPossessionSession {
  id: string;
  characterId: string;
  createdAt: Date;
  lastActiveAt: Date;
  messages: PossessionMessage[];
  mode: 'chat' | 'scene' | 'relationship';
}

/**
 * 憑依メッセージ
 */
export interface PossessionMessage {
  id: string;
  role: 'user' | 'character';
  content: string;
  timestamp: Date;
}

/**
 * 憑依チャットのプロップス
 */
export interface CharacterPossessionChatProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  projectId: string;
}

/**
 * キャラクター日記エントリー
 */
export interface CharacterDiaryEntry {
  id: string;
  characterId: string;
  chapterId?: string;
  chapterTitle?: string;
  title: string;
  content: string;
  createdAt: Date;
  emotion?: string;
  isAiGenerated?: boolean;
}



