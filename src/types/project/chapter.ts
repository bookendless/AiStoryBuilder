/**
 * 章（チャプター）関連の型定義
 */

/**
 * 章情報
 */
export interface Chapter {
    id: string;
    title: string;
    summary: string;
    characters?: string[]; // 登場キャラクターのIDリスト
    setting?: string; // 設定・場所
    mood?: string; // 雰囲気・ムード
    keyEvents?: string[]; // 重要な出来事
    draft?: string; // 章単位の草案
    /**
     * この章で誰が何を知る／知らないままか。
     * 「出来事」ではなく「認識の変化」を持たせることで、草案生成時に
     * 登場人物が知らないはずの情報を口にするのを防ぐ。
     */
    knowledge?: string;
    /**
     * この章で張る・仄めかす・回収する伏線の計画メモ（自由記述）。
     * 追跡台帳は Foreshadowing 型の役割で、こちらは生成時に渡す計画。
     */
    foreshadowing?: string;
    foreshadowingRefs?: string[]; // 関連伏線IDのリスト
    /**
     * summary を確定した時点の draft のハッシュ。現在の draft のハッシュと一致しなければ
     * 「あらすじが本文より古い」と判定する（services/summary/freshness.ts）。
     * 機械抽出の暫定あらすじや履歴復元のように「現在の本文から作られていない」ことが
     * 分かっている場合は SUMMARY_SOURCE_UNVERIFIED を入れる。
     * 未設定は判定不能として「古くない」扱い（この機能より前の章が一斉にバッジ表示されるのを防ぐ）。
     */
    summarySourceHash?: string;
}
