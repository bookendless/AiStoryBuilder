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
 * 要約・集約パイプライン（summarizeChapters / aggregateStory）が generateContent に渡す
 * サニタイズ上限。入力データ自体は getInputCharBudget で予算内に収めるが、そこに固定長の
 * テンプレート（出力形式指示など）が加わると組立後プロンプトが既定10000をわずかに超え、
 * 末尾指示が黙って切り詰められうる。ここを引き上げてテンプレート末尾を死守する
 * （入力はあくまで予算で制御されるため、この値までプロンプトが膨らむわけではない）。
 * recap / whatIf / import / 続編 の共有経路で使うため、機能非依存の中立名にしている。
 */
export const SUMMARIZATION_PROMPT_CAP = 20000;

/**
 * 1回のAI呼び出しで、可変データ（章要約や本文など）に割り当てられる
 * 安全な最大文字数を返す。
 *
 * @param hardCap サニタイズ上限のオーバーライド。既定は 10000（従来の続編/要約パイプライン互換）。
 *   インポート等で aiService に request.maxPromptLength を渡して上限を引き上げる場合、
 *   同じ値をここにも渡すことで予算計算と実際の切り詰めを整合させる。
 *   ローカルLLMは別途 localContextLength で切り詰められるため、その範囲内に収める。
 */
export function getInputCharBudget(settings: AISettings, hardCap: number = SANITIZE_HARD_CAP): number {
    const isLocal = settings.provider === 'local';
    const base = isLocal
        ? (typeof settings.localContextLength === 'number' && settings.localContextLength >= MIN_LOCAL_CONTEXT_LENGTH
            ? settings.localContextLength
            : DEFAULT_LOCAL_CONTEXT_LENGTH)
        : hardCap;

    // base からテンプレート分を引き、さらにサニタイザの上限内に収める
    const budget = Math.min(base, hardCap) - PROMPT_OVERHEAD;
    return Math.max(800, budget);
}
