/**
 * タイムライン関連プロンプト
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * タイムラインプロンプトのサニタイズ上限（文字数）。
 * projectContext が全章のdraft抜粋をslice無しで積む構造上、既定の10000文字では
 * 末尾のJSON出力形式指示が黙って切り詰められる。generateContent の maxPromptLength に渡して引き上げる。
 */
export const TIMELINE_PROMPT_CAP = 24000;

/** プロジェクト情報からの重要イベント自動抽出プロンプト */
export function buildTimelineExtractEventsPrompt(projectContext: string, existingTimelineJson: string): string {
  return `あなたは物語の時系列を整理する編集者です。以下のプロジェクト情報から、タイムラインに追加すべき重要なイベントを抽出してください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('既存のタイムライン（これに含まれるイベントは除外する）', existingTimelineJson)}

【抽出の方針】
- すべての章の内容を均等に参照し、特定の章に偏らず、物語全体を俯瞰して重要なイベントを網羅的に抽出する（各章から少なくとも1つ以上のイベントを検討する）
- 重要なイベントとは：プロット上の転換点、キャラクターの成長、世界観の変化など
- 既存のタイムラインに含まれているイベントは除外する

【各イベントに含める情報】
- タイトル（簡潔で分かりやすい）
- 説明（100文字以上300文字程度）
- 日付/時期（物語内での時期、例：「物語開始後3年目」「第一章」など）
- カテゴリ（plot: プロット, character: キャラクター, world: 世界, other: その他）
- 関連する章（該当する章のタイトル）
- 関連するキャラクター（該当するキャラクター名）

【出力形式】
以下のJSON配列形式で出力してください：
[
  {
    "title": "イベントタイトル",
    "description": "イベントの詳細説明",
    "date": "日付/時期",
    "category": "plot|character|world|other",
    "chapterTitle": "章のタイトル（任意）",
    "characterNames": ["キャラクター名1", "キャラクター名2"]
  }
]

【Few-Shot例】
入力: 「第1章で主人公が旅に出る。第2章で仲間と出会う。第3章で敵と戦う。」

正しい出力例:
[
  {"title": "主人公の旅立ち", "description": "主人公が故郷を離れ、冒険の旅に出発する重要な転換点。これまでの日常から決別し、未知の世界へと足を踏み出す。", "date": "第1章", "category": "plot", "chapterTitle": "第1章", "characterNames": ["主人公"]},
  {"title": "仲間との出会い", "description": "旅の途中で重要な仲間と出会う。互いの力を認め合い、共に旅を続けることを決意する。", "date": "第2章", "category": "character", "chapterTitle": "第2章", "characterNames": ["主人公", "仲間"]},
  {"title": "敵との初戦", "description": "強大な敵との最初の戦い。主人公たちの力が試される。", "date": "第3章", "category": "plot", "chapterTitle": "第3章", "characterNames": ["主人公", "仲間", "敵"]}
]

${JSON_OUTPUT_RULES}
- 箇条書きやマークダウン形式では出力しない`;
}

/** 1件のイベントについての説明文自動生成プロンプト */
export function buildTimelineDescriptionPrompt(
  projectContext: string,
  title: string,
  date: string | undefined,
  category: string | undefined
): string {
  return `あなたは物語の時系列を整理する編集者です。以下のイベントについて、プロジェクトの世界観に合わせた説明文を生成してください。

${dataBlock('プロジェクト情報', projectContext)}

【対象のイベント】
イベントタイトル: ${title}
${date ? `日付/時期: ${date}` : ''}
${category ? `カテゴリ: ${category}` : ''}

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成する
2. 説明文は100文字以上300文字程度で、具体的で分かりやすい内容にする
3. 日付/時期が未入力の場合は提案する
4. カテゴリも提案する（plot, character, world, otherのいずれか）
5. 関連する章やキャラクターも提案する

【出力形式】
以下のJSON形式で出力してください：
{
  "description": "説明文",
  "date": "日付/時期（任意）",
  "category": "plot|character|world|other",
  "chapterTitle": "関連する章のタイトル（任意）",
  "characterNames": ["キャラクター名1", "キャラクター名2"]
}

${JSON_OUTPUT_RULES}`;
}

/** タイムラインの時系列整合性チェックプロンプト */
export function buildTimelineConsistencyCheckPrompt(projectContext: string, timelineText: string): string {
  return `あなたは物語の整合性チェックを専門とする編集者です。以下のタイムラインについて、時系列の整合性をチェックしてください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('現在のタイムライン', timelineText)}

【チェック項目】
1. イベントの順序が論理的に正しいか
2. 日付/時期の記述に矛盾がないか
3. プロット設定との整合性
4. キャラクターの行動や動機の一貫性
5. 時系列のギャップや飛躍がないか

問題があれば具体的に指摘し、改善提案をしてください。

【出力形式】
以下のJSON形式で出力してください：
{
  "hasIssues": trueまたはfalse,
  "issues": ["問題点1", "問題点2"],
  "suggestions": ["改善提案1", "改善提案2"]
}

【Few-Shot例】
問題がある場合の出力例:
{"hasIssues": true, "issues": ["主人公が第2章で敵と戦っていますが、第3章で初めて敵に会うという記述があり矛盾しています", "第1章から第5章の間に大きな時間の飛躍があります"], "suggestions": ["第2章と第3章のイベント順序を見直してください", "第1章と第5章の間に中間的なイベントを追加することを検討してください"]}

問題がない場合の出力例:
{"hasIssues": false, "issues": [], "suggestions": []}

${JSON_OUTPUT_RULES}
- 箇条書きやマークダウン形式では出力しない`;
}

/** 物語に追加すべき新規イベントの提案プロンプト */
export function buildTimelineSuggestPrompt(projectContext: string, timelineText: string): string {
  return `あなたは物語の時系列を設計する編集者です。以下のプロジェクト情報と現在のタイムラインを参考に、物語に追加すべきイベントを提案してください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('現在のタイムライン', timelineText)}

【提案の方針】
- すべての章を考慮し、特定の章に偏らず、物語全体の流れを俯瞰して提案する
- プロットの流れを考慮して、物語に必要なイベントを提案する
- キャラクターの成長や関係性の発展に関わるイベントも含める

【各イベントに含める情報】
- タイトル
- 説明（100文字以上300文字程度）
- 日付/時期
- カテゴリ（plot, character, world, other）
- 関連する章（該当する場合）
- 関連するキャラクター（該当する場合）

【出力形式】
以下のJSON配列形式で出力してください：
[
  {
    "title": "イベントタイトル",
    "description": "イベントの詳細説明",
    "date": "日付/時期",
    "category": "plot|character|world|other",
    "chapterTitle": "章のタイトル（任意）",
    "characterNames": ["キャラクター名1", "キャラクター名2"]
  }
]

【Few-Shot例】
入力: 「主人公が旅立ち、仲間と出会う物語」

正しい出力例:
[
  {"title": "主人公の決意", "description": "困難に直面し、主人公が新たな覚悟を決める重要なターニングポイント。", "date": "中盤", "category": "character", "characterNames": ["主人公"]},
  {"title": "仲間の過去の秘密", "description": "仲間の隠された過去が明かされ、物語に新たな展開をもたらす。", "date": "後半", "category": "character", "characterNames": ["仲間"]}
]

${JSON_OUTPUT_RULES}
- 箇条書きやマークダウン形式では出力しない`;
}
