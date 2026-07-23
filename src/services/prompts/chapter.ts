/**
 * 章立て関連プロンプトテンプレート
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * 章立てプロンプトのサニタイズ上限（文字数）。
 * 全章一覧・全キャラが指示より前に無制限で挿入されるため、既定の10000文字では末尾の
 * 出力形式（parseChapterList の契約）が黙って切り詰められ、章分割に失敗する。maxPromptLength に渡す。
 */
export const CHAPTER_PROMPT_CAP = 24000;

// 共通の出力形式テンプレート（parseChapterList が依存する契約。文言変更禁止）
const CHAPTER_OUTPUT_FORMAT = `【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: 出来事A、出来事B、出来事C
登場キャラクター: キャラクター名A、キャラクター名B

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: 出来事D、出来事E、出来事F
登場キャラクター: キャラクター名C、キャラクター名D

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること（「1.」「2.」などの番号リスト形式は使用しないこと）
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は読点（、）またはカンマ（,）区切りで3つ以上記述すること（番号リスト形式は禁止）
- 登場キャラクターは読点（、）またはカンマ（,）区切りで2つ以上記述すること（番号リスト形式は禁止）`;

// 共通の最重要指示テンプレート
const CHAPTER_CORE_INSTRUCTIONS = `**構成詳細の情報に最優先で従い、逸脱しない**
- 選択された物語構成（起承転結、三幕構成、四幕構成、ヒーローズ・ジャーニー、ビートシート、ミステリー・サスペンス構成など）の詳細に厳密に従う
- 各段階の役割と配置を正確に反映する`;

// 共通の章立て作成指針テンプレート
const CHAPTER_COMMON_INSTRUCTIONS = `- **メインジャンルに適した章構成**: メインジャンルの特徴を活かした章の配置とペースにし、ジャンル特有の構成パターンを考慮する
- **キャラクターの役割と性格を考慮**: 各キャラクターの個性を活かした章の内容にし、関係性の発展と役割に応じた登場タイミングを設計する
- **既存の章との整合性**: 既存の章構成と矛盾させず、物語の流れを自然で一貫性のある展開にする
- **章数と配置の最適化**: 構成詳細に基づいた適切な章数とし、各段階の比重に応じて章の長さを配分し、クライマックスを適切に配置する
- **登場キャラクターの提案**: 主要キャラクターを各章に適切に配置し、章の内容に必要であれば新しいキャラクターやサブキャラクターを追加提案する`;

