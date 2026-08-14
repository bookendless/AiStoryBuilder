/**
 * AI指摘の引用（quote）の実在検証
 *
 * 整合性ガード・AI校正・講評は、いずれも「本文のどこが問題か」をAIに引用させ、その引用が
 * 本文に実在するかを照合することで、存在しない箇所への指摘（幻覚指摘）を弾いている。
 * その照合部分をここに集約する。
 *
 * ## 照合対象はサニタイズ後の本文であること
 * aiService はプロンプト送信前に sanitizeInputForPrompt を通し、`<` `>` の除去や
 * 連続改行・連続空白の圧縮を行う。つまりAIが読んだのは元の本文そのものではない。
 * 元の本文と突き合わせると、それらの文字を含む箇所で正しい引用まで不一致になってしまうため、
 * 照合の前に normalizeForQuoteMatch を通す。
 */

import { sanitizeInputForPrompt } from '../../utils/securityUtils';

/** quote の最大文字数（プロンプトの指示値より緩めに取る） */
export const MAX_QUOTE_LENGTH = 200;

/**
 * 照合用に本文を正規化する。
 * プロンプト組み立て時と同じサニタイズを通すことで、AIが実際に読んだ文字列に揃える。
 * 上限は buildPrompt の変数サニタイズと同じ 50000 文字。
 */
export const normalizeForQuoteMatch = (text: string): string =>
    sanitizeInputForPrompt(text, 50000);

/**
 * 引用が本文に一字一句存在するかを判定する。
 * 空の引用・長すぎる引用は「検証できない」ものとして false を返す。
 *
 * @param quote AIが返した引用（trim 済みを想定）
 * @param normalizedText normalizeForQuoteMatch を通した本文
 */
export const quoteExists = (quote: string, normalizedText: string): boolean => {
    if (!quote || quote.length > MAX_QUOTE_LENGTH) return false;
    return normalizedText.includes(quote);
};
