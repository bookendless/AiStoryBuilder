import type { Foreshadowing } from '../../../contexts/ProjectContext';

// AI伏線提案の型
export interface AISuggestion {
  title: string;
  description: string;
  category: Foreshadowing['category'];
  importance: Foreshadowing['importance'];
  plantChapter: string;
  plantDescription: string;
  payoffChapter: string;
  payoffDescription: string;
  relatedCharacters: string[];
  effect: string;
}

// 整合性チェック結果の型
export interface ConsistencyResult {
  overallScore: number;
  summary: string;
  unresolvedIssues: Array<{
    foreshadowingTitle: string;
    issue: string;
    severity: string;
    suggestion: string;
  }>;
  contradictions: Array<{
    items: string[];
    description: string;
    resolution: string;
  }>;
  balanceIssues: Array<{
    issue: string;
    suggestion: string;
  }>;
  strengths: string[];
}

// 伏線強化提案結果の型
export interface EnhanceResult {
  enhancedDescription: string;
  additionalLayers: Array<{
    layer: string;
    description: string;
    effect: string;
  }>;
  connectionOpportunities: Array<{
    target: string;
    connection: string;
    benefit: string;
  }>;
  strengthenMethods: Array<{
    current: string;
    improved: string;
    reason: string;
  }>;
  warnings: string[];
}

// 回収タイミング提案結果の型
export interface PayoffResult {
  recommendedChapter: string;
  timing: string;
  payoffMethods: Array<{
    method: string;
    description: string;
    impact: string;
    prerequisites: string[];
  }>;
  hintsBeforePayoff: Array<{
    chapter: string;
    hint: string;
  }>;
  avoidTiming: string[];
}

// ポイント削除確認情報の型
export interface DeletingPointInfo {
  foreshadowingId: string;
  pointId: string;
}
