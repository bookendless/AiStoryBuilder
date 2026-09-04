import { openaiProvider } from './openai';
import { claudeProvider } from './claude';
import { geminiProvider } from './gemini';
import { grokProvider } from './grok';
import { localProvider } from './local';
import { AIModel, AIProvider, AISettings } from '../../types/ai';

// AIプロバイダーの定義
export const AI_PROVIDERS: AIProvider[] = [
  openaiProvider,
  claudeProvider,
  geminiProvider,
  grokProvider,
  localProvider,
];

/**
 * モデル定義が見つからないときの保守的な出力上限。
 *
 * 保存済み設定のモデルIDが更新でリストから消えた場合などに使う。
 * 8,192 は従来 AIContext のフォールバックと Local LLM の送信時クランプに
 * 使われていた値で、既存の挙動を変えないためにそのまま踏襲している。
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/** プロバイダーIDとモデルIDからモデル定義を引く。未登録なら undefined。 */
export const findModel = (providerId?: string, modelId?: string): AIModel | undefined =>
  AI_PROVIDERS.find((p) => p.id === providerId)?.models.find((m) => m.id === modelId);

/**
 * そのモデルが1リクエストで生成できる出力トークンの上限。
 *
 * 設定画面の入力上限・保存値のクランプ・API送信の3か所すべてがこの関数を通ることで、
 * 「画面は通すのにAPIが400を返す」ずれが起きないようにする。
 */
export const getMaxOutputTokens = (providerId?: string, modelId?: string): number =>
  findModel(providerId, modelId)?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

/**
 * API に送る出力上限を決める。設定値をモデルの上限で頭打ちにする。
 *
 * 上限へのクランプは実際の出力量を減らさない（超過分は元々APIエラーか上限止まり）。
 * 入力欄の max 属性は手入力を止めないので、API境界のここで必ず1回通す。
 */
export const resolveMaxOutputTokens = (
  settings: Pick<AISettings, 'provider' | 'model' | 'maxTokens'>
): number => {
  const cap = getMaxOutputTokens(settings.provider, settings.model);
  const requested = settings.maxTokens;
  // 数値入力が空のとき parseInt は NaN を返す。NaN をそのまま送ると原因の分かりにくい400になる
  if (!Number.isFinite(requested) || requested <= 0) {
    return Math.min(DEFAULT_MAX_OUTPUT_TOKENS, cap);
  }
  return Math.min(requested, cap);
};

// Android環境チェック: ローカルLLMはAndroidでは使用不可
const isAndroidPlatform = typeof window !== 'undefined' &&
  (window as Window & { __TAURI_PLATFORM__?: string }).__TAURI_PLATFORM__ === 'android';

// Android環境ではローカルLLMプロバイダーを除外したリスト
export const AVAILABLE_PROVIDERS: AIProvider[] = isAndroidPlatform
  ? AI_PROVIDERS.filter(p => !p.isLocal)
  : AI_PROVIDERS;



















