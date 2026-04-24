import { AIProvider } from '../../types/ai';

// Claudeモデル定義
const CLAUDE_MODELS = [
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: '2026年最新フラッグシップ。推論・エージェント機能が最高水準。1Mコンテキスト、最大128k出力',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の分析、長期エージェントタスク、高度な専門領域',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: '2026年2月登場。全方位に強化された推奨Sonnet。1Mコンテキスト',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン', '長文推論', 'エージェント'],
    recommendedUse: '計画立案、知識作業、デザイン、長文脈での推論',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: '2025年10月登場。驚異的な速度と知能を両立',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '高速チャット、大量のアイデア出し',
    latencyClass: 'fast' as const,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: '2026年2月登場。レガシー版フラッグシップ（4.7への移行を推奨）',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '複雑な分析、長期的なエージェントタスク、高度な専門領域',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: '2025年11月登場。プロフェッショナルなソフトウェアエンジニアリングも可能なモデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の執筆、複雑な構成の完全な制御',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: '2025年9月登場。日常的なタスクに最適な速度と知能',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '長文推論'],
    recommendedUse: '日常的な執筆の主力モデル',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: '2025年5月登場。【2026年6月15日廃止予定】claude-opus-4-5以降への移行を推奨',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '高度な執筆、複雑な構成の制御',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    description: '2025年5月登場。【2026年6月15日廃止予定】claude-sonnet-4-5以降への移行を推奨',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '高速な執筆、日常的な構造モデル',
    latencyClass: 'standard' as const,
  },
];

// Claudeプロバイダー定義
export const claudeProvider: AIProvider = {
  id: 'claude',
  name: 'Anthropic Claude',
  requiresApiKey: true,
  description: 'Claude 4.7 / 4.6 / 4.5 ファミリー。長文要約や整合性チェックに強みがあります。',
  apiDocsUrl: 'https://docs.anthropic.com/en/api/messages',
  recommendedUses: [
    '長文の推敲や構造化された要約',
    '厳密なトーンコントロールが必要なキャラクター表現',
    '設定資料の整合性チェック',
  ],
  regions: ['US', 'EU', 'JP (Preview)'],
  models: CLAUDE_MODELS,
};



















