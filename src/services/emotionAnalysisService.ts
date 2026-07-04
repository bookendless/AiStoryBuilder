import { aiService } from './aiService';
import { AISettings } from '../types/ai';
import {
  EmotionAnalysisRequest,
  EmotionAnalysisResponse,
  ChapterEmotion,
  EmotionTransition,
  EmotionMap,
  EmotionType,
} from '../types/emotion';
import { parseAIResponse } from '../utils/aiResponseParser';
import { buildEmotionAnalysisPrompt as generateEmotionAnalysisPrompt } from './prompts/emotion';

/**
 * 感情分析を実行
 */
export const analyzeChapterEmotion = async (
  request: EmotionAnalysisRequest,
  settings: AISettings
): Promise<EmotionAnalysisResponse> => {
  const prompt = generateEmotionAnalysisPrompt(request);
  
  try {
    const response = await aiService.generateContent({
      prompt,
      type: 'draft',
      settings,
      context: undefined,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // JSONレスポンスを解析
    const parsed = parseAIResponse(response.content, 'json');
    
    if (!parsed.success || !parsed.data) {
      console.error('AIレスポンスの解析に失敗:', parsed.error);
      console.error('生のレスポンス:', response.content.substring(0, 500));
      throw new Error(`AIレスポンスの解析に失敗しました: ${parsed.error || '不明なエラー'}`);
    }

    // データの検証と正規化
    const data = parsed.data as Record<string, unknown>;
    
    // デバッグ用ログ
    console.log('パースされたデータ:', JSON.stringify(data, null, 2));
    
    // 必須フィールドの確認
    if (!data || typeof data !== 'object') {
      console.error('データがオブジェクトではありません:', typeof data, data);
      throw new Error('データがオブジェクト形式ではありません');
    }
    
    if (!data.emotions || typeof data.emotions !== 'object') {
      console.error('emotionsフィールドが不正:', data.emotions);
      throw new Error('emotionsフィールドが含まれていません');
    }
    
    if (data.overallScore === undefined || data.overallScore === null) {
      console.error('overallScoreフィールドが不正:', data.overallScore);
      throw new Error('overallScoreフィールドが含まれていません');
    }
    
    if (data.pace === undefined || data.pace === null) {
      console.error('paceフィールドが不正:', data.pace);
      throw new Error('paceフィールドが含まれていません');
    }
    
    if (data.immersionScore === undefined || data.immersionScore === null) {
      console.error('immersionScoreフィールドが不正:', data.immersionScore);
      throw new Error('immersionScoreフィールドが含まれていません');
    }

    // 感情データの正規化（不足している感情タイプを0で補完）
    const allEmotionTypes: EmotionType[] = [
      'joy', 'sadness', 'anger', 'fear', 'surprise', 
      'anticipation', 'tension', 'excitement', 'disgust', 
      'trust', 'relief', 'melancholy'
    ];
    
    const normalizedEmotions: Record<EmotionType, number> = {} as Record<EmotionType, number>;
    const emotionsData = data.emotions as Record<string, unknown> | undefined;
    allEmotionTypes.forEach(type => {
      const value = emotionsData?.[type];
      normalizedEmotions[type] = typeof value === 'number' ? value : 0;
    });

    // AIの生レスポンスから分析メモを抽出（JSON以外の部分）
    let analysisNotes: string | undefined;
    const rawContent = response.content.trim();
    
    // コードブロックやJSON以外の部分を抽出
    // JSONがコードブロック内にある場合、その前後のテキストを抽出
    const jsonBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      // コードブロックの前後のテキストを抽出
      const beforeJson = rawContent.substring(0, rawContent.indexOf(jsonBlockMatch[0])).trim();
      const afterJson = rawContent.substring(rawContent.indexOf(jsonBlockMatch[0]) + jsonBlockMatch[0].length).trim();
      const notes = [beforeJson, afterJson].filter(Boolean).join('\n\n');
      if (notes) {
        analysisNotes = notes;
      }
    } else {
      // JSONオブジェクトの前後のテキストを抽出
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const beforeJson = rawContent.substring(0, rawContent.indexOf(jsonMatch[0])).trim();
        const afterJson = rawContent.substring(rawContent.indexOf(jsonMatch[0]) + jsonMatch[0].length).trim();
        const notes = [beforeJson, afterJson].filter(Boolean).join('\n\n');
        if (notes) {
          analysisNotes = notes;
        }
      }
    }

    // 型安全な変換関数
    const isValidEmotionType = (value: unknown): value is EmotionType => {
      return typeof value === 'string' && allEmotionTypes.includes(value as EmotionType);
    };
    
    const isValidEmotionalArc = (value: unknown): value is 'rising' | 'falling' | 'stable' | 'fluctuating' => {
      return typeof value === 'string' && ['rising', 'falling', 'stable', 'fluctuating'].includes(value);
    };
    
    const isValidAnalysisSource = (value: unknown): value is 'draft' | 'summary' => {
      return typeof value === 'string' && (value === 'draft' || value === 'summary');
    };

    return {
      emotions: normalizedEmotions,
      overallScore: Math.max(-100, Math.min(100, Number(data.overallScore) || 0)),
      pace: Math.max(0, Math.min(100, Number(data.pace) || 50)),
      immersionScore: Math.max(0, Math.min(100, Number(data.immersionScore) || 50)),
      dominantEmotion: isValidEmotionType(data.dominantEmotion) ? data.dominantEmotion : 'tension',
      emotionalArc: isValidEmotionalArc(data.emotionalArc) ? data.emotionalArc : 'stable',
      issues: Array.isArray(data.issues) ? data.issues.filter((item): item is string => typeof item === 'string') : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((item): item is string => typeof item === 'string') : [],
      analysisSource: isValidAnalysisSource(data.analysisSource) ? data.analysisSource : (request.chapter.draft ? 'draft' : 'summary'),
      aiLogs: {
        rawResponse: response.content, // 生のレスポンス全文
        prompt: prompt, // 使用したプロンプト
        analysisNotes: analysisNotes, // JSON以外の分析メモ
        parsedData: JSON.stringify(data, null, 2), // パースされたJSONデータ
      },
    };
  } catch (error) {
    console.error('感情分析エラー:', error);
    throw error;
  }
};

