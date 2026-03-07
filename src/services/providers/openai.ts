import { AIProvider } from '../../types/ai';

// OpenAIモデル定義
const OPENAI_MODELS = [
  // --- GPT-5 Series (Latest Available) ---
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: '最も能力の高いフロンティアモデル。複雑な情報の分析、ソフトウェア開発、自動化ワークフローに最適。',
    maxTokens: 250000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '2026年2月時点の最新安定版。高度なコーディング・エージェント能力と推論機能を持つ。',
    maxTokens: 250000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'バランスの取れた第5世代初期モデル。',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', 'ツール呼び出し'],
    recommendedUse: '一般的な執筆、創作、ツール連携',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: 'GPT-5の高速・低コスト版。明確に定義されたタスクにおいて高いコストパフォーマンスを発揮。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード'],
    recommendedUse: '高速なコード生成、チャットボット、大量データ処理',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    description: '最速かつ最も安価なGPT-5ファミリーのモデル。',
    maxTokens: 128000,
    capabilities: ['テキスト'],
    recommendedUse: '単純なテキスト生成、高速な応答',
    latencyClass: 'fast' as const,
  },

  // --- Previous Models / Other ---
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'GPT-4o。多くのタスクで十分な性能を発揮。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'GPT-4oの軽量・高速版。コスト効率が高く、多くのタスクで十分な性能を発揮。',
    maxTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard' as const,
  },

  // --- Reasoning / Science Models ---
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    description: 'コーディングと論理推論に特化した軽量モデル。',
    maxTokens: 128000,
    capabilities: ['テキスト', '推論', 'コード'],
    recommendedUse: '論理パズルの解決、簡易的なコード検証',
    latencyClass: 'fast' as const,
  },
];

// OpenAIプロバイダー定義
export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  requiresApiKey: true,
  description: 'OpenAI Responses / Chat Completions API。gpt-5.2系やo3系の最新モデルを利用できます。',
  apiDocsUrl: 'https://platform.openai.com/docs/api-reference/responses',
  recommendedUses: [
    '高品質な文章生成と草案執筆',
    '画像を含むキャラクター分析などのマルチモーダル処理',
    '複雑なプロット検証や推論タスク',
  ],
  regions: ['Global', 'US', 'EU'],
  models: OPENAI_MODELS,
};
