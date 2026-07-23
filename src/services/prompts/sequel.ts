/**
 * 続編構成（Sequel Composer）関連のプロンプトビルダー
 *
 * 他のプロンプト群（synopsis.ts 等）は `{variable}` 置換テンプレートだが、
 * 続編構成は章リスト・キャラリスト等の動的な構造化データを多く扱うため、
 * テンプレート文字列を組み立てる関数として実装している。
 * 生成された文字列は aiService.generateContent({ prompt, type, settings }) に渡す。
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * 続編構成プロンプトのサニタイズ上限（文字数）。
 * キャラクター・世界観・相関図の全文ダンプがJSON出力形式の指示より前に無制限で挿入されるため、
 * 既定の10000文字では末尾のJSON出力形式が黙って切り詰められる。maxPromptLength に渡して引き上げる。
 */
export const SEQUEL_PROMPT_CAP = 30000;

/** 1章分の本文を要約するプロンプト（詳細モードのみ使用） */
export function buildChapterSummaryPrompt(title: string, body: string): string {
    return `あなたは小説の分析を専門とする編集者です。次の章の本文を、続編制作のための分析素材として簡潔に要約してください。

【章タイトル】${title}

${dataBlock('本文', body)}

【要約の方針】
- 起きた出来事、登場人物の行動と心情の変化、世界観に関わる情報を漏れなく拾う
- 300文字程度に圧縮する
- 説明やコメントは不要。要約本文のみを出力`;
}

/** 章ダイジェスト群を1つの全体要約に集約するプロンプト */
export function buildAggregatePrompt(joinedDigests: string, isPartial: boolean): string {
    const role = isPartial
        ? '次は、ある作品の連続する章の要約です。これらを1つのまとまった要約に統合してください。'
        : '次は、ある作品の全章の要約です。物語全体を通した一貫した要約に統合してください。';

    return `あなたは小説の分析を専門とする編集者です。${role}

${dataBlock('章ごとの要約', joinedDigests)}

【統合の方針】
- 時系列に沿って物語全体の流れを再構成する
- 主要な出来事、結末、キャラクターの到達点を含める
- 続編制作の素材とするため、未解決の要素も残す
- 800文字程度に統合する
- 統合した要約本文のみを出力。説明やコメントは不要`;
}

/** ストーリー全体要素から続編向けの分析を抽出するプロンプト */
export function buildExtractPrompt(
    storyDigest: string,
    charactersInfo: string,
    worldInfo: string,
    relationshipsInfo: string
): string {
    return `あなたは続編制作を支援する編集者です。前作の情報を分析し、続編づくりに必要な観点を抽出してください。

${dataBlock('前作の全体要約', storyDigest)}

${dataBlock('登場キャラクター', charactersInfo)}

${dataBlock('世界観設定', worldInfo)}

${dataBlock('キャラクター相関', relationshipsInfo)}

【抽出してほしい観点】
1. characterGrowth: 各主要キャラクターが前作を通してどう成長・変化したか
2. relationshipChanges: キャラクター間の関係性が前作でどう変化したか
3. worldChanges: 世界観・情勢・社会がどう変化したか（前作終了時点の状態）
4. openThreads: 未解決の課題・伏線・葛藤（続編のフックになり得るもの）

【出力形式】
次のJSON形式のみを出力してください。各値は日本語の文章（箇条書き可）とします。
{
  "characterGrowth": "...",
  "relationshipChanges": "...",
  "worldChanges": "...",
  "openThreads": "..."
}

${JSON_OUTPUT_RULES}`;
}

/** 続編のあらすじとプロット基本設定を生成するプロンプト */
export function buildGenerateSynopsisPlotPrompt(
    sourceTitle: string,
    storyDigest: string,
    characterGrowth: string,
    worldChanges: string,
    openThreads: string
): string {
    return `あなたは小説のプロット設計を専門とする編集者です。前作「${sourceTitle}」の続編となる物語の、あらすじとプロット基本設定を考えてください。

${dataBlock('前作の全体要約', storyDigest)}

${dataBlock('キャラクターの到達点', characterGrowth)}

${dataBlock('世界観の変化', worldChanges)}

${dataBlock('未解決の要素（続編のフック候補）', openThreads)}

【方針】
- 前作の結末と地続きで、キャラクターの成長を踏まえた自然な続編にする
- 未解決の要素を活かして新たな葛藤・目標を立ち上げる（単なる焼き直しにしない）
- synopsis は500文字程度

【出力形式】
次のJSON形式のみを出力してください。
{
  "synopsis": "続編のあらすじ（500文字程度）",
  "plot": {
    "theme": "続編のテーマ",
    "setting": "舞台・状況設定",
    "hook": "読者を引き込むフック",
    "protagonistGoal": "主人公の新たな目標",
    "mainObstacle": "主要な障害"
  }
}

${JSON_OUTPUT_RULES}`;
}

/** 続編開始時点に向けてキャラクター設定を更新するプロンプト */
export function buildUpdateCharactersPrompt(
    charactersInfo: string,
    characterGrowth: string,
    sequelSynopsis: string
): string {
    return `あなたはキャラクター設定を専門とする編集者です。前作のキャラクターを、続編の開始時点に合わせて更新してください。成長や変化を反映し、続編であらためて描くための設定にします。

${dataBlock('前作終了時点のキャラクター', charactersInfo)}

${dataBlock('キャラクターの成長・変化', characterGrowth)}

${dataBlock('続編のあらすじ', sequelSynopsis)}

【方針】
- id は元のまま変更しない（対応関係を保つため）
- personality と background を続編開始時点の状態に更新する
- 成長を踏まえつつ、キャラクターの核は維持する

【出力形式】
次のJSON形式のみを出力してください。更新が不要なキャラクターも含めて全員分を出力します。
{
  "characters": [
    { "id": "元のID", "personality": "更新後の性格", "background": "更新後の背景" }
  ]
}

${JSON_OUTPUT_RULES}`;
}
