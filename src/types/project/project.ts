/**
 * プロジェクト関連の型定義
 */

import { Step } from '../common';
import { Character, CharacterRelationship } from './character';
import { Chapter } from './chapter';
import { GlossaryTerm, TimelineEvent, WorldSetting } from './world';
import { Foreshadowing } from './foreshadowing';
import { SavedEvaluation } from '../evaluation';
import { EmotionMap } from '../emotion';

/**
 * プロジェクト情報
 * アプリケーションの中核となるデータ構造
 */
export interface Project {
    id: string;
    title: string;
    description: string;
    coverImage?: string;
    genre?: string; // 後方互換性のため残す
    mainGenre?: string;
    subGenre?: string;
    targetReader?: string;
    projectTheme?: string;
    customMainGenre?: string;
    customSubGenre?: string;
    customTargetReader?: string;
    customTheme?: string;
    theme: string;
    imageBoard: Array<{
        id: string;
        url: string;
        imageId?: string;
        title: string;
        description?: string;
        category: 'character' | 'setting' | 'mood' | 'reference' | 'other';
        addedAt: Date;
    }>;
    progress: {
        character: number;
        plot: number;
        synopsis: number;
        chapter: number;
        draft: number;
    };
    structureProgress?: {
        introduction: boolean;
        development: boolean;
        climax: boolean;
        conclusion: boolean;
    };
    characters: Character[];
    plot: {
        // PlotStep1の基本設定
        theme: string;
        setting: string;
        hook: string;
        protagonistGoal: string; // 主人公の目標
        mainObstacle: string; // 主要な障害
        ending?: string; // 物語の結末
        // PlotStep2の構成詳細
        structure?: 'kishotenketsu' | 'three-act' | 'four-act' | 'heroes-journey' | 'beat-sheet' | 'mystery-suspense';
        ki?: string; // 起 - 導入
        sho?: string; // 承 - 展開
        ten?: string; // 転 - 転換
        ketsu?: string; // 結 - 結末
        act1?: string; // 第1幕 - 導入
        act2?: string; // 第2幕 - 展開
        act3?: string; // 第3幕 - 結末
        fourAct1?: string; // 第1幕 - 秩序
        fourAct2?: string; // 第2幕 - 混沌
        fourAct3?: string; // 第3幕 - 秩序
        fourAct4?: string; // 第4幕 - 混沌
        // ヒーローズ・ジャーニー
        hj1?: string; // 日常の世界
        hj2?: string; // 冒険への誘い
        hj3?: string; // 境界越え
        hj4?: string; // 試練と仲間
        hj5?: string; // 最大の試練
        hj6?: string; // 報酬
        hj7?: string; // 帰路
        hj8?: string; // 復活と帰還
        // ビートシート
        bs1?: string; // 導入 (Setup)
        bs2?: string; // 決断 (Break into Two)
        bs3?: string; // 試練 (Fun and Games)
        bs4?: string; // 転換点 (Midpoint)
        bs5?: string; // 危機 (All Is Lost)
        bs6?: string; // クライマックス (Finale)
        bs7?: string; // 結末 (Final Image)
        // ミステリー・サスペンス
        ms1?: string; // 発端（事件発生）
        ms2?: string; // 捜査（初期）
        ms3?: string; // 仮説とミスリード
        ms4?: string; // 第二の事件/急展開
        ms5?: string; // 手がかりの統合
        ms6?: string; // 解決（真相解明）
        ms7?: string; // エピローグ
    };
    evaluations?: SavedEvaluation[];
    synopsis: string;
    chapters: Chapter[];
    draft: string;
    createdAt: Date;
    updatedAt: Date;
    lastAccessed?: Date; // 最後にアクセスした日時
    glossary?: GlossaryTerm[];
    relationships?: CharacterRelationship[];
    timeline?: TimelineEvent[];
    worldSettings?: WorldSetting[];
    foreshadowings?: Foreshadowing[];
    writingStyle?: {
        style?: string; // 基本文体（例：「現代小説風」「文語調」など）
        perspective?: string; // 人称（一人称 / 三人称 / 神の視点）
        formality?: string; // 硬軟（硬め / 柔らかめ / 口語的 / 文語的）
        rhythm?: string; // リズム（短文中心 / 長短混合 / 流れるような長文）
        metaphor?: string; // 比喩表現（多用 / 控えめ / 詩的 / 写実的）
        dialogue?: string; // 会話比率（会話多め / 描写重視 / バランス型）
        emotion?: string; // 感情描写（内面重視 / 行動で示す / 抑制的）
        tone?: string; // トーン（緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）
        customStyle?: string; // カスタム基本文体
        customPerspective?: string; // カスタム人称
        customFormality?: string; // カスタム硬軟
        customRhythm?: string; // カスタムリズム
        customMetaphor?: string; // カスタム比喩表現
        customDialogue?: string; // カスタム会話比率
        customEmotion?: string; // カスタム感情描写
        customTone?: string; // カスタムトーン
    };
    emotionMap?: EmotionMap; // 感情マップ
    currentStep?: Exclude<Step, 'home'>; // 最後に編集中だったステップ（'home'は除外）
}

/**
 * ステップの進捗状態
 */
export interface StepProgress {
    step: string;
    completed: boolean;
}

/**
 * プロジェクト全体の進捗
 */
export interface ProjectProgress {
    percentage: number;
    completedSteps: number;
    totalSteps: number;
    steps: StepProgress[];
    nextStep?: string;
}
