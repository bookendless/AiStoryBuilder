import { AIModel, AIProvider } from '../../types/ai';

// OpenAIモデル定義（2026年9月4日時点の公式モデル一覧を反映）
//
// descriptionは利用者に見える文言なので、公式ドキュメントで裏の取れない数値・時期は書かないこと。
// GPT-6 Astra は Trusted Access Program 経由の限定提供で、通常のAPIキーでは利用できないため未収録。
//
// AIModel[] の注釈は、旧フィールド名 maxTokens の残存をコンパイルエラーにするため。
// 出力上限を超える max_tokens / max_completion_tokens は OpenAI API では 400 になる。
const OPENAI_MODELS: AIModel[] = [
  // --- GPT-5.6 Series (Current Generation, 2026-07-09 GA) ---
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    description: '2026年7月9日GAの最新フラッグシップ。GPT-5.6ファミリー最上位。1.05Mトークンコンテキスト、最大128k出力。',
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '最も複雑な実装・分析・エージェントタスク',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    description: '2026年7月9日GA。性能とコストのバランスに優れた中位モデル。1.05Mトークンコンテキスト、最大128k出力。',
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '日常的な執筆・分析の主力、エージェントタスク',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    description: '2026年7月9日GA。GPT-5.6ファミリーの低コスト版。1.05Mトークンコンテキスト、最大128k出力。',
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', '高度推論'],
    recommendedUse: '高速な文章生成、コスト効率重視のタスク',
    latencyClass: 'fast',
  },

  // --- GPT-5.5 / 5.4 Series (Previous Generation) ---
  {
    id: 'gpt-5.5',
    name: 'GPT-5.5',
    description: '2026年4月下旬登場の旧フラッグシップ（gpt-5.6-solへの移行を推奨）。1.05Mトークンコンテキスト。',
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    description: '2026年3月登場。1.05Mトークンコンテキスト。複雑な分析・エージェントに最適（最新はgpt-5.6系）。',
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: '2026年3月登場。GPT-5.4の高速・低コスト版。400kトークンコンテキスト。',
    contextWindow: 400000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード'],
    recommendedUse: '高速なコード生成、チャットボット、大量データ処理',
    latencyClass: 'fast',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 nano',
    description: '2026年3月登場。最速・最安価なGPT-5.4ファミリー。400kトークンコンテキスト。',
    contextWindow: 400000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト'],
    recommendedUse: '単純なテキスト生成、高速な応答',
    latencyClass: 'fast',
  },

  // --- Reasoning Models ---
  {
    id: 'o4-mini',
    name: 'OpenAI o4-mini',
    description: '【移行推奨】2026年10月23日にスナップショット提供終了予定。gpt-5.6-terraへの移行を推奨。高スループット向け推論特化モデル。200kトークンコンテキスト。',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: ['テキスト', '高度推論', 'コード'],
    recommendedUse: '科学・数学・コーディングの高速推論、大量処理',
    latencyClass: 'fast',
  },
  {
    id: 'o3',
    name: 'OpenAI o3',
    description: '【移行推奨】2026年12月11日にスナップショット提供終了予定。gpt-5.6-solへの移行を推奨。推論特化フラッグシップモデル。200kトークンコンテキスト。最大100k出力。',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: ['テキスト', '高度推論', 'コード'],
    recommendedUse: '最高難易度の論理・数学・科学タスク',
    latencyClass: 'standard',
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    description: 'コーディングと論理推論に特化した軽量推論モデル。200kトークンコンテキスト。',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    capabilities: ['テキスト', '推論', 'コード'],
    recommendedUse: '論理パズルの解決、コード検証',
    latencyClass: 'fast',
  },

  // --- Legacy Models ---
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '【移行推奨】旧世代のフラッグシップ。gpt-5.6-solへの移行を推奨。400kトークンコンテキスト、最大128k出力。',
    contextWindow: 400000,
    maxOutputTokens: 128000,
    capabilities: ['テキスト', 'ビジョン', 'コード', 'エージェント', '高度推論'],
    recommendedUse: '複雑な実装、リファクタリング、分析、エージェントタスク',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: '【移行推奨】旧世代モデル。gpt-5.4-miniへの移行を推奨。',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: '【移行推奨】旧世代モデル。gpt-5.4-nanoへの移行を推奨。',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '重要なドキュメント作成、精密な指示の実行',
    latencyClass: 'standard',
  },
];

// OpenAIプロバイダー定義
export const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI GPT',
  requiresApiKey: true,
  description: 'OpenAI Responses / Chat Completions API。gpt-5.6系（Sol/Terra/Luna）・gpt-5.4系・o3系・o4-miniを利用できます。',
  apiDocsUrl: 'https://platform.openai.com/docs/api-reference/responses',
  recommendedUses: [
    '高品質な文章生成と草案執筆',
    '画像を含むキャラクター分析などのマルチモーダル処理',
    '複雑なプロット検証や推論タスク',
  ],
  regions: ['Global', 'US', 'EU'],
  models: OPENAI_MODELS,
};