export const CHAPTER_PROMPTS = {
  generateBasic: `あなたは小説の構成設計を専門とするプロの編集者です。以下のプロジェクト情報に基づいて、物語の章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}
作品テーマ: {projectTheme}
文体・トーン: {writingStyle}

${dataBlock('構成詳細（最重要・これに従う）', '{structureDetails}')}

${dataBlock('主要キャラクター', '{characters}')}

${dataBlock('既存の章', '{existingChapters}')}

【最重要指示】
${CHAPTER_CORE_INSTRUCTIONS}

【章立て作成の指針】
${CHAPTER_COMMON_INSTRUCTIONS}

${CHAPTER_OUTPUT_FORMAT}`,

  generateStructure: `あなたは小説の構成設計を専門とするプロの編集者です。以下のプロジェクト情報に基づいて、未完了の構成要素「{incompleteStructures}」に対応する章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}
作品テーマ: {projectTheme}
文体・トーン: {writingStyle}

${dataBlock('構成詳細（最重要・これに従う）', '{structureDetails}')}

${dataBlock('キャラクター情報', '{characters}')}

${dataBlock('既存章構成', '{existingChapters}')}

【未完了構成要素】
{incompleteStructures}

【最重要指示】
${CHAPTER_CORE_INSTRUCTIONS}

【未完了要素への焦点】
- 「{incompleteStructures}」の要素を重点的に補完する章立てにする
- 構成詳細に基づいた適切な配置にする

【章立て作成の指針】
${CHAPTER_COMMON_INSTRUCTIONS}

${CHAPTER_OUTPUT_FORMAT}`,

  // 章内容強化プロンプト
  enhanceChapter: `あなたは小説の構成と世界観設計のプロフェッショナルです。
以下の章内容を分析し、より豊かで具体的な内容に強化してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}

【対象の章】
章タイトル: {chapterTitle}
概要: {chapterSummary}
設定・場所: {chapterSetting}
雰囲気・ムード: {chapterMood}
重要な出来事: {chapterKeyEvents}
登場キャラクター: {chapterCharacters}

${dataBlock('キャラクター詳細', '{characterDetails}')}

${dataBlock('関連する伏線', '{relatedForeshadowings}')}

【指示】
以下の点を中心に、章全体を包括的に強化・具体化してください。
- 概要の表現を豊かにし、章の目的・展開をより具体的かつ魅力的に記述
- 設定・場所の具体的な描写、五感に訴える情景描写
- 重要な出来事の詳細化、シーン展開の提案
- ムードを強化する象徴的要素、伏線挿入ポイントの提案

【出力形式】
以下のJSON形式で出力してください：
{{
  "enhancedSummary": "強化された章の概要（200文字以内）",
  "enhancedSetting": "強化された設定・場所の描写（100文字程度）",
  "enhancedMood": "強化された雰囲気の表現（50文字程度）",
  "enhancedKeyEvents": [
    {{
      "original": "元の出来事",
      "enhanced": "詳細化された出来事（80文字程度）",
      "sceneHint": "シーン描写のヒント（50文字程度）"
    }}
  ],
  "atmosphereElements": [
    {{
      "element": "象徴的な要素（天候、小道具、色彩など）",
      "effect": "この要素がもたらす効果"
    }}
  ],
  "foreshadowingOpportunities": [
    {{
      "point": "伏線を仕込めるポイント",
      "suggestion": "伏線内容の提案"
    }}
  ],
  "splitRecommendation": {{
    "shouldSplit": true または false,
    "reason": "分割を推奨する理由（分割不要の場合は空文字）"
  }}
}}

${JSON_OUTPUT_RULES}`,

  // 章分割提案プロンプト
  suggestSplit: `あなたは小説の構成設計のエキスパートです。
以下の章内容を分析し、自然で効果的な分割方法を提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}

【対象の章】
章番号: 第{chapterNumber}章
章タイトル: {chapterTitle}
概要: {chapterSummary}
設定・場所: {chapterSetting}
雰囲気・ムード: {chapterMood}
重要な出来事: {chapterKeyEvents}
登場キャラクター: {chapterCharacters}

【分割の観点】
1. 時間経過の自然な区切り
2. 場所の移動
3. 視点の変化
4. 緊張感の高まりと解放
5. 物語の転換点

【指示】
この章を前半・後半（または複数）に分割する最適な方法を提案してください。
分割が不適切な場合は、その理由も説明してください。

【出力形式】
以下のJSON形式で出力してください：
{{
  "canSplit": true または false,
  "splitReason": "分割の理由または分割しない理由",
  "splitParts": [
    {{
      "partNumber": 1,
      "suggestedTitle": "前半の章タイトル案",
      "summary": "前半の概要（100文字程度）",
      "setting": "設定・場所",
      "mood": "雰囲気・ムード",
      "keyEvents": ["出来事1", "出来事2"],
      "characters": ["キャラクター名"],
      "transitionHint": "次の部分への自然な繋ぎ方のヒント"
    }},
    {{
      "partNumber": 2,
      "suggestedTitle": "後半の章タイトル案",
      "summary": "後半の概要（100文字程度）",
      "setting": "設定・場所",
      "mood": "雰囲気・ムード",
      "keyEvents": ["出来事3", "出来事4"],
      "characters": ["キャラクター名"],
      "transitionHint": "章末の余韻や次章への期待感"
    }}
  ],
  "splitBenefits": ["分割することのメリット"],
  "splitRisks": ["分割することの注意点"],
  "alternativeSuggestion": "分割以外の改善案（任意）"
}}

${JSON_OUTPUT_RULES}`,

  // 章の深掘り提案プロンプト
  deepenChapter: `あなたは小説の構成と展開のプロフェッショナルです。
以下の章内容を基点として、物語をより深く、豊かに展開させるための「次の章」の案を2つ提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}

【対象の章（基点）】
章タイトル: {chapterTitle}
概要: {chapterSummary}
設定・場所: {chapterSetting}
雰囲気・ムード: {chapterMood}
重要な出来事: {chapterKeyEvents}
登場キャラクター: {chapterCharacters}

${dataBlock('キャラクター詳細', '{characterDetails}')}

${dataBlock('関連する伏線', '{relatedForeshadowings}')}

【指示】
対象の章に続く、物語の深みを増すための「新しい章」の案を、異なる方向性で2つ作成してください。

案1（Option A）: 【内面・静的展開】
キャラクターの心理描写、関係性の深化、過去の掘り下げ、静かな緊張感などを重視した展開。
物語の「縦の深み」を作ることを目的とする。

案2（Option B）: 【外面・動的展開】
新たな事件の発生、環境の急激な変化、外部からの介入、アクションや葛藤の表面化などを重視した展開。
物語の「横の広がり」や「推進力」を作ることを目的とする。

【出力形式】
以下のJSON形式で出力してください：
{{
  "suggestions": [
    {{
      "type": "inner_depth",
      "title": "案1の章タイトル",
      "summary": "案1の概要（150文字程度）",
      "setting": "設定・場所",
      "mood": "雰囲気・ムード",
      "keyEvents": ["出来事1", "出来事2", "出来事3"],
      "characters": ["登場キャラクター名"],
      "reason": "この展開が推奨される理由と、物語にもたらす深みについての解説（100文字程度）"
    }},
    {{
      "type": "outer_progression",
      "title": "案2の章タイトル",
      "summary": "案2の概要（150文字程度）",
      "setting": "設定・場所",
      "mood": "雰囲気・ムード",
      "keyEvents": ["出来事1", "出来事2", "出来事3"],
      "characters": ["登場キャラクター名"],
      "reason": "この展開が推奨される理由と、物語にもたらす推進力についての解説（100文字程度）"
    }}
  ]
}}

${JSON_OUTPUT_RULES}`,
};
