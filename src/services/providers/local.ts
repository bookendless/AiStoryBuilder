import { AIProvider } from '../../types/ai';

// ローカルLLMモデル定義
const LOCAL_MODELS = [
  {
    id: 'local-model',
    name: 'ローカルモデル',
    description: '接続先ローカルLLMのデフォルト識別子',
    maxTokens: 32768,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: 'アイデア出しや短い文章生成、画像解析（対応モデルの場合）',
    latencyClass: 'standard' as const,
  },
];

// ローカルLLMプロバイダー定義
export const localProvider: AIProvider = {
  id: 'local',
  name: 'ローカルLLM',
  requiresApiKey: false,
  isLocal: true,
  description: 'LM Studio / Ollama などのOpenAI互換サーバー。完全オフラインで利用できます。画像解析対応モデル（LLaVA、Gemma 3など）も利用可能です。',
  recommendedUses: [
    'ネットワーク制限下での執筆',
    '機密度の高い設定資料の検証',
    'クラウドAIコストを抑えたい場合の下書き生成',
    '画像解析対応モデルでの画像から物語作成',
  ],
  models: LOCAL_MODELS,
};



















