/**
 * AI利用コスト概算ユーティリティ（純粋関数）
 *
 * 各モデルの概算単価（USD / 100万トークン）をもとに、トークン使用量から
 * おおよその料金を推定する。単価はあくまで目安であり、実際の請求額は
 * 各プロバイダーの料金体系・為替・キャンペーン等により変動する。
 */

export interface ModelPrice {
  /** 入力（プロンプト）100万トークンあたりのUSD */
  input: number;
  /** 出力（生成）100万トークンあたりのUSD */
  output: number;
}

export type AIProvider = 'openai' | 'claude' | 'gemini' | 'grok' | 'local';

/**
 * モデルIDのパターン（前方一致・部分一致）と概算単価の対応。
 * 上から順に最初にマッチしたものを採用するため、より限定的なパターンを先に置く。
 * 単価は目安（2026年時点の想定値）。
 */
const PRICE_TABLE: Record<AIProvider, Array<{ match: (model: string) => boolean; price: ModelPrice }>> = {
  openai: [
    { match: m => m.includes('nano'), price: { input: 0.05, output: 0.4 } },
    { match: m => m.includes('mini'), price: { input: 0.25, output: 2 } },
    { match: m => m.startsWith('gpt-5'), price: { input: 1.25, output: 10 } },
    { match: m => m.startsWith('o3') || m.startsWith('o4'), price: { input: 2, output: 8 } },
    { match: m => m.includes('gpt-4o'), price: { input: 2.5, output: 10 } },
  ],
  claude: [
    { match: m => m.includes('haiku'), price: { input: 0.8, output: 4 } },
    { match: m => m.includes('sonnet'), price: { input: 3, output: 15 } },
    { match: m => m.includes('opus'), price: { input: 15, output: 75 } },
  ],
  gemini: [
    { match: m => m.includes('flash-lite'), price: { input: 0.1, output: 0.4 } },
    { match: m => m.includes('flash'), price: { input: 0.3, output: 2.5 } },
    { match: m => m.includes('pro'), price: { input: 1.25, output: 10 } },
  ],
  grok: [
    { match: () => true, price: { input: 3, output: 15 } },
  ],
  local: [
    { match: () => true, price: { input: 0, output: 0 } },
  ],
};

/** プロバイダー別のデフォルト単価（テーブルにマッチしない場合のフォールバック） */
const DEFAULT_PRICE: Record<AIProvider, ModelPrice> = {
  openai: { input: 1, output: 8 },
  claude: { input: 3, output: 15 },
  gemini: { input: 0.3, output: 2.5 },
  grok: { input: 3, output: 15 },
  local: { input: 0, output: 0 },
};

/** 指定プロバイダー・モデルの概算単価を返す */
export function getModelPrice(provider: string, model: string): ModelPrice {
  const key = (provider as AIProvider) in PRICE_TABLE ? (provider as AIProvider) : null;
  if (!key) return DEFAULT_PRICE.openai;
  // モデルIDの表記ゆれ（大文字混じり等）を吸収するため小文字化して照合
  const normalized = model.toLowerCase();
  const entry = PRICE_TABLE[key].find(e => e.match(normalized));
  return entry ? entry.price : DEFAULT_PRICE[key];
}

/**
 * トークン使用量から概算コスト（USD）を計算する
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = getModelPrice(provider, model);
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
}

/** USDを表示用文字列に整形（極小額は $0.001 未満をまとめる） */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.001) return '< $0.001';
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}
