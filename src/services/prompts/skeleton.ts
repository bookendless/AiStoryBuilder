/**
 * AIおまかせ骨組み生成（Phase B）のプロンプトビルダー
 *
 * 新規プロジェクトの説明文（物語の種）を起点に、plot1 の6項目と
 * 主要キャラクターのドラフトを生成する。いずれも parseJsonLoose で解析可能な
 * 厳密JSONを要求する（既存パネルの正規表現パースは使わない）。
 *
 * 推奨構成テンプレートは services/plotStructure の buildStructureInferencePrompt を流用するため
 * ここでは定義しない。
 */

import { SkeletonSeed, SkeletonPlot } from '../../types/skeleton';

/** 種情報の共通ブロック */
function buildSeedBlock(seed: SkeletonSeed): string {
    return `作品タイトル: ${seed.title}
物語の種（説明）: ${seed.description}
メインジャンル: ${seed.mainGenre || '未設定'}
サブジャンル: ${seed.subGenre || '未設定'}
ターゲット読者: ${seed.targetReader || '未設定'}
プロジェクトテーマ: ${seed.projectTheme || '未設定'}`;
}

/**
 * plot1 6項目を生成するプロンプト。
 * 「物語の種」を中心に膨らませ、厳密JSONのみを出力させる。
 */
export function buildPlotSkeletonPrompt(seed: SkeletonSeed): string {
    return `あなたは物語プロット生成の専門AIです。下記の「物語の種」を起点に、作品の骨組みとなる基本設定を考えてください。出力は指定のJSON形式のみとします。

【プロジェクト情報】
${buildSeedBlock(seed)}

【重要指示】以下のJSON形式以外は一切出力しないでください。説明文・コメント・マークダウンは不要です。

{
  "メインテーマ": "物語の核心となるメインテーマを100文字以内で",
  "舞台設定": "ジャンルに合った世界観を300文字以内で",
  "フック要素": "読者を引き込む魅力的なフックを300文字以内で",
  "主人公の目標": "主人公が達成したい目標を100文字以内で",
  "主要な障害": "主人公の目標を阻む主要な障害を100文字以内で",
  "物語の結末": "物語の結末を200文字以内で"
}

【ルール】
1. 上記JSON以外は出力しない
2. 「物語の種」の意図を尊重しつつ、矛盾なく具体化する
3. 各項目は指定文字数以内・日本語のみ
4. 改行文字や装飾は使わない`;
}

/**
 * 主要キャラクター2〜3人のドラフトを生成するプロンプト。
 * 生成済みの plot を文脈として渡し、厳密JSON配列を出力させる。
 */
export function buildCharacterSeedPrompt(seed: SkeletonSeed, plot: SkeletonPlot): string {
    return `あなたはキャラクター設定の専門AIです。下記の作品情報に合う主要キャラクターを2〜3人作成してください。出力は指定のJSON配列のみとします。

【作品情報】
${buildSeedBlock(seed)}

【プロット】
メインテーマ: ${plot.theme || '未設定'}
舞台設定: ${plot.setting || '未設定'}
フック要素: ${plot.hook || '未設定'}
主人公の目標: ${plot.protagonistGoal || '未設定'}
主要な障害: ${plot.mainObstacle || '未設定'}

【指示】
- 主人公を必ず含め、役割・年齢・性格が互いに区別できる2〜3人にする
- 各キャラクターは作品の世界観・テーマに馴染むものにする

【重要指示】以下のJSON配列以外は一切出力しないでください。説明文・コメント・マークダウンは不要です。

[
  {
    "name": "キャラクター名",
    "role": "基本設定（年齢・性別・役割など）",
    "appearance": "外見の詳細（2-3行）",
    "personality": "性格や行動原理（2-3行）",
    "background": "生い立ちや背景（2-3行）",
    "speechStyle": "口調・話し方（一人称・語尾・話し方の特徴・口癖など、1-2行）"
  }
]`;
}