/**
 * ChapterEmotionオブジェクトを作成
 */
export const createChapterEmotion = (
  chapterId: string,
  analysisResponse: EmotionAnalysisResponse,
  previousChapterEmotion?: ChapterEmotion
): ChapterEmotion => {
  // 信頼度の計算
  // 草案ベース: 80-100, 概要ベース: 50-80
  const baseConfidence = analysisResponse.analysisSource === 'draft' ? 90 : 65;
  
  // 前章との整合性を考慮して信頼度を調整
  let confidence = baseConfidence;
  if (previousChapterEmotion) {
    const scoreGap = Math.abs(analysisResponse.overallScore - previousChapterEmotion.overallScore);
    // 急激な変化（60以上）は信頼度を下げる
    if (scoreGap > 60) {
      confidence = Math.max(50, confidence - 10);
    }
  }

  return {
    id: `emotion-${chapterId}-${Date.now()}`,
    chapterId,
    emotions: analysisResponse.emotions,
    overallScore: analysisResponse.overallScore,
    complexity: calculateComplexity(analysisResponse.emotions),
    pace: analysisResponse.pace,
    immersionScore: analysisResponse.immersionScore,
    aiAnalysis: {
      dominantEmotion: analysisResponse.dominantEmotion,
      emotionalArc: analysisResponse.emotionalArc,
      issues: analysisResponse.issues,
      suggestions: analysisResponse.suggestions,
      analysisSource: analysisResponse.analysisSource,
    },
    aiLogs: analysisResponse.aiLogs, // AI分析のログを保存
    analyzedAt: new Date(),
    analyzedBy: 'ai',
    confidence,
  };
};

/**
 * 感情の複雑度を計算
 */
const calculateComplexity = (emotions: Record<EmotionType, number>): number => {
  const values = Object.values(emotions);
  const nonZeroCount = values.filter(v => v > 10).length;
  const variance = calculateVariance(values);
  
  // 複数の感情が混在し、分散が大きいほど複雑度が高い
  return Math.min(100, (nonZeroCount / values.length) * 50 + (variance / 1000) * 50);
};

/**
 * 分散を計算
 */
const calculateVariance = (values: number[]): number => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
};

/**
 * 感情遷移を分析
 */
export const analyzeEmotionTransition = (
  from: ChapterEmotion,
  to: ChapterEmotion
): EmotionTransition => {
  const gap = Math.abs(to.overallScore - from.overallScore);
  
  let transitionType: EmotionTransition['transitionType'];
  if (gap < 20) {
    transitionType = 'smooth';
  } else if (gap < 40) {
    transitionType = 'gradual';
  } else if (gap < 60) {
    transitionType = 'sharp';
  } else {
    transitionType = 'abrupt';
  }
  
  // 最適な遷移かどうかを判定
  // 簡易的な判定: 急激すぎる変化（80以上）は最適でない
  const isOptimal = gap < 80;
  
  return {
    fromChapterId: from.chapterId,
    toChapterId: to.chapterId,
    transitionType,
    emotionalGap: gap,
    isOptimal,
  };
};

/**
 * 全体の感情マップを分析
 */
