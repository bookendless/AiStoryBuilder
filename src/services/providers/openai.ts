import { AIProvider } from '../../types/ai';

// OpenAIモデル定義
const OPENAI_MODELS = [
  // --- GPT-5.4 Series (Current Generation) ---
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: '2026年3月登場の最新フラッグシップ。1.05Mトークンコンテキスト。複雑な分析・エージェントに最適。',
    maxTokens: 1050000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-5.4-pro',
    name: 'GPT-5.4 Pro',
    description: 'GPT-5.4の追加計算リソース版。最難関タスク向け。1.05Mトークンコンテキスト。',
    maxTokens: 1050000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '最高難易度の問題解決、複雑な推論チェーン',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: '2026年3月登場。GPT-5.4の高速・低コスト版。400kトークンコンテキスト。',
    maxTokens: 400000,
    capabilities: ['テキスト', 'ビジョン', 'コード'],
    recommendedUse: '高速なコード生成、チャットボット、大量データ処理',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 nano',
    description: '2026年3月登場。最速・最安価なGPT-5.4ファミリー。400kトークンコンテキスト。',
    maxTokens: 400000,
    capabilities: ['テキスト'],
    recommendedUse: '単純なテキスト生成、高速な応答',
    latencyClass: 'fast' as const,
  },

  // --- Reasoning Models ---
  {
    id: 'o4-mini',
    name: 'OpenAI o4-mini',
    description: '高スループット向け推論特化モデル。o3より高い使用量制限。200kトークンコンテキスト。',
    maxTokens: 200000,
    capabilities: ['テキスト', '高度推論', 'コード'],
    recommendedUse: '科学・数学・コーディングの高速推論、大量処理',
    latencyClass: 'fast' as const,
  },
  {
    id: 'o3',
    name: 'OpenAI o3',
    description: '推論特化フラッグシップモデル。200kトークンコンテキスト。最大100k出力。',
    maxTokens: 200000,
    capabilities: ['テキスト', '高度推論', 'コード'],
    recommendedUse: '最高難易度の論理・数学・科学タスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    description: 'コーディングと論理推論に特化した軽量推論モデル。200kトークンコンテキスト。',
    maxTokens: 200000,
    capabilities: ['テキスト', '推論', 'コード'],
    recommendedUse: '論理パズルの解決、コード検証',
    latencyClass: 'fast' as const,
  },

  // --- Legacy Models ---
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '【レガシー・期限付きサポート】90日間のサポート期限あり。gpt-5.4への移行を推奨。',
    maxTokens: 250000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: '【非推奨】2026年2月以降代替推奨。gpt-5.4-miniへの移行を推奨。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: '【非推奨】2026年2月以降代替推奨。gpt-5.4-nanoへの移行を推奨。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard' as const,
  },
];

// OpenAIプロバイダー定義
export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  requiresApiKey: true,
  description: 'OpenAI Responses / Chat Completions API。gpt-5.4系・o3系・o4-miniの最新モデルを利用できます。',
  apiDocsUrl: 'https://platform.openai.com/docs/api-reference/responses',
  recommendedUses: [
    '高品質な文章生成と草案執筆',
    '画像を含むキャラクター分析などのマルチモーダル処理',
    '複雑なプロット検証や推論タスク',
  ],
  regions: ['Global', 'US', 'EU'],
  models: OPENAI_MODELS,
};
