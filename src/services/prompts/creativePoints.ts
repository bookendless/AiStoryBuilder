/**
 * 創造ポイント（Phase C）のプロンプト付記とマーカー定義
 *
 * 既存の大型生成プロンプト（あらすじ・章立て）の末尾に追記して、
 * 「本来の出力 → マーカー → creativePoints JSON」の順で出力させる。
 * 本文側はマーカー以降を除去して反映するため、適用テキストは汚れない。
 */

/** 本文と creativePoints JSON を区切るマーカー（本文側からは除去する） */
export const CREATIVE_POINTS_MARKER = '===CREATIVE_POINTS_JSON===';

/**
 * 既存プロンプトの末尾に追記する指示文。
 * @param outputDescription 本来の出力物の呼称（例:「あらすじ」「章立て」）
 */
export function buildCreativePointsInstruction(outputDescription: string): string {
    return `

【追加指示：創造ポイントの付記】
上記の${outputDescription}を推奨案で最後まで完成させた後、改行して次の1行だけのマーカーを出力し、続けて creativePoints のJSONを出力してください。
${CREATIVE_POINTS_MARKER}
このJSONには、「作者の判断によって物語が分かれる箇所」を2〜4点挙げます。各ポイントには現在の推奨案(current)と、1〜3個の別案(alternatives)を添え、それぞれに別案の要約(summary)とその帰結(consequence)を1行で書きます。

【マーカー以降のJSON形式（厳守）】
${CREATIVE_POINTS_MARKER}
{
  "creativePoints": [
    {
      "label": "判断ポイントの短い見出し",
      "current": "現在の推奨案でどう扱ったか（1行）",
      "alternatives": [
        { "summary": "別案の要約（1行）", "consequence": "その別案を選んだ場合の帰結（1行）" }
      ]
    }
  ]
}

【ルール】
- マーカーより前は通常の${outputDescription}本文のみとし、JSONやマーカーを混在させない
- creativePoints は2〜4個、各 alternatives は1〜3個
- 日本語で簡潔に。JSON以外の説明はマーカー以降に書かない`;
}

/**
 * 出力が単一のJSONオブジェクトである生成（例: plot2 のプロット構成）向けの付記。
 * マーカー方式（散文向け）と異なり、本来のJSONに `creativePoints` キーを追加させる。
 * こうしないとモデルが「構成を完成させてから…」を散文出力と誤解し、必須のJSON形式を崩す。
 */
export function buildCreativePointsJsonKeyInstruction(): string {
    return `

【追加指示：創造ポイントの付記（同一JSON内）】
上記で指定されたJSONオブジェクトに、トップレベルのキー "creativePoints" を必ず1つ追加してください。
これは「作者の判断によって物語が分かれる箇所」を2〜4点挙げた配列です。各要素の形式は次の通りです。
{ "label": "判断ポイントの短い見出し", "current": "現在の推奨案でどう扱ったか（1行）", "alternatives": [ { "summary": "別案の要約（1行）", "consequence": "その別案を選んだ場合の帰結（1行）" } ] }

【ルール（厳守）】
- 構成本体は必ず指定どおりのJSON形式で出力し、各幕・各段階のキーをそのまま維持する（散文だけで終えない）
- creativePoints は同じJSONオブジェクト内に並べる。別ブロックやマーカーにしない
- creativePoints は2〜4個、各 alternatives は1〜3個。日本語で簡潔に`;
}
