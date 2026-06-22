/**
 * 小説断片インポート（Story Importer）関連の型定義
 *
 * ユーザーが持つ小説の断片・未完成作品（プレーンな小説文）を読み込み、
 * AiStoryBuilder の構成基準に合わせて AI 解析し、新規プロジェクトの各項目へ投入する機能で使用する。
 *
 * 続編構成（sequel）と同型のウィザード／AIRunner／スナップショット基盤を再利用しつつ、
 * 抽出は「忠実な再構成」を目的とするため、概要系と列挙系で戦略を分ける（services/import を参照）。
 */

import { Character, Project } from '../project';

/** AI呼び出しランナー（続編構成と共通） */
export type { AIRunner } from '../sequel';

/** 取り込み元ファイル（並び順を保持） */
export interface ImportSourceFile {
    id: string;
    name: string;
    content: string;
    order: number;
}

/**
 * 全体要約から抽出した概要フィールド（ユーザーが確認・編集可能）
 * Project のコア項目に対応する。
 */
export interface ImportOverview {
    /** タイトル案 */
    title: string;
    /** 主ジャンル */
    mainGenre: string;
    /** サブジャンル */
    subGenre: string;
    /** 想定読者 */
    targetReader: string;
    /** あらすじ（400〜500文字程度） */
    synopsis: string;
    /** プロット基本設定（Project.plot のサブセット） */
    plot: {
        theme: string;
        setting: string;
        hook: string;
        protagonistGoal: string;
        mainObstacle: string;
    };
}

/**
 * 解析結果一式（review ステップで編集し、finalize でプロジェクト化する）
 */
export interface ImportResult {
    /** 概要（タイトル・ジャンル・あらすじ・プロット基本） */
    overview: ImportOverview;
    /** 抽出・名寄せ済みのキャラクター（id は新規採番） */
    characters: Character[];
    /** 原文から推測した文体設定（機械計測+AI分類。判定できなかった軸は空文字） */
    writingStyle?: Project['writingStyle'];
    /** 文体の特徴メモ（AIの自由記述。確認画面の根拠表示用） */
    styleNote?: string;
    /** 文体見本（原文の中間部からの逐語抜粋。AI執筆の few-shot に使う） */
    styleSample?: string;
    /** 取り込んだ原文（逐語保存。AIを通さない） */
    originalProse: string;
}

/**
 * インポートウィザードのステップ
 */
export type ImportWizardStep =
    | 'input'      // ファイル選択・並べ替え／貼り付け
    | 'analyzing'  // AI解析の進行中
    | 'review'     // 抽出結果の確認・編集
    | 'finalize';  // タイトル入力・作成

/**
 * sessionStorage に保存する中断・再開用の状態
 */
export interface ImportWizardSnapshot {
    step: ImportWizardStep;
    result: ImportResult | null;
    savedAt: number;
}

/** パイプライン進捗の通知（続編構成の SequelProgress と同形状） */
export interface ImportProgress {
    phase: string;
    current: number;
    total: number;
}
