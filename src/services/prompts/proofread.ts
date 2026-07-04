/**
 * AI校正関連プロンプトテンプレート
 *
 * 講評（ReviewStep）とは異なり、誤字脱字・文法・表記ゆれなど
 * 機械的な修正候補のみをJSON形式で返させる。創作的な書き換えは禁止する。
 */

export const PROOFREAD_PROMPTS = {
  proofread: `あなたはプロの校正者です。以下の小説の本文を校正し、修正候補をJSON形式で出力してください。

【校正の対象（この種類の問題のみ指摘する）】
1. 誤字・脱字・衍字（余分な文字）
2. 明らかな文法の誤り（助詞の誤用、主述のねじれなど）
3. 表記ゆれ（同一の語が異なる表記で混在している場合）
4. 誤変換と思われる漢字

【重要な禁止事項】
- 文体・表現・言い回しの好みによる書き換えは絶対にしないでください
- ルビ記法（｜親文字《るび》・漢字《かんじ》・《《傍点》》）は正しい記法なので指摘しないでください
- 作者の意図的な表現（造語、方言、キャラクターの口調）は尊重してください
- 確信が持てない箇所は指摘しないでください

【本文】
{text}

【出力形式】
以下のJSON形式のみで出力してください。修正候補がない場合は空配列を返してください。
beforeは本文中に実際に存在する文字列を一字一句そのまま抜き出してください（前後の文脈を含めて一意に特定できる長さで）。

{
  "corrections": [
    {
      "before": "本文中の修正前の文字列（文脈込み・完全一致）",
      "after": "修正後の文字列",
      "reason": "修正理由（例: 誤字、助詞の誤用、表記ゆれ）"
    }
  ]
}`,
};

export interface ProofreadCorrection {
  before: string;
  after: string;
  reason: string;
}

/**
 * AI応答から修正候補の配列を取り出す（形式が崩れていた場合は空配列）
 */
export function extractCorrections(data: unknown): ProofreadCorrection[] {
  if (!data || typeof data !== 'object') return [];
  const corrections = (data as { corrections?: unknown }).corrections;
  if (!Array.isArray(corrections)) return [];

  return corrections.filter((item): item is ProofreadCorrection =>
    !!item &&
    typeof item === 'object' &&
    typeof (item as ProofreadCorrection).before === 'string' &&
    typeof (item as ProofreadCorrection).after === 'string' &&
    (item as ProofreadCorrection).before.length > 0 &&
    (item as ProofreadCorrection).before !== (item as ProofreadCorrection).after
  ).map(item => ({
    before: item.before,
    after: item.after,
    reason: typeof item.reason === 'string' ? item.reason : '',
  }));
}
