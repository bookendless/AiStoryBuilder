import { AIProvider } from '../../types/ai';
import { isAllowedLocalEndpoint } from '../../utils/securityUtils';

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

export async function checkLocalLLMConnectivity(endpoint: string): Promise<boolean> {
  // 接続先はユーザーが自由入力できるため、送信前に必ずローカル/私的アドレスか検証する。
  // 検証を省くと、エラー時のフォールバック判定が任意の外部ホストへの通信になりうる。
  if (!isAllowedLocalEndpoint(endpoint)) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${endpoint}/v1/models`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}






