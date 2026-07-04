/**
 * 小説断片インポート（Story Importer）関連のプロンプトビルダー
 *
 * 続編構成（sequel.ts）が「創作」を目的とするのに対し、インポートは
 * 「ユーザーの原文に忠実な再構成」を目的とする。そのため本ファイルのプロンプトは
 * sequel.ts を流用せず、低温度・「本文に在るものだけ報告／無ければ空／創作禁止」を徹底する。
 *
 * 生成された文字列は aiService.generateContent({ prompt, type, settings, maxPromptLength, systemPrompt }) に渡す。
 */

import { dataBlock } from './common';
import {
    STYLE_OPTIONS,
    PERSPECTIVE_OPTIONS,
    FORMALITY_OPTIONS,
    RHYTHM_OPTIONS,
    METAPHOR_OPTIONS,
    DIALOGUE_OPTIONS,
    EMOTION_OPTIONS,
    TONE_OPTIONS,
} from '../../constants/writingStyle';

/**
 * 取り込み専用のシステムプロンプト。
 *
 * 既定の SYSTEM_PROMPT（aiService.ts）は「物語の魅力を最大化する創作支援」を指示しており、
 * 取り込みの「原文に忠実な抽出（創作禁止）」と真っ向から矛盾し、創作・捏造の原因になる。
 * 取り込みパイプラインの全AI呼び出しでは、この分析用システムプロンプトに差し替える。
 */
export const IMPORT_SYSTEM_PROMPT = `あなたは小説本文を正確に分析・抽出する校正者・編集者です。

【最重要原則】
- 本文に明示的に書かれている情報だけを抽出・要約します。
- 推測・想像・創作・補完・脚色を一切行いません。
- 本文から読み取れない項目は、無理に埋めず空にします。
- 物語を「良くする」「魅力的にする」ための加筆や創作は禁止です。
- あなたの仕事は、与えられた本文を原文に忠実に、過不足なく構造化することだけです。

指示された出力形式（JSON等）を厳密に守り、本文の事実のみを反映してください。`;

/** 小説本文の1チャンクを忠実に要約する（概要把握フェーズの map） */
export function buildProseChunkSummaryPrompt(body: string, part: number, total: number): string {
    return `次の小説本文（全${total}部分中の第${part}部分）を、内容把握のために忠実に要約してください。

${dataBlock('本文', body)}

【方針】
- 本文に書かれている出来事・人物・場面のみを要約する。推測や創作で補完しない
- 起きた出来事、登場人物の行動、舞台・世界観に関わる情報を落とさない
- 300〜400文字程度に圧縮する
- 要約本文のみを出力。前置きや説明は不要`;
}

/** 作品全体の要約から概要フィールド（タイトル案・ジャンル・あらすじ・プロット基本）を抽出する */
export function buildOverviewExtractPrompt(storyDigest: string): string {
    return `あなたは小説の構成を分析する編集者です。次の作品全体の要約を読み、AiStoryBuilder の項目に合わせて構造化情報を抽出してください。

${dataBlock('作品全体の要約', storyDigest)}

【抽出方針】
- 要約に書かれている内容だけを根拠にする。書かれていない設定を創作しない
- 判断できない項目は空文字 "" にする（無理に埋めない）
- title は作品にふさわしいタイトル案（本文中から題が読み取れればそれを優先）
- synopsis は作品全体のあらすじ（400〜500文字程度）

【出力形式】
次のJSON形式のみを出力してください。説明やコメントは不要。
{
  "title": "作品タイトル案",
  "mainGenre": "主ジャンル（例: ファンタジー / ミステリー / 恋愛 / SF など）",
  "subGenre": "サブジャンル（不明なら空）",
  "targetReader": "想定読者（例: 全年齢 / 少年向け / 一般文芸 など。不明なら空）",
  "synopsis": "あらすじ（400〜500文字程度）",
  "plot": {
    "theme": "作品のテーマ（100文字以内）",
    "setting": "舞台設定（300文字以内）",
    "hook": "物語の引き・冒頭の魅力（300文字以内）",
    "protagonistGoal": "主人公の目標（100文字以内）",
    "mainObstacle": "主要な障害（100文字以内）"
  }
}`;
}

/**
 * 本文の抜粋と機械計測値から、アプリの文体設定8軸を分類する（文体フェーズ）
 *
 * AIの自由生成を許すと文体設定の選択肢に存在しない値が返り設定が壊れるため、
 * 各軸の選択肢を列挙して「この中から択一」を厳守させる（閉じた選択）。
 * さらに analyzeStyleMetrics の客観計測値を渡し、計測と矛盾する選択を抑止する。
 * 出力の検証とフォールバックは classifyStyle 側で行う。
 *
 * @param excerpts 本文の代表抜粋（冒頭・中間・終盤など。順序どおりに提示される）
 * @param metricsSummary formatStyleMetrics で整形した機械計測サマリー
 */
