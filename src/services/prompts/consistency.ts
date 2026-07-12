/**
 * 整合性ガード（設定ドリフト検知）プロンプトテンプレート
 *
 * proofread と同じ設計方針:
 * - 指摘の位置は「本文中に実在する引用（quote）」で返させ、受信側で indexOf 照合して
 *   実在しない引用（幻覚指摘）を破棄する
 * - 確信の持てない指摘・作者の意図的な変化は指摘させない（誤検知の抑制）
 */

import { ConsistencyCategory } from '../../types/consistency';
import { dataBlock, JSON_OUTPUT_RULES } from './common';

/** カテゴリごとのチェック指示 */
const CATEGORY_INSTRUCTIONS: Record<ConsistencyCategory, string> = {
    appearance:
        'キャラクターの容姿・身体的特徴（瞳や髪の色、身長、体格、傷など）が設定台帳や章内の他の記述と矛盾していないか',
    narration:
        'キャラクターの一人称（俺・僕・私など）や口調（敬語・方言・語尾など）が、設定台帳や章内の他の場面と理由なくブレていないか',
    address:
        'キャラクター間の呼称（〜さん・〜くん・呼び捨て・あだ名など）が理由なくブレていないか',
    terminology:
        '固有名詞・用語の表記が設定台帳（用語集）と一致しているか、章内で表記が揺れていないか',
    timeline:
        '時系列（季節・時刻・経過日数・出来事の順序）が設定台帳や章内の他の記述と矛盾していないか',
};

export interface ConsistencyPromptArgs {
    chapterTitle: string;
    chapterText: string;
    factSheet: string;
    categories: ConsistencyCategory[];
}

export function buildConsistencyPrompt(args: ConsistencyPromptArgs): string {
    const checkList = args.categories
        .map((c, i) => `${i + 1}. ${c}: ${CATEGORY_INSTRUCTIONS[c]}`)
        .join('\n');

    return `あなたは小説の設定管理を専門とする校閲者です。以下の設定台帳と章の本文を突き合わせ、設定の矛盾・ブレを検出してJSON形式で報告してください。

${dataBlock('設定台帳', args.factSheet)}

${dataBlock(`章「${args.chapterTitle}」の本文`, args.chapterText)}

【チェック項目（この種類の問題のみ指摘する。カテゴリ名は英語のまま使う）】
${checkList}

【重要な禁止事項】
- 確信が持てない箇所は指摘しないでください
- 物語上の意図的な変化（キャラクターの成長・関係性の変化・変装・演技・回想など）と解釈できるものは指摘しないでください
- 文体・表現の好みに関する指摘はしないでください
- 設定台帳に情報がなく、章内にも比較対象がない事柄は指摘しないでください

【severity の基準】
- high: 読者が確実に気づく明白な矛盾（例: 瞳の色が変わる、死亡した人物が登場）
- medium: 注意深い読者が気づく矛盾（例: 呼称・一人称のブレ）
- low: 軽微な表記ゆれ

${JSON_OUTPUT_RULES}

【出力形式】
指摘がない場合は {"issues": []} を返してください。最大10件まで。
quoteは本文中に実際に存在する文字列を一字一句そのまま抜き出してください（前後の文脈を含めて一意に特定できる長さで、80文字以内）。

{
  "issues": [
    {
      "quote": "本文中の該当箇所（完全一致）",
      "category": "appearance | narration | address | terminology | timeline のいずれか",
      "severity": "high | medium | low のいずれか",
      "description": "何がどう矛盾しているか",
      "evidence": "根拠（設定台帳のどの記述、または章内のどの記述と矛盾するか）",
      "suggestion": "修正案（任意）"
    }
  ]
}`;
}
