/**
 * プロット構成推定（PlotStep2のオンデマンド分析アクション）のプロンプトビルダー
 *
 * インポート系プロンプト（prompts/import.ts）と同じ「忠実抽出・創作禁止」の方針。
 * 構成カタログは buildStructureCatalog()（services/plotStructure/inferStructure.ts）で
 * PLOT_STRUCTURE_CONFIGS から動的生成して渡す。
 */

export interface StructureInferencePromptVars {
    synopsis: string;
    theme: string;
    setting: string;
    /** buildChapterDigest の出力（タイトル＋概要の一覧） */
    chaptersDigest: string;
    /** buildStructureCatalog の出力（6構成と段階キーの定義） */
    structureCatalog: string;
}

export function buildStructureInferencePrompt(vars: StructureInferencePromptVars): string {
    return `あなたは物語の構成を分析する編集者です。次の作品情報を読み、下記6種類の構成のうちどれに最も当てはまるかを判定し、各段階に対応する内容を作品情報から抽出してください。

【あらすじ（ここから）】
${vars.synopsis || '（未設定）'}
【あらすじ（ここまで）】

【テーマ】
${vars.theme || '（未設定）'}

【舞台設定】
${vars.setting || '（未設定）'}

【章一覧（ここから）】
${vars.chaptersDigest || '（章は未作成）'}
【章一覧（ここまで）】

【構成カタログ】
${vars.structureCatalog}

【分析方針】
- あらすじ・章一覧に書かれている内容だけを根拠にする。推測・創作・補完をしない
- 各段階の内容は400文字以内。該当する内容が作品情報から読み取れない段階は空文字 "" にする（無理に埋めない）
- reason には選定理由を100文字以内で書く

【出力形式】
次のJSON形式のみを出力してください。説明やコメントは不要。fields のキーは選んだ構成の段階キー（カタログの「-」で始まる行のキー）をそのまま使うこと。
{
  "structure": "kishotenketsu | three-act | four-act | heroes-journey | beat-sheet | mystery-suspense のいずれか",
  "reason": "選定理由（100文字以内）",
  "fields": { "<段階キー>": "段階の内容（400文字以内、不明なら空文字）" }
}`;
}
