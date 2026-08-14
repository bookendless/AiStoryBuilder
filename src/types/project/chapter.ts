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
