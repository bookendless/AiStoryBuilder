import { AIModel, AIProvider } from '../../types/ai';
import { isAllowedLocalEndpoint } from '../../utils/securityUtils';

// ローカルLLMモデル定義
//
// maxOutputTokens の 8,192 は、以前 aiService.ts の送信直前に
// Math.min(settings.maxTokens, 8192) として直書きされていた値をここへ移したもの。
// 接続先のモデルは利用者ごとに違い本当の上限は分からないため、保守的な値を据え置く。
// （利用者が調整できるようにするかは別課題）
const LOCAL_MODELS: AIModel[] = [
  {
    id: 'local-model',
    name: 'ローカルモデル',
    description: '接続先ローカルLLMのデフォルト識別子',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: ['テキスト', 'ビジョン'],
    recommendedUse: 'アイデア出しや短い文章生成、画像解析（対応モデルの場合）',
    latencyClass: 'standard',
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






