/**
 * 共通型定義
 * アプリケーション全体で使用される基本的な型を定義
 */

/**
 * アプリケーションのステップ（画面）を表す型
 * - home: ホーム画面
 * - character: キャラクター作成
 * - plot1: プロット基本設定
 * - plot2: プロット構成詳細
 * - synopsis: あらすじ
 * - chapter: 章立て
 * - draft: 草案執筆
 * - review: レビュー・評価
 * - export: エクスポート
 */
export type Step =
    | 'home'
    | 'character'
    | 'plot1'
    | 'plot2'
    | 'synopsis'
    | 'chapter'
    | 'draft'
    | 'review'
    | 'export';

/**
 * ホーム以外のステップを表す型
 * プロジェクトに保存する際に使用
 */
export type NonHomeStep = Exclude<Step, 'home'>;
