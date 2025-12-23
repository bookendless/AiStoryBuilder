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

export interface EvaluationResult {
    score: number; // 1-5
    summary: string;
    strengths: string[];
    weaknesses: string[];
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
