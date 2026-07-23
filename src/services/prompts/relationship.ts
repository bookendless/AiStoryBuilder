/**
 * キャラクター相関図関連プロンプト
 */

import { dataBlock, JSON_OUTPUT_RULES } from './common';

/**
 * 相関図プロンプトのサニタイズ上限（文字数）。
 * projectContext（あらすじ＋プロット＋全キャラ＋全章＋タイムライン＋既存の関係性）を
 * 先頭に置く構造上、既定の10000文字では【出力形式】等の末尾指示が黙って切り詰められ、
 * JSON抽出失敗や無関係な数値の混入を招く。generateContent の maxPromptLength に渡して引き上げる。
 */
export const RELATIONSHIP_PROMPT_CAP = 24000;

// 関係性の種類と強度の共通定義
const RELATIONSHIP_TYPE_RULES = `- 関係性の種類は以下のいずれかから選択：
  - friend: 友人関係（信頼できる仲間、協力関係）
  - enemy: 敵対関係（対立、憎悪、競争）
  - family: 家族関係（血縁、養子縁組など）
  - romantic: 恋愛関係（恋愛感情、片思い含む）
  - mentor: 師弟関係（師匠と弟子、指導者と被指導者）
  - rival: ライバル関係（競争相手、好敵手）
  - other: その他（上記に当てはまらない特殊な関係）
- 関係の強度は1-5で評価（1: 非常に弱い、3: 普通、5: 非常に強い）`;

// 登録済みキャラクター限定ガード（AIの人物名創作対策として必須）
const registeredCharactersGuard = (characterNames: string): string =>
  `【最重要】登録済みキャラクターのみを使用する
登録済みのキャラクター名リスト: ${characterNames}
fromName / toName には上記リストに含まれているキャラクター名のみを一字一句そのまま使用してください。リストにない名前を使った関係性は無効となります。`;

/** 登録済みキャラクターからの関係性自動推論プロンプト */
export function buildRelationshipInferPrompt(projectContext: string, characterNames: string): string {
  return `あなたは物語のキャラクター関係性を分析する編集者です。以下のプロジェクト情報から、キャラクター間の関係性を推論してください。

${dataBlock('プロジェクト情報', projectContext)}

${registeredCharactersGuard(characterNames)}

【分析のポイント】
1. **キャラクター設定の分析**: 役割（主人公、敵役、相棒など）から関係性の方向性を、性格の相性（補完・対立）と背景ストーリーから過去の関係性を推測する
2. **章情報の活用**: 同じ章や重要な出来事で共に関わるキャラクター間の関係性を重視し、章の流れから関係性の発展を推測する
3. **タイムラインの活用**: 同じ出来事に関わるキャラクター間の関係性と、時系列での変化を考慮する
4. **プロット設定の反映**: 主人公の目標と主要な障害から敵対・協力関係を推測し、物語のテーマに沿った関係性を優先する

【推論の基準】
- 既存の関係性は除外する
${RELATIONSHIP_TYPE_RULES}
- 説明は100文字以上200文字程度で、具体的な根拠を含める
- 呼び方（fromCallsTo/toCallsFrom）は、関係の種類・強度・役割・年齢差・親密度から自然な呼称を推測する（例: 家族なら「お兄ちゃん」、敵対なら苗字や蔑称、恋愛なら下の名前呼び捨てなど）。判断できない場合は空文字のままでよい

【出力形式】
以下のJSON配列形式で出力してください。関係性が見つからない場合は空配列[]を返してください：
[
  {
    "fromName": "起点キャラクター名（登録済みリストから正確に）",
    "toName": "相手キャラクター名（登録済みリストから正確に）",
    "type": "friend|enemy|family|romantic|mentor|rival|other",
    "strength": 1-5,
    "description": "関係性の説明（100-200文字、根拠を含む）",
    "notes": "備考（任意）",
    "fromCallsTo": "起点キャラクターが相手をどう呼ぶか（任意、例: 「花子さん」）",
    "toCallsFrom": "相手が起点キャラクターをどう呼ぶか（任意、例: 「兄貴」）"
  },
  ...
]

${JSON_OUTPUT_RULES}
- マークダウン記法（見出し、リスト、強調など）は使用しない`;
}

