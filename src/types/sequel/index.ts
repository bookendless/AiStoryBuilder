/**
 * 続編構成（Sequel Composer）関連の型定義
 *
 * 完成済みプロジェクトを元に、AI補助で続編プロジェクトの土台を生成する機能で使用する。
 */

import { Project } from '../project';

/**
 * 章単位のダイジェスト（要約集約の中間表現）
 * 通常モードでは Chapter.summary をそのまま使用し、
 * 詳細モードでは Chapter.draft を要約して生成する。
 */
export interface ChapterDigest {
    id: string;
    title: string;
    summary: string;
}

/**
 * 元作品から抽出した要素（ユーザーが確認・編集可能なテキスト群）
 */
export interface SequelExtraction {
    /** ストーリー全体の要約（map-reduce で集約した結果） */
    storyDigest: string;
    /** キャラクターの成長・変化 */
    characterGrowth: string;
    /** 関係性の変化 */
    relationshipChanges: string;
    /** 世界観の変化点 */
    worldChanges: string;
    /** 未解決の課題・伏線・葛藤（続編のフックに活用） */
    openThreads: string;
}

/**
 * 続編向けに生成したプロジェクト要素
 */
export interface SequelElements {
    /** 続編のあらすじ */
    synopsis: string;
    /** 続編のプロット基本設定（Project.plot のサブセット） */
    plot: {
        theme: string;
        setting: string;
        hook: string;
        protagonistGoal: string;
        mainObstacle: string;
    };
    /** 更新後のキャラクター（元作品から引き継ぎ + AI更新） */
    characters: Project['characters'];
    /** 更新後の世界観設定（元作品から引き継ぎ + 変化点ノート） */
    worldSettings: NonNullable<Project['worldSettings']>;
}

/**
 * 続編構成ウィザードのステップ
 */
export type SequelWizardStep =
    | 'select'        // プロジェクト選択
    | 'extracting'    // AI抽出の進行中
    | 'reviewExtract' // 抽出結果の確認・編集
    | 'reviewSequel'  // 続編要素の確認・編集
    | 'finalize';     // タイトル入力・作成

/**
 * sessionStorage に保存する中断・再開用の状態
 */
export interface SequelWizardSnapshot {
    sourceProjectId: string;
    isDetailedMode: boolean;
    step: SequelWizardStep;
    extraction: SequelExtraction | null;
    elements: SequelElements | null;
    savedAt: number;
}

/** AI呼び出しを抽象化したランナー（services層をReactから切り離すため） */
export type AIRunner = (
    prompt: string,
    opts?: { signal?: AbortSignal; temperature?: number; timeout?: number }
) => Promise<string>;

/** パイプライン進捗の通知 */
export interface SequelProgress {
    phase: string;
    current: number;
    total: number;
}