export const analyzeOverallEmotionMap = (
  emotionMap: EmotionMap
): EmotionMap['overallAnalysis'] => {
  if (emotionMap.chapters.length === 0) {
    return undefined;
  }

  const scores = emotionMap.chapters.map(c => c.overallScore);
  const averageEmotion = scores.reduce((a, b) => a + b, 0) / scores.length;
  const emotionalRange = Math.max(...scores) - Math.min(...scores);
  
  // ピークと谷を特定（上位20%、下位20%）
  const sortedScores = [...scores].sort((a, b) => b - a);
  const peakThreshold = sortedScores[Math.floor(sortedScores.length * 0.2)] || sortedScores[0];
  const valleyThreshold = sortedScores[Math.floor(sortedScores.length * 0.8)] || sortedScores[sortedScores.length - 1];
  
  const peakChapters = emotionMap.chapters
    .filter(c => c.overallScore >= peakThreshold)
    .map(c => c.chapterId);
    
  const valleyChapters = emotionMap.chapters
    .filter(c => c.overallScore <= valleyThreshold)
    .map(c => c.chapterId);
  
  // リズムの判定（分散に基づく）
  const variance = calculateVariance(scores);
  let rhythm: 'monotone' | 'varied' | 'dynamic' | 'erratic';
  if (variance < 100) {
    rhythm = 'monotone';
  } else if (variance < 500) {
    rhythm = 'varied';
  } else if (variance < 1000) {
    rhythm = 'dynamic';
  } else {
    rhythm = 'erratic';
  }
  
  // 推奨事項の生成
  const recommendations: string[] = [];
  
  if (rhythm === 'monotone') {
    recommendations.push('感情の起伏が少ないです。緊張と緩和のバランスを意識すると良いでしょう。');
  }
  
  if (rhythm === 'erratic') {
    recommendations.push('感情の変化が急激すぎる可能性があります。章間の感情遷移をスムーズにすると良いでしょう。');
  }
  
  if (emotionalRange < 50) {
    recommendations.push('感情の幅が狭いです。より多様な感情を織り交ぜると物語が豊かになります。');
  }
  
  // 没入度が低い章をチェック
  const lowImmersionChapters = emotionMap.chapters.filter(c => c.immersionScore < 40);
  if (lowImmersionChapters.length > 0) {
    recommendations.push(`${lowImmersionChapters.length}つの章で読者の没入度が低い可能性があります。テンポや描写を改善することを検討してください。`);
  }
  
  return {
    averageEmotion,
    emotionalRange,
    peakChapters,
    valleyChapters,
    rhythm,
    recommendations,
  };
};

/**
 * プロジェクト全体の感情マップを生成
 */
export const generateEmotionMap = async (
  projectId: string,
  chapters: Array<{
    id: string;
    title: string;
    summary: string;
    draft?: string;
    mood?: string;
    setting?: string;
    keyEvents?: string[];
  }>,
  projectContext: {
    genre: string;
    theme: string;
    targetReader?: string;
  },
  settings: AISettings
): Promise<EmotionMap> => {
  const chapterEmotions: ChapterEmotion[] = [];
  let previousChapterEmotion: ChapterEmotion | undefined;

  // 各章を順番に分析
  for (const chapter of chapters) {
    try {
      const request: EmotionAnalysisRequest = {
        chapter,
        previousChapterEmotion,
        projectContext,
      };

      const analysisResponse = await analyzeChapterEmotion(request, settings);
      const chapterEmotion = createChapterEmotion(chapter.id, analysisResponse, previousChapterEmotion);
      
      chapterEmotions.push(chapterEmotion);
      previousChapterEmotion = chapterEmotion;
      
      // APIレート制限を考慮して少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`章 ${chapter.title} の感情分析に失敗:`, error);
      // エラーが発生しても続行（デフォルト値を使用）
      const defaultEmotion: ChapterEmotion = {
        id: `emotion-${chapter.id}-${Date.now()}`,
        chapterId: chapter.id,
        emotions: {
          joy: 0, sadness: 0, anger: 0, fear: 0,
          surprise: 0, anticipation: 0, disgust: 0, trust: 0,
          tension: 50, relief: 0, excitement: 0, melancholy: 0,
        },
        overallScore: 0,
        complexity: 0,
        pace: 50,
        immersionScore: 50,
        analyzedAt: new Date(),
        analyzedBy: 'auto',
        confidence: 0,
      };
      chapterEmotions.push(defaultEmotion);
      previousChapterEmotion = defaultEmotion;
    }
  }

  // 感情遷移を分析
  const transitions: EmotionTransition[] = [];
  for (let i = 0; i < chapterEmotions.length - 1; i++) {
    const transition = analyzeEmotionTransition(chapterEmotions[i], chapterEmotions[i + 1]);
    transitions.push(transition);
  }

  // 感情マップを作成
  const now = new Date();
  const emotionMap: EmotionMap = {
    projectId,
    chapters: chapterEmotions,
    transitions,
    createdAt: now,
    updatedAt: now,
  };

  // 全体分析を実行
  emotionMap.overallAnalysis = analyzeOverallEmotionMap(emotionMap);

  return emotionMap;
};

