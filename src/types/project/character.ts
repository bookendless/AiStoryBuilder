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
    /**
     * 設定の補記。整合性ガードの指摘から「同じ矛盾を繰り返さないための注意書き」を
     * 追記する先。草案生成のキャラクター情報にも含めるため、書いた内容は次の生成から効く
     * （プロンプトに載らない欄に書いても再発防止にならないため、意図的に載せている）。
     */
    notes?: string;
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
    fromCallsTo?: string; // fromがtoをどう呼ぶか（例: "花子さん"）
    toCallsFrom?: string; // toがfromをどう呼ぶか（例: "兄貴"）
}