/** 物語に追加すべき新規関係性の提案プロンプト */
export function buildRelationshipSuggestPrompt(projectContext: string, characterNames: string): string {
  return `あなたは物語のキャラクター関係性を設計する編集者です。以下のプロジェクト情報を参考に、物語に追加すべき重要な関係性を提案してください。

${dataBlock('プロジェクト情報', projectContext)}

${registeredCharactersGuard(characterNames)}

【提案の観点】
1. **物語の展開に必要な関係性**: プロットの流れを促進し、対立や協力を生み、テーマを深める関係性
2. **キャラクターの成長を促す関係性**: 主人公の成長に影響を与え、キャラクターの変化や新たな側面を引き出す関係性
3. **章の展開を豊かにする関係性**: 同じ章や重要な出来事を通じて生まれ、物語の緊張感を高める関係性
4. **既存関係性とのバランス**: 既存の関係性を補完し、孤立したキャラクターを減らし、物語の複雑さを適切に保つ関係性

【提案の基準】
- 既存の関係性は除外する
${RELATIONSHIP_TYPE_RULES}
- 説明は100文字以上200文字程度で、なぜこの関係性が物語に必要かを具体的に説明する
- 備考には、この関係性がどの章や場面で重要になるかを記述する（任意）
- 呼び方（fromCallsTo/toCallsFrom）は、関係の種類・強度・役割・年齢差・親密度から自然な呼称を提案する。判断できない場合は空文字のままでよい

【出力形式】
以下のJSON配列形式で出力してください。提案がない場合は空配列[]を返してください：
[
  {
    "fromName": "起点キャラクター名（登録済みリストから正確に）",
    "toName": "相手キャラクター名（登録済みリストから正確に）",
    "type": "friend|enemy|family|romantic|mentor|rival|other",
    "strength": 1-5,
    "description": "関係性の説明（100-200文字、物語への重要性を含む）",
    "notes": "備考（どの章や場面で重要か、任意）",
    "fromCallsTo": "起点キャラクターが相手をどう呼ぶか（任意）",
    "toCallsFrom": "相手が起点キャラクターをどう呼ぶか（任意）"
  },
  ...
]

${JSON_OUTPUT_RULES}
- マークダウン記法（見出し、リスト、強調など）は使用しない`;
}

/** 登録済み関係性の整合性チェックプロンプト */
export function buildRelationshipConsistencyCheckPrompt(projectContext: string, relationshipsText: string): string {
  return `あなたは物語の整合性チェックを専門とする編集者です。以下の関係性について、整合性をチェックしてください。

${dataBlock('プロジェクト情報', projectContext)}

${dataBlock('現在の関係性', relationshipsText)}

【チェック項目】
1. 矛盾する関係性がないか（例：敵対関係と恋愛関係の矛盾）
2. 関係性の強度と説明の整合性
3. 孤立したキャラクターがないか
4. 双方向の関係性が適切か
5. プロット設定との整合性
6. 呼び方（fromCallsTo/toCallsFrom）が関係の種類・強度・親密度と矛盾していないか（例：敵対関係なのに親密な呼び方、家族なのに他人行儀な呼び方など）

問題があれば具体的に指摘し、改善提案をしてください。

【出力形式】
以下のJSON形式で出力してください：
{
  "hasIssues": true/false,
  "issues": ["問題点1", "問題点2", ...],
  "suggestions": ["改善提案1", "改善提案2", ...],
  "isolatedCharacters": ["孤立しているキャラクター名1", ...]
}

${JSON_OUTPUT_RULES}`;
}

/** 1組の関係性についての説明文自動生成プロンプト */
export function buildRelationshipDescriptionPrompt(
  projectContext: string,
  fromName: string,
  fromRole: string,
  toName: string,
  toRole: string,
  typeLabel: string,
  strength: number
): string {
  return `あなたは物語のキャラクター関係性を設計する編集者です。以下の関係性について、プロジェクトの世界観に合わせた説明文を生成してください。

${dataBlock('プロジェクト情報', projectContext)}

【対象の関係性】
起点キャラクター: ${fromName} (${fromRole})
相手キャラクター: ${toName} (${toRole})
関係の種類: ${typeLabel}
関係の強度: ${strength}/5

【指示】
1. プロジェクトの世界観や設定に合わせた説明文を生成する
2. 説明文は100文字以上200文字程度で、具体的で分かりやすい内容にする
3. 関係の種類や強度が未設定の場合は提案する
4. 備考も提案する（任意）
5. 呼び方（fromCallsTo/toCallsFrom）も、関係の種類・強度・役割・親密度から自然な呼称を提案する（任意）

【出力形式】
以下のJSON形式で出力してください：
{
  "description": "説明文",
  "type": "friend|enemy|family|romantic|mentor|rival|other",
  "strength": 1-5,
  "notes": "備考（任意）",
  "fromCallsTo": "起点キャラクターが相手をどう呼ぶか（任意）",
  "toCallsFrom": "相手が起点キャラクターをどう呼ぶか（任意）"
}

${JSON_OUTPUT_RULES}`;
}
