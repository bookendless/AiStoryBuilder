/**
 * 創造ポイント（Phase C）の型定義
 *
 * 大型生成（あらすじ・章立て）で AI が推奨案を最後まで生成しつつ、
 * 「作者の判断が物語を分ける箇所」を2〜4点メタデータとして付記する。
 * UI（CreativePointCards）は別案選択でその生成を再実行する。
 *
 * Project スキーマには保存せず、PendingResult に同梱して一時的に扱う。
 */

/** 分岐の別案 */
export interface CreativePointAlternative {
    id: string;
    /** 別案の要約（1行） */
    summary: string;
    /** その別案を選んだ場合の帰結（1行） */
    consequence: string;
    /**
     * AIがその案を選ぶ確率（0.0〜1.0）。実際の確率ではなく「無難さ」の主観的な目安で、
     * 低いほど大胆な案であることを示す。AIが返さない場合は undefined。
     */
    probability?: number;
}

/** 作者の判断ポイント */
export interface CreativePoint {
    id: string;
    /** 判断ポイントのラベル（例:「主人公の動機」） */
    label: string;
    /** 現在の生成での扱い（推奨案・1行） */
    current: string;
    /** 別案（1〜3件） */
    alternatives: CreativePointAlternative[];
}

/**
 * 確認モーダルで作者が選んだ「このポイントはこの別案で」という選択。
 * 複数ポイントの選択をまとめて1回の再生成に渡すために使う。
 */
export interface CreativePointSelection {
    point: CreativePoint;
    alternative: CreativePointAlternative;
}
