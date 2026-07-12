/**
 * リキャップ（前回までのあらすじ）プロンプトテンプレート
 *
 * 数日ぶりに執筆を再開する作者向けに、ナレーション調の「前回までのあらすじ」と
 * 執筆再開の提案をJSON形式で生成させる。読者向けではないためネタバレは制限しない。
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

export interface RecapPromptArgs {
    title: string;
    genre?: string;
    /** 章ダイジェスト（またはあらすじ）を連結したテキスト */
    digest: string;
    /** 執筆の中断地点の説明（ステップ・最終執筆章・次に書く章） */
    resumeInfo: string;
    /** 未回収の伏線の箇条書き（なければ「なし」） */
    openForeshadowings: string;
}

export function buildRecapPrompt(args: RecapPromptArgs): string {
    return `あなたは連載アニメのナレーターです。作者がしばらくぶりに自作の執筆を再開します。
以下の情報をもとに、物語の熱量を思い出させる「前回までのあらすじ」と、今日の執筆再開の提案を作成してください。

【作品情報】
タイトル: ${args.title}
ジャンル: ${args.genre || '未設定'}

${dataBlock('これまでの物語', args.digest)}

${dataBlock('執筆の中断地点', args.resumeInfo)}

${dataBlock('未回収の伏線', args.openForeshadowings)}

【narrative の要件】
- 「前回までのあらすじ——」という書き出しで始まる、連載アニメの冒頭ナレーション風の文章
- 250字前後
- 読者向けではなく作者向けなので、ネタバレを気にせず物語の現在地を鮮やかに思い出させる
- 物語の緊張感・感情の高まりが蘇る文体で書き、最後は中断地点（これから書く場面）への期待感で締める

【suggestions の要件】
- 「今日はここから書き始めては」という執筆再開の提案を1〜3個
- 中断地点や未回収の伏線を素材に、小さく始められる具体的な行動を提案する（例:「◯◯と△△の会話の続きから」）
- 各60字以内

${JSON_OUTPUT_RULES}

【出力形式】
{"narrative": "前回までのあらすじ——…", "suggestions": ["…", "…"]}`;
}
