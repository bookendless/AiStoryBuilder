import { AIProvider } from '../../types/ai';

// Claudeモデル定義
const CLAUDE_MODELS = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: '2025年11月登場。Anthropic史上最も賢いモデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の執筆、複雑な構成の完全な制御',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    description: '2025年5月登場。Claude Opus 4.5の前身',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論', 'エージェント'],
    recommendedUse: '最高難易度の執筆、複雑な構成の完全な制御',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: '2025年9月登場。Sonnetの最新世代',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '長文推論'],
    recommendedUse: '日常的な執筆の主力モデル',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: '2025年10月登場。驚異的な速度と知能を両立',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '高速チャット、大量のアイデア出し',
    latencyClass: 'fast' as const,
  },

  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: '高速でコスト効率に優れた最新軽量モデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: 'キャラクター補完や要約の大量実行',
    latencyClass: 'fast' as const,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: '最高性能の長文・推論モデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン', '高度推論'],
    recommendedUse: '設定資料の精密検証や難易度の高い生成',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    description: 'コストと品質のバランスが取れた従来モデル',
    maxTokens: 200000,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: '既存Claude 3系からの移行用途',
    latencyClass: 'standard' as const,
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: '軽量で高速な従来モデル',
    maxTokens: 200000,
    capabilities: ['テキスト'],
    recommendedUse: '要約やブレインストーミングの素早い反復',
    latencyClass: 'fast' as const,
  },
];

// Claudeプロバイダー定義
export const claudeProvider: AIProvider = {
  id: 'claude',
  name: 'Anthropic Claude',
  requiresApiKey: true,
  description: 'Claude 4 / 4.5 ファミリー。長文要約や整合性チェックに強みがあります。',
  apiDocsUrl: 'https://docs.anthropic.com/en/api/messages',
  recommendedUses: [
    '長文の推敲や構造化された要約',
    '厳密なトーンコントロールが必要なキャラクター表現',
    '設定資料の整合性チェック',
  ],
  regions: ['US', 'EU', 'JP (Preview)'],
  models: CLAUDE_MODELS,
};



















