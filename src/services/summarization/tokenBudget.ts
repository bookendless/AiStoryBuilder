/**
 * コンテキスト長の予算計算ユーティリティ
 *
 * 続編構成のmap-reduce要約では、プロバイダー（特にローカルLLM）の
 * コンテキスト長を超えないように入力サイズを管理する必要がある。
 * aiService の callLocalLLM は localContextLength（既定 12000 文字）で
 * プロンプト全体を単純切り詰めするため、ここではそれと整合する形で
 * 「入力として安全に渡せる文字数」を算出する。
 */

import { AISettings } from '../../types/ai';

/** ローカルLLMの既定コンテキスト長（aiService.ts と同値） */
const DEFAULT_LOCAL_CONTEXT_LENGTH = 12000;
const MIN_LOCAL_CONTEXT_LENGTH = 1000;
/** クラウドプロバイダーの入力目安（実際の上限はモデル依存だが下記の強制上限が効く） */
const DEFAULT_CLOUD_CONTEXT_LENGTH = 10000;
/** プロンプトテンプレート＋システムプロンプト分のオーバーヘッド見込み */
const PROMPT_OVERHEAD = 1500;
/**
 * 重要: aiService.generateContent は内部で sanitizeInputForPrompt(prompt) を
 * 第2引数なしで呼ぶため、全プロバイダー共通でプロンプト全体が
 * 既定 10000 文字に強制切り詰めされる（securityUtils.ts のDoS対策）。
 * これを超える budget を返すと、テンプレート込みのプロンプトが黙って欠落し、
 * 集約・抽出の入力（章要約など）が失われる。よって全プロバイダーでこの値を上限にする。
 */
const SANITIZE_HARD_CAP = 10000;

/**
 * 1回のAI呼び出しで、可変データ（章要約や本文など）に割り当てられる
 * 安全な最大文字数を返す。
 */
export function getInputCharBudget(settings: AISettings): number {
    const isLocal = settings.provider === 'local';
    const base = isLocal
        ? (typeof settings.localContextLength === 'number' && settings.localContextLength >= MIN_LOCAL_CONTEXT_LENGTH
            ? settings.localContextLength
            : DEFAULT_LOCAL_CONTEXT_LENGTH)
        : DEFAULT_CLOUD_CONTEXT_LENGTH;

    // base からテンプレート分を引き、さらにサニタイザの強制上限内に収める
    const budget = Math.min(base, SANITIZE_HARD_CAP) - PROMPT_OVERHEAD;
    return Math.max(800, budget);
}
