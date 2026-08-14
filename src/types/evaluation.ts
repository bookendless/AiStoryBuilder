export type EvaluationMode = 'structure' | 'character' | 'style' | 'persona';
export type EvaluationStrictness = 'gentle' | 'normal' | 'strict' | 'harsh';

export interface EvaluationRequest {
    mode: EvaluationMode;
    content: string; // The story content to evaluate (e.g., synopsis, chapter text)
    strictness?: EvaluationStrictness; // 評価の厳しさレベル（デフォルト: 'normal'）
    context?: {
        title?: string;
        theme?: string;
        genre?: string;
        targetAudience?: string;
        characters?: string; // Character descriptions
    };
}

/** 改善点と、その根拠となる本文の引用 */
export interface EvaluationWeakness {
    point: string;
    /** 本文に実在する引用。AIが引用を返さない場合や、実在照合に通らなかった場合は undefined */
    quote?: string;
}

export interface EvaluationResult {
    score: number; // 1-5
    summary: string;
    strengths: string[];
    weaknesses: string[];
    /**
     * 引用つきの改善点。weaknesses と同じ内容を引用つきで並べたもの。
     * weaknesses を残しているのは、保存済みの講評（Project.evaluations）が文字列配列で
     * 永続化されているため。表示側は weaknessDetails があればそちらを優先する。
     */
    weaknessDetails?: EvaluationWeakness[];
    improvements: string[]; // Actionable advice
    detailedAnalysis: string; // Markdown formatted detailed analysis
    persona?: string; // 読者ペルソナモード時のペルソナ詳細
}

export interface SavedEvaluation extends EvaluationResult {
    id: string;
    date: Date;
    mode: EvaluationMode;
    targetType: 'synopsis' | 'chapter' | 'custom' | 'file' | 'whole-story';
    targetTitle?: string;
}
