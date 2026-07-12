/**
 * 平行世界ラボ（What-if分岐シミュレータ）プロンプトテンプレート
 *
 * 既存の物語に反実仮想（もし◯◯だったら）を適用し、後続章への波及を
 * 構造化レポート（JSONキー方式）で生成させる。
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

export interface WhatIfPromptArgs {
    title: string;
    genre?: string;
    factSheet: string;
    /** 分岐点までの物語ダイジェスト */
    digestBefore: string;
    /** 分岐点より後の章ダイジェスト（波及の対象。空の場合あり） */
    digestAfter: string;
    /** 分岐点の説明（章タイトル or 自由記述） */
    branchDescription: string;
    /** 「もし◯◯だったら」の前提 */
    premise: string;
    /** 未回収の伏線の箇条書き（なければ「なし」） */
    openForeshadowings: string;
    /** 関係性の箇条書き（なければ「なし」） */
    relationships: string;
}

export function buildWhatIfPrompt(args: WhatIfPromptArgs): string {
    return `あなたは物語構造の分析を得意とするストーリーコンサルタントです。作者が自作の展開に「もしも」の反実仮想を試したいと考えています。
以下の物語に前提の変更を適用し、その波及効果をシミュレートしてJSON形式でレポートしてください。本編を書き換えるのではなく、「こう変わるだろう」という分析レポートです。

【作品情報】
タイトル: ${args.title}
ジャンル: ${args.genre || '未設定'}

${dataBlock('設定台帳', args.factSheet)}

${dataBlock('分岐点までの物語', args.digestBefore)}

${dataBlock('分岐点より後の章（波及の対象）', args.digestAfter || '（分岐点より後の章はまだありません）')}

${dataBlock('未回収の伏線', args.openForeshadowings)}

${dataBlock('キャラクターの関係性', args.relationships)}

【分岐点】
${args.branchDescription}

【反実仮想の前提（もしも）】
${args.premise}

【レポートの要件】
- immediate: 前提が適用された直後、物語に何が起こるか（150字程度）
- chapterImpacts: 「分岐点より後の章」それぞれへの波及。chapterTitleは与えられた章タイトルを一字一句正確に使う。波及がほぼない章は省略してよい。impactは100字程度、severityは major（章の存在意義が変わる）/ moderate（展開の修正が必要）/ minor（微調整で済む）
- brokenForeshadowings: この分岐で回収不能・無意味になる伏線（なければ空配列）
- relationshipChanges: この分岐で変わるキャラクター間の関係性（なければ空配列）
- newPossibilities: この分岐から新たに生まれる展開の可能性を2〜3個（各80字程度、作者の創作意欲を刺激する具体性で）
- verdict: 総評（150字程度）。この分岐は本編より面白くなり得るか、部分的に取り込む価値はあるか、率直に評価する

${JSON_OUTPUT_RULES}

【出力形式】
{
  "immediate": "…",
  "chapterImpacts": [
    {"chapterTitle": "章タイトル（正確に）", "impact": "…", "severity": "major | moderate | minor のいずれか"}
  ],
  "brokenForeshadowings": ["…"],
  "relationshipChanges": ["…"],
  "newPossibilities": ["…"],
  "verdict": "…"
}`;
}
