/**
 * プロット関連プロンプトテンプレート
 */

import { dataBlock, JSON_OUTPUT_RULES, textOnlyOutputRule } from './common';

export const PLOT_PROMPTS = {
  supplement: `あなたは物語のプロット設計を専門とするプロの編集者です。以下の情報に基づいて、{fieldLabel}の内容を補完・改善してください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}

${dataBlock('現在の{fieldLabel}の内容', '{currentText}')}

【指示】
上記の内容を参考に、{fieldLabel}の内容を500文字以内で補完・改善してください。既存の内容がある場合は、それを活かしながら改善してください。

【出力形式】
以下のJSON形式で出力してください：
{{
  "{fieldLabel}": "補完・改善された内容（500文字以内）"
}}

${JSON_OUTPUT_RULES}`,

  consistency: `あなたは物語の整合性チェックを専門とするプロの編集者です。以下のプロット構成の一貫性をチェックしてください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

${dataBlock('現在のプロット構成', '{structureText}')}

【指示】
上記のプロット構成について、以下の観点から一貫性をチェックしてください：
1. 各段階間の流れが自然か
2. 基礎設定（テーマ、舞台、目標、障害）との整合性
3. キャラクターの行動や動機の一貫性
4. 物語の論理的な展開

問題があれば具体的に指摘し、改善提案をしてください。

【出力形式】
以下のJSON形式で出力してください：
{{
  "hasIssues": true/false,
  "issues": ["問題点1", "問題点2", ...],
  "suggestions": ["改善提案1", "改善提案2", ...]
}}

${JSON_OUTPUT_RULES}`,

  generateStructure: `あなたは物語のプロット設計を専門とするプロの編集者です。以下のプロジェクト情報に基づいて、{structureType}の物語構成を提案してください。ただし、単に作成するのではなく、Tree of Thoughts (ToT) の手法を用いて、内部で3つの異なる展開案を出し、それぞれの「面白さ」「矛盾」「テーマとの整合性」を評価した上で、最良のプロットを統合・決定してください。検討過程は出力せず、最終的な構成のみを出力します。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
テーマ: {projectTheme}

${dataBlock('キャラクター情報', '{charactersInfo}')}

【プロット基礎設定（重要）】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
フック要素: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}
物語の結末: {ending}

{reversePrompting}

{structureDescription}

【出力形式】
以下のJSON形式で出力してください：
{outputFormat}`,

  applyConsistency: `あなたは物語のプロット設計を専門とするプロの編集者です。以下のプロジェクト情報と、プロット構成の一貫性チェックで指摘された改善提案に基づいて、現在のプロット構成を修正してください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

${dataBlock('現在のプロット構成', '{structureText}')}

${dataBlock('改善提案', '{suggestionsText}')}

【指示】
上記の改善提案に従って、現在のプロット構成を修正し、より一貫性のある自然な展開にしてください。
現在の構成から大きく脱線しないようにしつつ、指摘された問題点を的確に解消して全体のバランスを整えてください。

{structureDescription}

【出力形式】
以下のJSON形式で出力してください：
{outputFormat}`,
};

/** プロット基本設定（メインテーマ・舞台設定など6項目）の一括生成プロンプト */
export function buildPlotBasicSettingsPrompt(
  context: {
    title: string;
    description?: string;
    mainGenre?: string;
    genre?: string;
    subGenre?: string;
    targetReader: string;
    projectTheme: string;
  },
  charactersInfo: string,
  synopsisInfo: string
): string {
  return `あなたは物語プロット生成の専門AIです。以下のプロジェクト情報に基づいて、プロット基本設定6項目を作成し、指定されたJSON形式のみで出力してください。

【プロジェクト情報】
作品タイトル: ${context.title}
作品説明: ${context.description || '説明未設定'}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
ターゲット読者: ${context.targetReader}
プロジェクトテーマ: ${context.projectTheme}

${dataBlock('キャラクター情報', charactersInfo)}
${synopsisInfo}

【作成の指針】
- 作品のジャンル・テーマ・キャラクター設定と矛盾しない、一貫したプロットにする
- 各項目は日本語のみで、指定された文字数以内で記述する
- 各項目の値の中で改行文字や装飾は使用しない

【出力形式】
以下のJSON形式で出力してください（項目名は一字一句この通りに）：
{
  "メインテーマ": "ここに物語の核心となるメインテーマを100文字以内で記述",
  "舞台設定": "ここにジャンルに合わせた世界観を表現して300文字以内で記述",
  "フック要素": "ここに魅力的なフック要素を300文字以内で記述",
  "主人公の目標": "ここに主人公が達成したい目標を100文字以内で記述",
  "主要な障害": "ここに主人公の目標を阻む主要な障害を100文字以内で記述",
  "物語の結末": "ここに物語の結末を200文字以内で記述"
}

【出力例】
{
  "メインテーマ": "友情と成長をテーマにした青春物語",
  "舞台設定": "現代の高校を舞台に、主人公の日常と非日常が交錯する世界観",
  "フック要素": "謎の転校生との出会いが引き起こす予想外の展開",
  "主人公の目標": "転校生の正体を突き止め、クラスメイトとの友情を深める",
  "主要な障害": "転校生の秘密と、クラス内の対立関係",
  "物語の結末": "主人公と転校生が和解し、クラス全体が団結して新しい関係を築く"
}

${JSON_OUTPUT_RULES}`;
}

/** プロット基本設定の項目単位（フィールド単位）の提案プロンプト */
export function buildPlotFieldSuggestPrompt(
  context: {
    title: string;
    description?: string;
    mainGenre?: string;
    genre?: string;
    subGenre?: string;
    targetReader: string;
    projectTheme: string;
  },
  charactersInfo: string,
  existingContext: string,
  synopsisInfo: string,
  config: { label: string; description: string; maxLength: number }
): string {
  return `あなたは物語プロット生成の専門AIです。以下のプロジェクト情報に基づいて、指定された項目の内容を作成してください。

【プロジェクト情報】
作品タイトル: ${context.title}
作品説明: ${context.description || '説明未設定'}
メインジャンル: ${context.mainGenre || context.genre}
サブジャンル: ${context.subGenre || '未設定'}
ターゲット読者: ${context.targetReader}
プロジェクトテーマ: ${context.projectTheme}

${dataBlock('キャラクター情報', charactersInfo)}

${existingContext ? `【既存の設定】
${existingContext}

` : ''}${synopsisInfo}

【生成する項目】
${config.label}: ${config.description}を${config.maxLength}文字以内で記述してください。

【作成の指針】
- 既存の設定・キャラクター設定と一貫性のある内容にする
- 日本語のみで、${config.maxLength}文字以内で記述する

【出力例】
${config.label === 'メインテーマ' ? '友情と成長をテーマにした青春物語' :
          config.label === '舞台設定' ? '現代の高校を舞台に、主人公の日常と非日常が交錯する世界観' :
            config.label === '物語の引き（冒頭の魅力）' ? '謎の転校生との出会いが引き起こす予想外の展開' :
              config.label === '主人公の目標' ? '転校生の正体を突き止め、クラスメイトとの友情を深める' :
                '転校生の秘密と、クラス内の対立関係'}

${textOnlyOutputRule(`${config.label}の内容`)}`;
}
