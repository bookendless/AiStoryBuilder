/**
 * プロット関連プロンプトテンプレート
 */

export const PLOT_PROMPTS = {
  supplement: `以下の情報に基づいて、{fieldLabel}の内容を補完・改善してください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}

【現在の{fieldLabel}の内容】
{currentText}

【指示】
上記の内容を参考に、{fieldLabel}の内容を500文字以内で補完・改善してください。既存の内容がある場合は、それを活かしながら改善してください。JSON形式で出力してください：
{{
  "{fieldLabel}": "補完・改善された内容（500文字以内）"
}}`,

  consistency: `以下のプロット構成の一貫性をチェックしてください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【現在のプロット構成】
{structureText}

【指示】
上記のプロット構成について、以下の観点から一貫性をチェックしてください：
1. 各段階間の流れが自然か
2. 基礎設定（テーマ、舞台、目標、障害）との整合性
3. キャラクターの行動や動機の一貫性
4. 物語の論理的な展開

問題があれば具体的に指摘し、改善提案をしてください。JSON形式で出力してください：
{{
  "hasIssues": true/false,
  "issues": ["問題点1", "問題点2", ...],
  "suggestions": ["改善提案1", "改善提案2", ...]
}}`,

  generateStructure: `以下のプロジェクト情報に基づいて、{structureType}の物語構成を提案してください。ただし、単に作成するのではなく、Tree of Thoughts (ToT) の手法を用いて、3つの異なる展開案を出し、それぞれの「面白さ」「矛盾」「テーマとの整合性」を評価した上で、最良のプロットを統合・決定してください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
テーマ: {projectTheme}

【キャラクター情報】
{charactersInfo}

【プロット基礎設定（重要）】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
フック要素: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}
物語の結末: {ending}

{reversePrompting}

{structureDescription}

以下のJSON形式で出力してください：
{outputFormat}`,

  applyConsistency: `以下のプロジェクト情報と、プロット構成の一貫性チェックで指摘された改善提案に基づいて、現在のプロット構成を修正してください。

【プロジェクト情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {projectTheme}

【プロット基礎設定】
メインテーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【現在のプロット構成】
{structureText}

【改善提案】
{suggestionsText}

【指示】
上記の改善提案に従って、現在のプロット構成を修正し、より一貫性のある自然な展開にしてください。
現在の構成から大きく脱線しないようにしつつ、指摘された問題点を的確に解消して全体のバランスを整えてください。

{structureDescription}

以下のJSON形式で出力してください：
{outputFormat}`,
};
