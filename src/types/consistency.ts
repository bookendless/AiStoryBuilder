/**
 * 整合性ガード（設定ドリフト検知）関連の型定義
 *
 * 設定台帳（キャラクター・用語集・世界観・時系列）と各章の本文を突き合わせ、
 * 容姿・口調・呼称・用語表記・時系列の矛盾を検出する機能で使用する。
 */

/** 指摘カテゴリ */
export type ConsistencyCategory =
    | 'appearance'   // 容姿・身体的特徴の矛盾
    | 'narration'    // 一人称・口調のブレ
    | 'address'      // キャラクター間の呼称のブレ
    | 'terminology'  // 用語・固有名詞の表記ゆれ（台帳との不一致）
    | 'timeline';    // 時系列・季節・経過時間の矛盾

/** 指摘の深刻度 */
export type ConsistencySeverity = 'high' | 'medium' | 'low';

/** 指摘の対応状態 */
export type ConsistencyIssueStatus = 'open' | 'ignored' | 'resolved';

/** カテゴリの表示ラベル */
export const CONSISTENCY_CATEGORY_LABELS: Record<ConsistencyCategory, string> = {
    appearance: '容姿・特徴',
    narration: '一人称・口調',
    address: '呼称',
    terminology: '用語・表記',
    timeline: '時系列',
};

/** 深刻度の表示ラベル */
export const CONSISTENCY_SEVERITY_LABELS: Record<ConsistencySeverity, string> = {
    high: '高',
    medium: '中',
    low: '低',
};

/** 1件の整合性指摘 */
export interface ConsistencyIssue {
    id: string;
    chapterId: string;
    chapterTitle: string;
    category: ConsistencyCategory;
    severity: ConsistencySeverity;
    /** 本文中に実在する引用（一字一句一致。validateIssues で照合済み） */
    quote: string;
    /** 何がどう矛盾しているか */
    description: string;
    /** 根拠（設定台帳のどの記述、または章内のどの記述と矛盾するか） */
    evidence: string;
    /** 修正案（任意） */
    suggestion?: string;
    status: ConsistencyIssueStatus;
}

/** スキャン結果レポート（Project.consistencyReports に保存） */
export interface ConsistencyReport {
    id: string;
    createdAt: Date;
    /** スキャン対象にした章のIDリスト */
    targetChapterIds: string[];
    /** 対象カテゴリ */
    categories: ConsistencyCategory[];
    issues: ConsistencyIssue[];
}

/** バリデーション済みだがID・章情報付与前の指摘（scanChapter の戻り値） */
export type ScannedIssue = Pick<
    ConsistencyIssue,
    'category' | 'severity' | 'quote' | 'description' | 'evidence' | 'suggestion'
>;
