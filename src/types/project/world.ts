/**
 * 世界観設定関連の型定義
 */

/**
 * 用語集の項目
 */
export interface GlossaryTerm {
    id: string;
    term: string;
    reading?: string;
    definition: string;
    category: 'character' | 'location' | 'concept' | 'item' | 'other';
    notes?: string;
    createdAt: Date;
}

/**
 * タイムラインイベント
 */
export interface TimelineEvent {
    id: string;
    title: string;
    description: string;
    date?: string;
    order: number;
    chapterId?: string;
    characterIds?: string[];
    category: 'plot' | 'character' | 'world' | 'other';
}

/**
 * 世界観設定
 */
export interface WorldSetting {
    id: string;
    category: 'geography' | 'society' | 'culture' | 'technology' | 'magic' | 'history' | 'politics' | 'economy' | 'religion' | 'other';
    title: string;
    content: string; // 詳細な説明
    relatedLocations?: string[]; // 関連する場所（GlossaryTermのID）
    relatedCharacters?: string[]; // 関連するキャラクター（CharacterのID）
    relatedEvents?: string[]; // 関連するイベント（TimelineEventのID）
    tags?: string[]; // 検索・分類用のタグ
    createdAt: Date;
    updatedAt: Date;
    aiGenerated?: boolean; // AI生成かどうか
    aiPrompt?: string; // 生成に使ったプロンプト（参考用）
}
