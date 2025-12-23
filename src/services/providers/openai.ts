import { AIProvider } from '../../types/ai';

// OpenAIモデル定義
const OPENAI_MODELS = [
  // --- 追加: GPT-5.1 系（フル版・Mini版）
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2 Thinking',
    description: '最新世代の高度な推論と複雑なタスク処理に特化したモデル（最高品質・高度推論対応）。2025年12月リリース。',
    maxTokens: 250000,
    capabilities: ['テキスト', 'ビジョン', '音声入力', 'ツール呼び出し', '高度推論'],
    recommendedUse: '長編創作、深い論理検証、外部ツール（プラグイン）との連携が必要なケース。',
    latencyClass: 'reasoning' as const,
  },
  {
    id: 'gpt-5.2-chat-latest',
    name: 'GPT-5.2 Instant',
    description: '日常会話や一般的なタスク処理に特化したモデル（最高品質・高度推論対応）。ファストモデル',
    maxTokens: 250000,
    capabilities: ['テキスト', 'ビジョン', '音声入力', 'ツール呼び出し', '高度推論'],
    recommendedUse: '長編創作、深い論理検証、外部ツール（プラグイン）との連携が必要なケース。',
    latencyClass: 'reasoning' as const,
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: '最新世代の汎用マルチモーダルモデル（最高品質・高度推論対応）。創作・分析・ツール連携に最適。',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '音声入力', 'ツール呼び出し', '高度推論'],
    recommendedUse: '長編創作、深い論理検証、外部ツール（プラグイン）との連携が必要なケース。',
    latencyClass: 'reasoning' as const,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5.1 Mini',
    description: 'GPT-5.1 の高速・コスト効率版。多くの生成タスクで高品質を維持しつつ低レイテンシを実現。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '音声入力'],
    recommendedUse: 'プロトタイピング、大量生成、対話型の高速応答が必要な場面。',
    latencyClass: 'fast' as const,
  },

  // --- 既存モデル群（順序は維持） ---

  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: '最新世代の高速マルチモーダルモデル（推奨）',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '音声入力'],
    recommendedUse: 'コストと品質のバランスを取りたい日常的な生成',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'プレミアム品質のマルチモーダルモデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '長編の草案執筆や複雑な指示への対応',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'リアルタイム用途にも対応する万能モデル',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'リアルタイム'],
    recommendedUse: 'キャラクター補完や会話型アシスタント',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: '軽量でコスト効率に優れたモデル',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '大量トライアルや高速応答が必要な操作',
    latencyClass: 'fast' as const,
  },
  {
    id: 'o4-mini',
    name: 'OpenAI o4-mini',
    description: '2025年6月リリースの最新コスト効率Reasoningモデル',
    maxTokens: 128000,
    capabilities: ['テキスト', '推論', 'reasoning'],
    recommendedUse: '日常的な推論タスク、軽量な論理検証',
    latencyClass: 'fast' as const,
  },
  {
    id: 'o3-pro',
    name: 'OpenAI o3-pro',
    description: '2025年6月リリース。プロユーザー向けの高度推論モデル',
    maxTokens: 200000,
    capabilities: ['テキスト', '高度推論', '分析'],
    recommendedUse: '複雑なプロット構築、深い洞察が必要な分析',
    latencyClass: 'reasoning' as const,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    description: '2025年1月リリース。コーディング・数学・科学に特化した軽量モデル',
    maxTokens: 128000,
    capabilities: ['テキスト', '推論', 'コード'],
    recommendedUse: 'ロジックチェック、整合性検証',
    latencyClass: 'reasoning' as const,
  },
];

// OpenAIプロバイダー定義
export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  requiresApiKey: true,
  description: 'OpenAI Responses / Chat Completions API。gpt-5.1系やo系の最新モデルを利用できます。',
  apiDocsUrl: 'https://platform.openai.com/docs/api-reference/responses',
  recommendedUses: [
    '高品質な文章生成と草案執筆',
    '画像を含むキャラクター分析などのマルチモーダル処理',
    '複雑なプロット検証や推論タスク',
  ],
  regions: ['Global', 'US', 'EU'],
  models: OPENAI_MODELS,
};



















