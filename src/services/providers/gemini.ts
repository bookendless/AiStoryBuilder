import { AIProvider } from '../../types/ai';

// Geminiモデル定義（2026年7月22日時点の公式情報を反映）
const GEMINI_MODELS = [
  // --- Gemini 3.6 Series (Latest, GA) ---
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: '2026年7月GA。フロンティア級性能を高速・低コストで持続するエージェント向け最新Flash。コード生成・空間推論に強み。1Mトークン入力/最大65k出力。',
    maxTokens: 1048576,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: '複雑なコーディングサイクルを伴う高速エージェントループ、エージェント実行タスク',
    latencyClass: 'fast' as const,
  },

  // --- Gemini 3.5 Series (GA) ---
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: '2026年5月登場、現在GA。エージェント・コーディングでフロンティア級性能を持続する最上位Flash。1Mトークンコンテキスト、最大65k出力。',
    maxTokens: 1048576,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: '高速マルチモーダル処理、エージェントワークフロー、コスト効率の高いタスク',
    latencyClass: 'fast' as const,
  },

  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    description: '2026年7月GA。3.5世代最速・最安価な高スループット向けモデル。サブエージェントタスクやドキュメント解析に最適。1Mトークン入力/最大65k出力。',
    maxTokens: 1048576,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: '大量エージェントワークフロー、単純なデータ抽出、レイテンシ・コスト最優先タスク',
    latencyClass: 'fast' as const,
  },

  // --- Gemini 3.1 Series (Latest Preview) ---
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    description: '2026年2月登場のプレビュー版Pro。高度な推論・コーディング・長大マルチモーダル処理に対応（3.5 Proは未提供）',
    maxTokens: 1048576,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: 'エージェントワークフロー、複雑なプログラミングタスク、高度なデータ分析',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: '2026年2月登場。フロンティアクラスの性能を低コストで提供するプレビュー版',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', 'コード実行'],
    recommendedUse: '高速なマルチモーダル処理、リアルタイム応答、大量のデータ分析',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: '2026年2月登場。最も費用対効果の高いマルチモーダルモデル。最低レイテンシ。',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', 'コード実行'],
    recommendedUse: '大量処理、リアルタイム応答、コスト最優先タスク',
    latencyClass: 'fast' as const,
  },

  // --- Gemini 2.5 Series (Stable GA) ---
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: '2025年6月GA。複雑なタスク向け最先端モデル。安定した2Mトークンコンテキスト。',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', 'オーディオ', '思考モード', 'コード実行'],
    recommendedUse: '長期プロジェクトの統合管理や分析、複雑なエージェントタスク',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: '推論を必要とする低レイテンシで大容量のタスクに最適な価格とパフォーマンスのモデル。',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン', '思考モード'],
    recommendedUse: '画像分析付きキャラクター補完や大量生成',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: '2.5世代の最速・最安価モデル。API料金を抑えたい場合に最適',
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



