export function buildStyleClassifyPrompt(excerpts: string[], metricsSummary: string): string {
    const excerptBlocks = excerpts
        .map((e, i) => `【抜粋${i + 1}】\n${e}`)
        .join('\n\n');
    // 「その他」は分類先として無意味なため選択肢から除外する
    const styleChoices = STYLE_OPTIONS.filter(o => o !== 'その他');
    return `次の小説本文の抜粋を読み、文体の特徴を分析して、各項目を指定の選択肢から1つずつ選んでください。

${excerptBlocks}

【機械計測の結果（参考。これと矛盾する選択をしない）】
${metricsSummary}

【分析方針】
- 抜粋に実際に表れている文体の特徴だけを根拠にする。推測で補わない
- 各項目は必ず下記の選択肢の中から一字一句そのまま選ぶ。選択肢に無い値を作らない
- 抜粋からどうしても判断できない項目は空文字 "" にする
- styleNote には、この作品の文体の特徴（語彙の傾向・語尾・雰囲気など）を100文字程度で記述する

【選択肢】
- style（基本文体）: ${styleChoices.join(' / ')}
- perspective（人称）: ${PERSPECTIVE_OPTIONS.join(' / ')}
- formality（硬軟）: ${FORMALITY_OPTIONS.join(' / ')}
- rhythm（リズム）: ${RHYTHM_OPTIONS.join(' / ')}
- metaphor（比喩表現）: ${METAPHOR_OPTIONS.join(' / ')}
- dialogue（会話比率）: ${DIALOGUE_OPTIONS.join(' / ')}
- emotion（感情描写）: ${EMOTION_OPTIONS.join(' / ')}
- tone（トーン）: ${TONE_OPTIONS.join(' / ')}

【出力形式】
次のJSON形式のみを出力してください。説明やコメントは不要。
{
  "style": "選択肢から択一",
  "perspective": "選択肢から択一",
  "formality": "選択肢から択一",
  "rhythm": "選択肢から択一",
  "metaphor": "選択肢から択一",
  "dialogue": "選択肢から択一",
  "emotion": "選択肢から択一",
  "tone": "選択肢から択一",
  "styleNote": "文体の特徴メモ（100文字程度）"
}`;
}

/**
 * 本文1チャンクから登場人物を忠実に抽出する（列挙フェーズの map）
 *
 * 同一人物が愛称・呼称違いで重複登録されるのを防ぐため、
 * (1) 最も正式な呼称を name にし、他の呼び方を aliases に列挙させる
 * (2) 前のチャンクまでに判明した既知人物リスト（knownCharacters）を渡し、呼称を揃えさせる
 *
 * @param knownCharacters 既知の登場人物の整形済みリスト（formatKnownCharacters の出力）。
 *   空なら注入ブロックごと省略され、第1チャンクのプロンプトは従来構成と同じになる。
 */
export function buildCharacterExtractPrompt(body: string, part: number, total: number, knownCharacters?: string): string {
    const knownBlock = knownCharacters?.trim()
        ? `
【既知の登場人物（前の部分までに判明している人物）】
${knownCharacters.trim()}
※この部分に上記と同一の人物が登場する場合は、必ず上記と同じ name を使ってください。新しい呼び方が出てきた場合は aliases に追加してください。
`
        : '';
    return `次の小説本文（全${total}部分中の第${part}部分）に登場する人物を、本文の記述に基づいて抽出してください。

${dataBlock('本文', body)}
${knownBlock}
【抽出方針】
- この部分に実際に登場・言及される人物のみを挙げる。本文にない人物を創作しない
- 各項目は本文から読み取れる範囲で記述し、読み取れない項目は空文字 "" にする
- 脇役・端役も漏らさず挙げる（後で同一人物は自動的にまとめられる）
- name はこの部分で使われている呼称のうち最も正式・完全なもの（フルネームがあればフルネーム）を本文表記のまま使う
- 同じ人物が他の呼び方（あだ名・名字のみ・名前のみ・敬称付き・「先生」「少年」のような呼称）でも登場する場合、その呼称を aliases に列挙する
- aliases には本文に実際に出てくる呼称のみを入れる。代名詞（彼・彼女・私・あいつ など）は含めない
- 同じ名字の別人（家族・兄弟など）が登場する場合、名字だけの呼称はどの人物の aliases にも入れない

【出力形式】
次のJSON形式のみを出力してください。人物がいなければ "characters": [] とします。説明やコメントは不要。
{
  "characters": [
    {
      "name": "名前・呼称",
      "aliases": ["この部分で使われた他の呼称（無ければ空配列）"],
      "role": "作中での役割（主人公 / 敵役 / 協力者 など。不明なら空）",
      "appearance": "外見の描写（本文にあれば）",
      "personality": "性格（本文から読み取れる範囲）",
      "background": "背景・経歴（本文にあれば）",
      "speechStyle": "口調・話し方の特徴（本文にあれば）"
    }
  ]
}`;
}

/**
 * 名寄せ後の人物リストから、同一人物を指す項目グループをAIに判定させる（仕上げの reduce）。
 *
 * 別名抽出と既知人物リスト注入で拾えない「どのチャンクにも明示的な対応が無い」
 * 重複（例: 序盤は「少年」、終盤で「山田太郎」と判明）を最後の1回で解決する。
 * 誤統合（兄弟・同姓の別人など）を避けるため「迷ったら別人」を徹底させる。
 *
 * @param digest 番号付きの人物一覧（1始まり。名前・別名・役割・性格などの短い要約）
 */
export function buildCharacterConsolidatePrompt(digest: string): string {
    return `次の登場人物リストは、小説本文から機械的に抽出したものです。明らかに同一人物を指している項目があれば、その番号をグループにまとめてください。

${dataBlock('登場人物リスト', digest)}

【判定方針】
- 呼称・役割・外見・背景の記述から同一人物だと確実に判断できる場合のみグループ化する
- 少しでも迷う場合は別人として扱う（グループに入れない）
- 名字が同じだけの人物（兄弟・親子など）は別人とみなす
- 人物の追加・削除・改変は行わない。番号のグループ化だけを行う

【出力形式】
次のJSONのみを出力してください。同一人物のグループが無ければ {"groups": []} とします。説明やコメントは不要。
{"groups": [[1, 3], [2, 5]]}`;
}
