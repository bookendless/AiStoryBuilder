/**
 * 伏線関連プロンプトテンプレート
 */

export const FORESHADOWING_PROMPTS = {
  suggest: `あなたは物語構成のプロフェッショナルです。以下のプロジェクト情報を分析し、効果的な伏線を提案してください。

【プロジェクト基本情報】
タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
テーマ: {theme}

【プロット情報】
テーマ: {plotTheme}
舞台設定: {plotSetting}
フック要素: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【物語構造】
{structureInfo}

【キャラクター情報】
{characters}

【章立て】
{chapters}

【あらすじ】
{synopsis}

【既存の伏線】
{existingForeshadowings}

【指示】
上記の情報を総合的に分析し、物語をより深く魅力的にする伏線を3〜5個提案してください。
各伏線には以下の情報を含めてください：

【提案の観点】
1. キャラクターの秘密や過去に関する伏線
2. プロットの展開を予感させる伏線
3. 世界観や設定に関するミステリアスな伏線
4. 人間関係の変化を示唆する伏線
5. テーマを深める象徴的な伏線

以下のJSON形式で出力してください：
{{
  "suggestions": [
    {{
      "title": "伏線のタイトル",
      "description": "伏線の説明と意図（100文字程度）",
      "category": "以下から選択: character, plot, world, mystery, relationship, other",
      "importance": "以下から選択: high, medium, low",
      "plantChapter": "設置推奨章（例：第1章）",
      "plantDescription": "設置時の具体的な描写案（50文字程度）",
      "payoffChapter": "回収推奨章（例：第5章）",
      "payoffDescription": "回収方法の提案（50文字程度）",
      "relatedCharacters": ["関連キャラクター名"],
      "effect": "この伏線が物語にもたらす効果（50文字程度）"
    }}
  ]
}}`,

  checkConsistency: `あなたは厳格な編集者として、以下の伏線の整合性をチェックしてください。

【プロジェクト基本情報】
タイトル: {title}
メインジャンル: {mainGenre}

【プロット情報】
テーマ: {plotTheme}
舞台設定: {plotSetting}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【物語構造】
{structureInfo}

【キャラクター情報】
{characters}

【章立て】
{chapters}

【伏線一覧】
{foreshadowings}

【チェック観点】
1. **未回収の伏線**: 設置されたが回収されていない伏線はないか？
2. **矛盾する伏線**: 互いに矛盾する伏線や、設定と矛盾する伏線はないか？
3. **唐突な回収**: 十分な準備なく回収されている伏線はないか？
4. **バランス**: 伏線の重要度や配置のバランスは適切か？
5. **キャラクター整合性**: キャラクターの行動や性格と矛盾する伏線はないか？

以下のJSON形式で出力してください：
{{
  "overallScore": 0-100の整数（整合性スコア）,
  "summary": "全体的な評価と改善の方向性（150文字程度）",
  "unresolvedIssues": [
    {{
      "foreshadowingTitle": "伏線タイトル",
      "issue": "問題の内容",
      "severity": "以下から選択: high, medium, low",
      "suggestion": "改善提案"
    }}
  ],
  "contradictions": [
    {{
      "items": ["矛盾する伏線1", "矛盾する伏線2"],
      "description": "矛盾の内容",
      "resolution": "解決案"
    }}
  ],
  "balanceIssues": [
    {{
      "issue": "バランスの問題",
      "suggestion": "改善提案"
    }}
  ],
  "strengths": ["良い点1", "良い点2"]
}}`,

  suggestPayoff: `あなたは物語構成のエキスパートです。以下の伏線について、最適な回収タイミングと方法を提案してください。

【プロジェクト基本情報】
タイトル: {title}
メインジャンル: {mainGenre}

【対象の伏線】
タイトル: {foreshadowingTitle}
説明: {foreshadowingDescription}
カテゴリ: {foreshadowingCategory}
重要度: {foreshadowingImportance}
現在のポイント: {currentPoints}

【関連キャラクター】
{relatedCharacters}

【章立て】
{chapters}

【物語構造】
{structureInfo}

【他の伏線との関係】
{otherForeshadowings}

【指示】
この伏線を最も効果的に回収するためのタイミングと方法を提案してください。

以下のJSON形式で出力してください：
{{
  "recommendedChapter": "推奨する回収章",
  "timing": "物語内でのベストタイミング（例：クライマックス前、主人公の成長後）",
  "payoffMethods": [
    {{
      "method": "回収方法の案",
      "description": "具体的な描写案（100文字程度）",
      "impact": "この回収方法が与えるインパクト",
      "prerequisites": ["この回収に必要な前提条件"]
    }}
  ],
  "hintsBeforePayoff": [
    {{
      "chapter": "ヒントを入れる章",
      "hint": "ヒントの内容（50文字程度）"
    }}
  ],
  "avoidTiming": ["避けるべきタイミングとその理由"]
}}`,

  enhance: `あなたは物語構成のプロフェッショナルです。以下の伏線をより効果的にするための改善案を提案してください。

【プロジェクト基本情報】
タイトル: {title}
メインジャンル: {mainGenre}
テーマ: {theme}

【対象の伏線】
タイトル: {foreshadowingTitle}
説明: {foreshadowingDescription}
カテゴリ: {foreshadowingCategory}
重要度: {foreshadowingImportance}
現在のステータス: {foreshadowingStatus}
現在のポイント: {currentPoints}
計画中の回収: {plannedPayoff}

【関連キャラクター】
{relatedCharacters}

【物語のテーマとの関連】
{themeConnection}

【指示】
この伏線をより効果的にするための改善案を提案してください。

以下のJSON形式で出力してください：
{{
  "enhancedDescription": "改善された伏線の説明（現在の説明を発展させたもの）",
  "additionalLayers": [
    {{
      "layer": "追加できる層や深み",
      "description": "具体的な内容",
      "effect": "物語への効果"
    }}
  ],
  "connectionOpportunities": [
    {{
      "target": "接続先（キャラクター、他の伏線、テーマなど）",
      "connection": "接続方法",
      "benefit": "接続によるメリット"
    }}
  ],
  "strengthenMethods": [
    {{
      "current": "現在の状態",
      "improved": "改善案",
      "reason": "改善理由"
    }}
  ],
  "warnings": ["注意すべき点"]
}}`
};
