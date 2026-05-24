import { AIProvider } from '../../types/ai';

// xAI Grokモデル定義
// 2026年5月22日時点の公式情報（https://docs.x.ai/developers/models）を反映
const GROK_MODELS = [
    // Grok 4.3 - 最新フラッグシップ
    {
        id: 'grok-4.3',
        name: 'Grok 4.3',
        description: 'xAI最新・最高性能モデル。チャット・コーディング向け推奨。1Mトークンコンテキスト。',
        maxTokens: 1048576,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: 'チャット、コーディング、複雑なエージェントタスク、長編プロット構築',
        latencyClass: 'fast' as const,
    },
    // Grok 4.20 Series
    {
        id: 'grok-4.20-0309-reasoning',
        name: 'Grok 4.20 0309 Reasoning',
        description: '高度な推論とツール呼び出しに特化。1Mトークンコンテキスト。',
        maxTokens: 1048576,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '複雑なエージェントタスク、長編プロット構築、深い分析',
        latencyClass: 'fast' as const,
    },
    {
        id: 'grok-4.20-0309-non-reasoning',
        name: 'Grok 4.20 0309 Non-Reasoning',
        description: '推論を抑えて低遅延・低コストを実現。1Mトークンコンテキスト。',
        maxTokens: 1048576,
        capabilities: ['テキスト', 'ビジョン', 'ツール使用'],
        recommendedUse: 'リアルタイム応答、シンプルなクエリ、コスト最適化',
        latencyClass: 'fast' as const,
    },
];

export const grokProvider: AIProvider = {
    id: 'grok',
    name: 'xAI Grok',
    requiresApiKey: true,
    description: 'xAIのGrokシリーズ。Grok 4.3を旗艦に、テキスト・画像・動画・音声生成を網羅。',
    apiDocsUrl: 'https://docs.x.ai/developers/models',
    recommendedUses: [
        'Grok 4.3による最高性能チャット・コーディング',
        'Grok 4.20 Reasoningによる高度なエージェント・長文処理',
        'Grok 4.20 Non-Reasoningによる低遅延・低コスト処理',
    ],
    regions: ['Global'],
    models: GROK_MODELS,
};
