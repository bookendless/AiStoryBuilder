// 感情の種類
export type EmotionType = 
  | 'joy'           // 喜び
  | 'sadness'       // 悲しみ
  | 'anger'         // 怒り
  | 'fear'          // 恐怖
  | 'surprise'      // 驚き
  | 'anticipation'  // 期待
  | 'disgust'       // 嫌悪
  | 'trust'         // 信頼
  | 'tension'       // 緊張
  | 'relief'        // 安堵
  | 'excitement'    // 興奮
  | 'melancholy';   // 憂鬱

// 感情の強度（0-100）
export type EmotionIntensity = number;

// 章ごとの感情スコア
export interface ChapterEmotion {
  id: string;
  chapterId: string;
  
  // 各感情の強度（0-100）
  emotions: Record<EmotionType, EmotionIntensity>;
  
  // 総合的な感情スコア（-100 to +100）
  // 負の値: ネガティブ、正の値: ポジティブ
  overallScore: number;
  
  // 感情の複雑度（複数の感情が混在している度合い）
  complexity: number; // 0-100
  
  // テンポ（0-100: 0=静、100=激）
  pace: number;
  
  // 読者の予測される没入度（0-100）
  immersionScore: number;
  
  // AI分析結果
  aiAnalysis?: {
    dominantEmotion: EmotionType;
    emotionalArc: 'rising' | 'falling' | 'stable' | 'fluctuating';
    issues?: string[]; // 問題点
    suggestions?: string[]; // 改善提案
    analysisSource: 'draft' | 'summary'; // 分析の元となったデータ
  };
  
  // AI分析のログ（生のレスポンスや分析過程）
  aiLogs?: {
    rawResponse?: string; // AIの生のレスポンス全文
    prompt?: string; // 使用したプロンプト
    analysisNotes?: string; // AIが出力した分析メモや説明（JSON以外の部分）
    parsedData?: string; // パースされたJSONデータ（デバッグ用）
  };
  
  // メタデータ
  analyzedAt: Date;
  analyzedBy: 'auto' | 'manual' | 'ai';
  confidence: number; // AI分析の信頼度（0-100）
}

// 感情の遷移（章間の感情の変化）
export interface EmotionTransition {
  fromChapterId: string;
  toChapterId: string;
  transitionType: 'smooth' | 'sharp' | 'gradual' | 'abrupt';
  emotionalGap: number; // 感情の差（0-100）
  isOptimal: boolean; // 最適な遷移かどうか
}

// プロジェクト全体の感情マップ
export interface EmotionMap {
  projectId: string;
  chapters: ChapterEmotion[];
  transitions: EmotionTransition[];
  
  // 全体分析
  overallAnalysis?: {
    averageEmotion: number;
    emotionalRange: number; // 感情の幅
    peakChapters: string[]; // 感情のピークとなる章
    valleyChapters: string[]; // 感情の谷となる章
    rhythm: 'monotone' | 'varied' | 'dynamic' | 'erratic';
    recommendations: string[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// AI分析のリクエスト
export interface EmotionAnalysisRequest {
  chapter: {
    id: string;
    title: string;
    summary: string;
    draft?: string;
    mood?: string;
    setting?: string;
    keyEvents?: string[];
  };
  previousChapterEmotion?: ChapterEmotion;
  projectContext: {
    genre: string;
    theme: string;
    targetReader?: string;
  };
}

// AI分析のレスポンス
export interface EmotionAnalysisResponse {
  emotions: Record<EmotionType, EmotionIntensity>;
  overallScore: number;
  pace: number;
  immersionScore: number;
  dominantEmotion: EmotionType;
  emotionalArc: 'rising' | 'falling' | 'stable' | 'fluctuating';
  issues?: string[];
  suggestions?: string[];
  analysisSource: 'draft' | 'summary';
  // AI分析のログ
  aiLogs?: {
    rawResponse?: string;
    prompt?: string;
    analysisNotes?: string;
    parsedData?: string;
  };
}

