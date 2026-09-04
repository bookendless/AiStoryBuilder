import { AIModel, AIProvider } from '../../types/ai';

// xAI Grokモデル定義
// 2026年8月17日時点の公式情報（https://docs.x.ai/developers/models）を反映
//
// AIModel[] の注釈は、旧フィールド名 maxTokens の残存をコンパイルエラーにするため。
//
// maxOutputTokens は全モデル未確認。公式ドキュメントはコンテキスト長のみ公開しており、
// 出力上限の記載を確認できなかった。高め（131,072）に倒してある。
// 理由: 低すぎる値は利用者の生成を黙って短くする回帰になるが、高すぎる値は
// 従来どおりAPIエラーになるだけで現状維持。確認が取れ次第この値を下げること。
const GROK_MODELS: AIModel[] = [
    // Grok 4.6 - 最新・最高知能モデル
    {
        id: 'grok-4.6',
        name: 'Grok 4.6',
        description: 'xAI最新・最高知能かつ最速のモデル。コーディング・チャット・汎用タスク向け。500kトークンコンテキスト。',
        contextWindow: 500000,
        maxOutputTokens: 131072,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '最高品質の執筆・分析、複雑なエージェントタスク',
        latencyClass: 'fast',
    },
    // Grok 4.5 - 前世代フラッグシップ
    {
        id: 'grok-4.5',
        name: 'Grok 4.5',
        description: '2026年7月登場。前世代フラッグシップモデル（最新はgrok-4.6）。コーディング・エージェント・知識作業向け。推論努力を設定可能。500kトークンコンテキスト。',
        contextWindow: 500000,
        maxOutputTokens: 131072,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '高品質の執筆・分析、複雑なエージェントタスク',
        latencyClass: 'fast',
    },
    // Grok 4.3 - フラッグシップ（1Mコンテキスト）
    {
        id: 'grok-4.3',
        name: 'Grok 4.3',
        description: '低コストなフラッグシップ。チャット・コーディング向け。1Mトークンコンテキスト。',
        contextWindow: 1048576,
        maxOutputTokens: 131072,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: 'チャット、コーディング、複雑なエージェントタスク、長編プロット構築',
        latencyClass: 'fast',
    },
    // Grok 4.20 Series
    {
        id: 'grok-4.20-0309-reasoning',
        name: 'Grok 4.20 0309 Reasoning',
        description: '高度な推論とツール呼び出しに特化。1Mトークンコンテキスト。',
        contextWindow: 1048576,
        maxOutputTokens: 131072,
        capabilities: ['テキスト', 'ビジョン', '高度推論', 'ツール使用', '構造化出力'],
        recommendedUse: '複雑なエージェントタスク、長編プロット構築、深い分析',
        latencyClass: 'fast',
    },
    {
        id: 'grok-4.20-0309-non-reasoning',
        name: 'Grok 4.20 0309 Non-Reasoning',
        description: '推論を抑えて低遅延・低コストを実現。1Mトークンコンテキスト。',
        contextWindow: 1048576,
        maxOutputTokens: 131072,
        capabilities: ['テキスト', 'ビジョン', 'ツール使用'],
        recommendedUse: 'リアルタイム応答、シンプルなクエリ、コスト最適化',
        latencyClass: 'fast',
    },
];

export const grokProvider: AIProvider = {
    id: 'grok',
    name: 'xAI Grok',
    requiresApiKey: true,
    description: 'xAIのGrokシリーズ。最新のGrok 4.6を筆頭に、テキスト・画像・動画・音声生成を網羅。',
    apiDocsUrl: 'https://docs.x.ai/developers/models',
    recommendedUses: [
        'Grok 4.6による最高知能のチャット・コーディング',
        'Grok 4.3 / 4.20 Reasoningによる長文（1Mトークン）処理',
        'Grok 4.20 Non-Reasoningによる低遅延・低コスト処理',
    ],
    regions: ['Global'],
    models: GROK_MODELS,
};
