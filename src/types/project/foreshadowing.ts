/**
 * 伏線（Foreshadowing）関連の型定義
 */

/**
 * 伏線のポイント（設置、ヒント、回収）
 */
export interface ForeshadowingPoint {
    id: string;
    chapterId: string;           // 関連する章のID
    type: 'plant' | 'hint' | 'payoff';  // 設置/ヒント/回収
    description: string;         // 具体的な描写・内容
    lineReference?: string;      // 該当する文章の引用（任意）
    createdAt: Date;
}

/**
 * 伏線
 */
export interface Foreshadowing {
    id: string;
    title: string;               // 伏線のタイトル（例：「主人公の過去の秘密」）
    description: string;         // 伏線の説明・意図
    importance: 'high' | 'medium' | 'low';  // 重要度
    status: 'planted' | 'hinted' | 'resolved' | 'abandoned';  // ステータス
    category: 'character' | 'plot' | 'world' | 'mystery' | 'relationship' | 'other';

    // 伏線のポイント（複数可能）
    points: ForeshadowingPoint[];

    // 関連要素
    relatedCharacterIds?: string[];   // 関連キャラクター
    relatedChapterIds?: string[];     // 関連する章（ポイント以外で関連づけたい場合）

    // 計画
    plannedPayoffChapterId?: string;  // 回収予定の章
    plannedPayoffDescription?: string; // 回収方法の計画

    // メタ情報
    tags?: string[];
    notes?: string;              // 作者メモ
    createdAt: Date;
    updatedAt: Date;
}
