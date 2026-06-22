/**
 * AIおまかせ骨組み生成（Phase B）の型定義
 *
 * 新規プロジェクトの説明文（任意項目）を「物語の種の一行」として活用し、
 * plot1 の6項目・主要キャラクター・推奨構成テンプレートをワンショットで下書き生成する。
 */

import { Character } from './project/character';
import { StructureInference } from '../services/plotStructure/inferStructure';

/** 骨組み生成の入力（新規プロジェクト作成時の基本情報） */
export interface SkeletonSeed {
    title: string;
    description: string; // 物語の種（必須。空なら骨組み生成は実行しない）
    mainGenre?: string;
    subGenre?: string;
    targetReader?: string;
    projectTheme?: string;
}

/** plot1 の6項目（Project.plot のサブセット） */
export interface SkeletonPlot {
    theme: string;
    setting: string;
    hook: string;
    protagonistGoal: string;
    mainObstacle: string;
    ending: string;
}

/** 骨組み生成の結果（採用前のドラフト） */
export interface SkeletonResult {
    plot: SkeletonPlot;
    /** 主要キャラクターのドラフト（id 付与済み） */
    characters: Character[];
    /** 推奨構成テンプレート（判定不能なら undefined） */
    structure?: StructureInference;
}
