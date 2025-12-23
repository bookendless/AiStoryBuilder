import { AIProvider } from '../../types/ai';

// Geminiモデル定義
const GEMINI_MODELS = [
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3.0 Pro (Preview)',
    description: '2025年11月リリース。最高性能のマルチモーダルモデル',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: 'あらゆる高度なタスク、長大なコンテキスト処理',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash (Preview)',
    description: '2025年12月リリース。高速でコスト効率に優れたマルチモーダルモデル',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', '動画', '音声', 'PDF', '思考モード', 'コード実行'],
    recommendedUse: 'あらゆる高度なタスク、長大なコンテキスト処理',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: '最新フラッグシップ。最大200万トークン対応',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン', 'オーディオ'],
    recommendedUse: '長期プロジェクトの統合管理や分析',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: '高速でコスト効率に優れた2.5世代',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '画像分析付きキャラクター補完や大量生成',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: '軽量Flash派生。API料金を抑えたい場合に最適',
    maxTokens: 1000000,
    capabilities: ['テキスト'],
    recommendedUse: '反復的な短文生成・要約',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: '2.0世代の高速モデル',
    maxTokens: 1000000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: 'ミドルレンジの物語生成',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-2.0-flash-lite-001',
    name: 'Gemini 2.0 Flash Lite',
    description: '2.0世代の軽量モデル',
    maxTokens: 1000000,
    capabilities: ['テキスト'],
    recommendedUse: 'テンプレート出力やユーティリティ的な用途',
    latencyClass: 'fast' as const,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: '従来の高性能モデル',
    maxTokens: 2000000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '既存プロンプト資産の継続利用',
    latencyClass: 'standard' as const,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: '従来の高速モデル',
    maxTokens: 1000000,
    capabilities: ['テキスト'],
    recommendedUse: 'シンプルな要約やメモの自動化',
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



















