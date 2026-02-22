import { AIProvider } from '../../types/ai';

// Geminiモデル定義
const GEMINI_MODELS = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    description: '最新のプレビュー版モデル。高度な推論、コーディング、および長大なマルチモーダルコンテキストの処理に対応',
    maxTokens: 1048576,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: 'エージェントワークフロー、複雑なプログラミングタスク、高度なデータ分析',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3.0 Pro (Preview)',
    description: '2025年11月登場。推論・コーディング・マルチモーダル理解において最高性能を誇るフラグシップモデル',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: '複雑なエージェントタスク、高度な問題解決、長大なコンテキスト処理',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash (Preview)',
    description: '2025年12月登場。日常使いに最適な高速・高知能モデル。PhDレベルの推論能力を持つ',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', 'コード実行'],
    recommendedUse: '高速なマルチモーダル処理、リアルタイム応答、大量のデータ分析',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: '2025年中盤のフラッグシップ。安定した性能と長いコンテキストウィンドウ',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', 'オーディオ'],
    recommendedUse: '長期プロジェクトの統合管理や分析',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: '2.5世代の高速モデル。コストパフォーマンスに優れる',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '画像分析付きキャラクター補完や大量生成',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: '2.5世代の軽量モデル。API料金を抑えたい場合に最適',
    maxTokens: 1000000,
    capabilities: ['テキスト'],
    recommendedUse: '反復的な短文生成・要約',
    latencyClass: 'fast' as const,
  },
];

// Geminiプロバイダー定義
export const geminiProvider: AIProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  requiresApiKey: true,
  description: 'Google AI Studio / Generative Language API。長大なコンテキストとマルチモーダルに対応。',
  apiDocsUrl: 'https://ai.google.dev/api',
  recommendedUses: [
    '大規模な設定資料や資料集の処理',
    '画像・音声を併用したリサーチ',
    '長大な草案や要約の一括生成',
  ],
  regions: ['Global', 'Japan'],
  models: GEMINI_MODELS,
};



















