/**
 * 平行世界ラボ（What-if分岐シミュレータ）関連の型定義
 *
 * 完成済み・執筆中の物語の展開に「もし◯◯だったら」という反実仮想を投げ、
 * 後続章への波及をレポート化する機能で使用する。本編プロジェクトは変更しない。
 */

/** 波及の影響度 */
export type WhatIfImpactSeverity = 'major' | 'moderate' | 'minor';

export const WHAT_IF_SEVERITY_LABELS: Record<WhatIfImpactSeverity, string> = {
    major: '大',
    moderate: '中',
    minor: '小',
};

/** 後続章1つへの波及 */
export interface WhatIfChapterImpact {
    /** 対応する章のID（照合できなかった場合は空文字） */
    chapterId: string;
    /** 章タイトル */
    title: string;
    /** 波及の内容 */
    impact: string;
    severity: WhatIfImpactSeverity;
}

/** What-if分岐レポート */
export interface WhatIfReport {
    /** 分岐直後に何が起こるか */
    immediate: string;
    /** 後続章それぞれへの波及 */
    chapterImpacts: WhatIfChapterImpact[];
    /** 壊れる・変質する伏線 */
    brokenForeshadowings: string[];
    /** 変わる関係性 */
    relationshipChanges: string[];
    /** 新たに生まれる展開の可能性 */
    newPossibilities: string[];
    /** 総評（本編に取り込む価値があるか） */
    verdict: string;
}

/** 分岐点の指定 */
export interface WhatIfBranchPoint {
    type: 'chapter' | 'custom';
    /** type='chapter' の場合の分岐章ID */
    chapterId?: string;
    /** 分岐点の説明（章タイトル or 自由記述） */
    description: string;
}

/** What-ifシナリオ（Project.whatIfScenarios に保存） */
export interface WhatIfScenario {
    id: string;
    createdAt: Date;
    branchPoint: WhatIfBranchPoint;
    /** 「もし◯◯だったら」の前提 */
    premise: string;
    report?: WhatIfReport;
    /** この分岐から生成したサンドボックスプロジェクトのID */
    sandboxProjectId?: string;
}
