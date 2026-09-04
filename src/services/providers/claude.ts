import { AIModel, AIProvider } from '../../types/ai';

// Claudeモデル定義（2026年9月4日時点の公式モデル一覧を反映）
//
// descriptionは利用者に見える文言なので、公式ドキュメントで裏の取れない数値・時期は書かないこと。
//
// AIModel[] の注釈は、旧フィールド名 maxTokens の残存をコンパイルエラーにするため。
// 出力上限を超える max_tokens は Claude API では 400（invalid_request_error）になる。
const CLAUDE_MODELS: AIModel[] = [
  // --- 現行世代（Fable 5.1 / Opus 5 / Sonnet 5 / Haiku 4.5） ---
  {
    id: 'claude-fable-5-1',
    name: 'Claude Fable 5.1',
    description: '2026年9月1日リリースの最上位モデル。難度の高い推論と長時間のエージェント作業向け。思考は常時有効。1Mコンテキスト、最大128k出力（$10/$50）',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最難関の長編構成・整合性検証、品質最優先の推敲',
    latencyClass: 'standard',
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    description: '2026年6月9日GA。複雑なエージェントコーディング・エンタープライズ用途向けの中核モデル。1Mコンテキスト、最大128k出力（$5/$25）',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '複雑な分析、長期エージェントタスク、高度な専門領域',
    latencyClass: 'standard',
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    description: '2026年登場の最新Sonnet。コーディング・エージェント作業でOpus級の品質をSonnet価格で実現。1Mコンテキスト、最大128k出力',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '長文推論', 'エージェント'],
    recommendedUse: '日常的な執筆の主力、計画立案、長文脈での推論',
    latencyClass: 'standard',
  },

  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: '2025年10月登場。驚異的な速度と知能を両立',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '高速チャット、大量のアイデア出し',
    latencyClass: 'fast',
  },

  // --- レガシー（公式ドキュメント上は legacy 扱い。いずれも引き続き利用可能） ---
  {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    description: '2026年6月9日GA。レガシー版の最上位モデル（claude-fable-5-1への移行を推奨）。思考は常時有効。1Mコンテキスト、最大128k出力（$10/$50）',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最難関の長編構成・整合性検証、品質最優先の推敲',
    latencyClass: 'standard',
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8',
    description: 'レガシー版Opus（claude-opus-5への移行を推奨）。複雑な推論・長期エージェントコーディング向け。1Mコンテキスト、最大128k出力',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の分析、長期エージェントタスク、高度な専門領域',
    latencyClass: 'standard',
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: '2026年登場。レガシー版フラッグシップ（claude-opus-5への移行を推奨）。1Mコンテキスト、最大128k出力',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '高難易度の分析、長期エージェントタスク、高度な専門領域',
    latencyClass: 'standard',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: '2026年2月登場。レガシー版Sonnet（claude-sonnet-5への移行を推奨）。1Mコンテキスト',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '長文推論', 'エージェント'],
    recommendedUse: '計画立案、知識作業、デザイン、長文脈での推論',
    latencyClass: 'standard',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: '2026年2月登場。レガシー版フラッグシップ（claude-opus-5への移行を推奨）',
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '複雑な分析、長期的なエージェントタスク、高度な専門領域',
    latencyClass: 'standard',
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: '2025年11月登場。プロフェッショナルなソフトウェアエンジニアリングも可能なモデル',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の執筆、複雑な構成の完全な制御',
    latencyClass: 'standard',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: '2025年9月登場。日常的なタスクに最適な速度と知能',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    capabilities: ['テキスト', 'ビジョン', '長文推論'],
    recommendedUse: '日常的な執筆の主力モデル',
    latencyClass: 'standard',
  },
];

// Claudeプロバイダー定義
export const claudeProvider: AIProvider = {
  id: 'claude',
  name: 'Anthropic Claude',
  requiresApiKey: true,
  description: 'Claude 5系（Fable 5.1 / Opus 5 / Sonnet 5）と Haiku 4.5、および 4.8 / 4.7 / 4.6 / 4.5 のレガシー各種。長文要約や整合性チェックに強みがあります。',
  apiDocsUrl: 'https://platform.claude.com/docs/en/api/messages',
  recommendedUses: [
    '長文の推敲や構造化された要約',
    '厳密なトーンコントロールが必要なキャラクター表現',
    '設定資料の整合性チェック',
  ],
  regions: ['US', 'EU', 'JP (Preview)'],
  models: CLAUDE_MODELS,
};
