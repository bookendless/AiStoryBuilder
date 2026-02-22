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
}
