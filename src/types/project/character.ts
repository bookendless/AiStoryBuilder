/**
 * キャラクター関連の型定義
 */

/**
 * キャラクター情報
 */
export interface Character {
    id: string;
    name: string;
    role: string;
    appearance: string;
    personality: string;
    background: string;
    image?: string;
    speechStyle?: string; // キャラクターの口調・話し方
}

/**
 * キャラクター間の関係性
 */
export interface CharacterRelationship {
    id: string;
    from: string;
    to: string;
    type: 'friend' | 'enemy' | 'family' | 'romantic' | 'mentor' | 'rival' | 'other';
    strength: number;
    description?: string;
    notes?: string;
}
