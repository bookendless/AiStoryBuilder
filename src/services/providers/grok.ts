import { AIProvider } from '../../types/ai';

// xAI Grokモデル定義
// 2025年12月21日時点の公式情報（https://docs.x.ai/docs/models および発表）を反映
// 注意: モデルは頻繁に更新されるため、実際の使用前にはxAI Consoleやドキュメントで最新リストを確認してください。
const GROK_MODELS = [
    // Grok 4.1 Series (Stable Flagship)
    {
        id: 'grok-4-1-fast-reasoning',
        name: 'Grok 4.1 Fast Reasoning',
        description: '高度な推論とツール呼び出しに特化したxAIの主力モデル。ハルシネーションを大幅に低減。',
        maxTokens: 2000000,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '複雑なエージェントタスク、長編プロット構築、深い分析、ツール統合',
        latencyClass: 'fast' as const,
    },
    {
        id: 'grok-4-1-fast-non-reasoning',
        name: 'Grok 4.1 Fast Non-Reasoning',
        description: 'Grok 4.1の高速応答版。推論を抑えて低遅延・低コストを実現。',
        maxTokens: 2000000,
        capabilities: ['テキスト', 'ビジョン', 'ツール使用'],
        recommendedUse: 'リアルタイム応答、シンプルなクエリ、コスト最適化',
        latencyClass: 'fast' as const,
    },

    // Specialized Models

    {
        id: 'grok-code-fast-1',
        name: 'Grok Code Fast 1',
        description: 'コーディング・技術タスク特化の高速モデル。エージェントコーディングに最適。',
        maxTokens: 262144,
        capabilities: ['テキスト', 'コーディング', 'ツール使用'],
        recommendedUse: 'コード生成、デバッグ、スクリプト作成',
        latencyClass: 'fast' as const,
    },

    // Previous Generation
    {
        id: 'grok-4',
        name: 'Grok 4',
        description: '強力な推論能力とマルチモーダル処理を持つ安定版モデル。',
        maxTokens: 262144,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用'],
        recommendedUse: '一般的な高度タスク、検索統合',
        latencyClass: 'standard' as const,
    },
    {
        id: 'grok-3',
        name: 'Grok 3',
        description: '安定した推論性能を提供する以前の主力モデル。',
        maxTokens: 131072,
        capabilities: ['テキスト', '推論'],
        recommendedUse: '一般テキスト生成、安定タスク',
        latencyClass: 'standard' as const,
    },
];

// xAI Grokプロバイダー定義（必要に応じて調整）
export const grokProvider: AIProvider = {
    id: 'grok',
    name: 'xAI Grok',
    requiresApiKey: true,
    description: 'xAIのGrokシリーズ。Grok 4.1 Fastを中心とした高速推論、マルチモーダル、ツール使用が特徴。',
    apiDocsUrl: 'https://docs.x.ai/docs/models', // 最新モデルリストはここを確認
    recommendedUses: [
        'Grok 4.1 Fast Reasoningによる高度なエージェント・長文処理',
        'Grok Code Fastによるコーディング支援',
        'Grok 2 Visionによる画像関連タスク',
    ],
    regions: ['Global'],
    models: GROK_MODELS,
};