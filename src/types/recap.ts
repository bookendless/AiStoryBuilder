/**
 * 「前回までのあらすじ」リキャップ関連の型定義
 *
 * 数日ぶりにプロジェクトを開いた作者へ、連載アニメの「前回までのあらすじ」風の
 * ナレーションと執筆再開の提案を表示する機能で使用する。
 */

import { NonHomeStep } from './common';

/** AI生成されるリキャップ本文 */
export interface RecapAIContent {
    /** ナレーション調の「前回までのあらすじ」 */
    narrative: string;
    /** 「今日はここから」の執筆再開提案（1〜3個） */
    suggestions: string[];
}

/** localStorage に保存するリキャップキャッシュ（シグネチャ一致ならAI再生成しない） */
export interface RecapCache {
    projectId: string;
    /** 生成入力（章構成・本文量など）のシグネチャ */
    signature: string;
    generatedAt: number;
    content: RecapAIContent;
}

/** ローカル計算する執筆再開地点（AI呼び出し不要） */
export interface RecapResumePoint {
    /** 最後に編集していたステップ */
    step?: NonHomeStep;
    /** ステップの表示ラベル */
    stepLabel?: string;
    /** 最後に草案が書かれた章のタイトル */
    lastDraftedChapterTitle?: string;
    /** 次に草案を書く章（最初の未草案章）のタイトル */
    nextChapterTitle?: string;
}

/** リキャップのAI生成部の状態 */
export type RecapAIState = 'idle' | 'unconfigured' | 'running' | 'done' | 'error';
