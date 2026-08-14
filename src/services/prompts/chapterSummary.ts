/**
 * 章あらすじの再生成プロンプト
 *
 * 続編構成の buildChapterSummaryPrompt とは用途が異なるため別に持つ。
 * あちらは「続編制作のための分析素材」だが、ここで作るあらすじは
 * Chapter.summary として保存され、次章を書くときの直前章の文脈になる。
 * したがって「何が起きたか」より「次章の書き出しに要る状態」を優先して書かせる。
 */

import { dataBlock, textOnlyOutputRule } from './common';

export function buildChapterSummaryRefreshPrompt(title: string, body: string): string {
    return `あなたは日本語の小説創作を支援する編集者です。次の章の本文を読み、章のあらすじとしてまとめてください。

【章タイトル】${title}

${dataBlock('本文', body)}

【まとめ方】
- 実際に本文で起きた出来事だけを書く。本文にない展開・解釈・評価を足さない
- 章の終わりの時点で、登場人物がどこで何をしていて、何を知り、何を知らないままかが分かるようにする
- 張られた伏線・持ち越された問題があれば含める
- 200文字程度。次の章を書く人が読んで、そのまま書き出せる情報量にする

${textOnlyOutputRule('あらすじ')}`;
}
