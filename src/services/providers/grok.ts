import { AIProvider } from '../../types/ai';

// xAI Grokモデル定義
// 2025年12月21日時点の公式情報（https://docs.x.ai/docs/models および発表）を反映
// 注意: モデルは頻繁に更新されるため、実際の使用前にはxAI Consoleやドキュメントで最新リストを確認してください。
const GROK_MODELS = [
    // Latest Flagship / Fast Models (Grok 4.1シリーズ - 最高性能、高速agentic)
    {
        id: 'grok-4-1-fast-reasoning',
        name: 'Grok 4.1 Fast Reasoning',
        description: 'xAIの最新フロンティアモデル。高度な推論、ツール呼び出し、構造化出力、マルチモーダル対応',
        maxTokens: 2000000,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '複雑なエージェントタスク、長編プロット構築、深い分析、ツール統合、2Mトークンコンテキストで長文処理に強い。',
        latencyClass: 'fast' as const,
    },
    {
        id: 'grok-4-1-fast-non-reasoning',
        name: 'Grok 4.1 Fast Non-Reasoning',
        description: 'Grok 4.1 Fastの高速応答版。推論を抑えて低遅延・低コストを実現。',
        maxTokens: 2000000,
        capabilities: ['テキスト', 'ビジョン', 'ツール使用'],
        recommendedUse: 'リアルタイム応答、シンプルなクエリ、コスト最適化',
        latencyClass: 'fast' as const,
    },

    // Grok 4シリーズ
    {
        id: 'grok-4-0709', // またはエイリアス 'grok-4' が使用可能の場合あり
        name: 'Grok 4',
        description: '強力な推論能力、ネイティブツール使用、リアルタイム検索統合。',
        maxTokens: 262144, // 256k
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用'],
        recommendedUse: '一般的な高度タスク、検索統合、創造的執筆',
        latencyClass: 'standard' as const,
    },
    {
        id: 'grok-4-fast-reasoning',
        name: 'Grok 4 Fast Reasoning',
        description: 'Grok 4の高速版（reasoningモード）。コスト効率が高い。',
        maxTokens: 2000000,
        capabilities: ['テキスト', '推論', 'ツール使用'],
        recommendedUse: 'エージェントアプリケーション、リアルタイム推論',
        latencyClass: 'fast' as const,
    },

    // Specialized Models
    {
        id: 'grok-code-fast-1',
        name: 'Grok Code Fast 1',
        description: 'コーディング・技術タスク特化の高速モデル。エージェントコーディングに最適。',
        maxTokens: 262144, // 公式で256k相当の言及が多い
        capabilities: ['テキスト', 'コーディング', 'ツール使用'],
        recommendedUse: 'コード生成、デバッグ、スクリプト作成、IDE統合',
        latencyClass: 'fast' as const,
    },

    // Previous Generation
    {
        id: 'grok-3',
        name: 'Grok 3',
        description: '安定した推論性能を提供する以前の主力モデル。',
        maxTokens: 131072,
        capabilities: ['テキスト', '推論'],
        recommendedUse: '一般テキスト生成、安定タスク',
        latencyClass: 'standard' as const,
    },
    {
        id: 'grok-3-mini',
        name: 'Grok 3 Mini',
        description: 'Grok 3の軽量・高速版。',
        maxTokens: 131072,
        capabilities: ['テキスト', '推論'],
        recommendedUse: '低遅延が必要なタスク、モバイル/エッジ',
        latencyClass: 'fast' as const,
    },

    // Legacy / Vision Specialized
    {
        id: 'grok-2-vision-1212',
        name: 'Grok 2 Vision',
        description: '画像理解・生成に特化したビジョンモデル（レガシー）。',
        maxTokens: 32768,
        capabilities: ['テキスト', 'ビジョン', '画像生成', '画像認識'],
        recommendedUse: '画像分析、ビジュアルタスク、クリエイティブ生成',
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