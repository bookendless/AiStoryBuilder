import { AIRequest, AIResponse, AIProvider } from '../types/ai';
import { retryApiCall, getUserFriendlyErrorMessage } from '../utils/apiUtils';
import { parseAIResponse, validateResponse } from '../utils/aiResponseParser';
import { decryptApiKey, sanitizeInput } from '../utils/securityUtils';
import { httpService } from './httpService';

// AI プロバイダーの定義
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI GPT',
    requiresApiKey: true,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '最新の高性能マルチモーダルモデル（推奨）',
        maxTokens: 128000,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '軽量で高速なマルチモーダルモデル',
        maxTokens: 128000,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: '高性能なモデル',
        maxTokens: 128000,
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: '従来の高性能モデル',
        maxTokens: 8192,
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: '高速で効率的',
        maxTokens: 4096,
      },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    requiresApiKey: true,
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: '最新の高性能モデル（推奨）',
        maxTokens: 200000,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: '高速で効率的なモデル',
        maxTokens: 200000,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: '最高性能のモデル',
        maxTokens: 200000,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'バランスの取れたモデル',
        maxTokens: 200000,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: '軽量で高速なモデル',
        maxTokens: 200000,
      },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    requiresApiKey: true,
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: '最新の高性能モデル（推奨）',
        maxTokens: 2000000,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: '高速で効率的なモデル',
        maxTokens: 1000000,
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: '軽量で高速なモデル',
        maxTokens: 1000000,
      },
      {
        id: 'gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash',
        description: '次世代高速モデル',
        maxTokens: 1000000,
      },
      {
        id: 'gemini-2.0-flash-lite-001',
        name: 'Gemini 2.0 Flash Lite',
        description: '次世代軽量モデル',
        maxTokens: 1000000,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '従来の高性能モデル',
        maxTokens: 2000000,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: '従来の高速モデル',
        maxTokens: 1000000,
      },
    ],
  },
  {
    id: 'local',
    name: 'ローカルLLM',
    requiresApiKey: false,
    isLocal: true,
    models: [
      {
        id: 'local-model',
        name: 'ローカルモデル',
        description: 'LM Studio / Ollama 等',
        maxTokens: 32768,
      },
    ],
  },
];

// システムプロンプト（全プロバイダー共通）
export const SYSTEM_PROMPT = `あなたは日本語の小説創作を専門とするプロフェッショナルな
編集者・作家アシスタントです。

【あなたの役割】
- 作家の創作意図を深く理解し、物語の魅力を最大化する
- 読者を引き込む自然で美しい日本語を生成する
- キャラクターの一貫性、プロットの整合性を常に意識する
- 具体的で実用的な提案を行う

【出力品質基準】
1. **自然な日本語**: 会話は自然で、地の文は情景が浮かぶ描写
2. **感情の深み**: キャラクターの内面や心情を丁寧に描写
3. **五感の活用**: 視覚だけでなく、聴覚・触覚・嗅覚・味覚も活用
4. **リズムとテンポ**: 文章の長短を調整し、読みやすいリズム
5. **一貫性**: 既存設定・世界観・キャラクター性格と矛盾しない

【禁止事項】
- 陳腐な表現や使い古された比喩の多用
- 説明的すぎる文章（Show, don't tell の原則）
- キャラクターの性格と矛盾する言動
- 不自然な日本語や直訳調の表現

常に読者の没入感を高めることを最優先に考えてください。`;

// プロンプトテンプレート
interface PromptTemplates {
  [key: string]: {
    [subType: string]: string;
  };
}

const PROMPTS: PromptTemplates = {
  character: {
    enhance: `以下のキャラクター情報を簡潔に補完してください。

【プロジェクト情報】
作品タイトル: {title}
作品テーマ: {theme}

【プロット情報】
メインテーマ（詳細）: {plotTheme}
舞台設定: {plotSetting}
フック要素: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【キャラクター情報】
キャラクター名: {name}
役割: {role}
現在の外見: {appearance}
現在の性格: {personality}
現在の背景: {background}

{imageAnalysis}

以下の形式で具体的に回答してください（各項目は2-3行程度）：
【外見の詳細】
（具体的な外見特徴）

【性格の詳細】
（主要な性格特徴）

【背景の補完】
（出身や過去の経験）`,

    create: `以下の条件に基づいて、魅力的で多様なキャラクターを3〜5人作成してください。

まず、以下のFew-Shot例を参考に、望ましい出力形式と詳細レベルを理解してください。

---

【Few-Shot例1：ファンタジー作品】

【入力例】
作品タイトル: 星降る夜の約束
作品テーマ: 運命と選択
作品内容・概要: 魔法学院を舞台に、星の力を持つ若者たちが運命に立ち向かう物語
メインジャンル: ファンタジー
サブジャンル: 学園
ターゲット読者: 20代

【出力例】
【キャラクター1】
名前: 御影 蒼真（みかげ そうま）
基本設定: 19歳、男性、魔法学院の2年生
外見: 黒髪で長めの前髪が片目を隠している。身長175cm、やせ型で繊細な印象。常に古びたペンダントを身につけている。
性格: 物静かで思慮深い。他者との距離を保つが、信頼した相手には深い優しさを見せる。責任感が強く、自分を犠牲にしてでも約束を守ろうとする。
背景: 幼少期に両親を星の災厄で失い、祖父に育てられた。星魔法の才能を持つが、その力に内在する危険性を恐れている。

【キャラクター2】
名前: リリィ・ステラ
基本設定: 17歳、女性、魔法学院の1年生
外見: 金色の巻き髪と碧眼。小柄（155cm）で活発な印象。星の刺繍が入った青いマントがトレードマーク。
性格: 明るく社交的で、好奇心旺盛。蒼真とは対照的に、困難に対して前向きに立ち向かう。時に無謀な行動で周囲を驚かせる。
背景: 星術師の名家出身だが、家の期待に縛られることを嫌う。自分の力で道を切り開きたいと学院に入学した。

---

【Few-Shot例2：現代もの作品】

【入力例】
作品タイトル: 雨上がりの交差点
作品テーマ: 再出発と成長
作品内容・概要: 転職を機に新しい街で出会った人々との交流を通じて成長する物語
メインジャンル: 現代
サブジャンル: ヒューマンドラマ
ターゲット読者: 30代

【出力例】
【キャラクター1】
名前: 佐藤 健太（さとう けんた）
基本設定: 32歳、男性、IT企業の営業マン（転職後）
外見: 中肉中背（172cm）、短髪で清潔感がある。転職を機に眼鏡を外し、印象が明るくなった。いつもスーツにネクタイを緩めたスタイル。
性格: 真面目で誠実だが、新しい環境に適応しようと努力している。過去の失敗を引きずりがちだが、前向きに変わりたいと思っている。
背景: 前職で大きな失敗をし、転職を決意。新しい街で一人暮らしを始めたばかり。人との距離感がうまく取れず、孤独を感じることが多い。

【キャラクター2】
名前: 山田 美咲（やまだ みさき）
基本設定: 28歳、女性、カフェの店長
外見: 肩まで届く茶髪、笑顔が印象的。エプロン姿が似合う、親しみやすい雰囲気。身長160cm、健康的な体型。
性格: 明るく社交的で、誰とでも打ち解けられる。困っている人を見過ごせない優しさを持つ。時には厳しいことも言うが、それは相手を思ってのこと。
背景: 地元で育ち、大学卒業後は地元のカフェで働き、5年前に店長に就任。地域の人々とのつながりを大切にしている。

---

【実際のタスク】

作品タイトル: {title}
作品テーマ: {theme}
作品内容・概要: {description}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}

【プロット詳細情報】
メインテーマ（詳細）: {plotTheme}
舞台設定: {plotSetting}
フック要素: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【重要】作品のタイトル、テーマ、内容、およびプロット詳細情報に合ったキャラクター設定を心がけてください：
- 作品タイトルから物語の方向性や雰囲気を読み取り、それに適したキャラクターを設定
- 作品内容・概要から具体的な物語の流れや設定を把握し、それに馴染むキャラクターを設定
- テーマに沿ったキャラクターの動機や目標を考慮
- 作品の世界観や設定に馴染むキャラクター背景を設定
- プロット詳細情報（舞台設定、フック、目標、障害）を反映し、物語の中で役割を果たせるキャラクターにすること

【重要】ターゲット読者層に適したキャラクター設定を心がけてください：
- 10代読者向け：同世代または少し年上のキャラクター（高校生〜大学生程度）
- 20代読者向け：同世代のキャラクター（大学生〜社会人）
- 30代以上読者向け：様々な年齢層のキャラクター（20代〜40代）
- 全年齢向け：親しみやすい年齢設定（中学生〜30代）

【キャラクター多様性の確保】
以下の点に注意して、3〜5人のキャラクターを互いに区別しやすくしてください：
- 年齢を異なる設定にする（例：16歳、18歳、20歳）
- 性格を対照的にする（例：明るい、内向的、冷静）
- 外見特徴を明確に区別する（髪色、身長、体型など）
- 役割や立場を多様にする（主人公、ライバル、サポーターなど）

上記のFew-Shot例を参考に、以下の形式で3〜5人のキャラクターを回答してください：

【キャラクター1】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）

【キャラクター2】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）

【キャラクター3】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）



特に、作品タイトル、テーマ、内容を基に、メインジャンルとサブジャンルの特徴を活かし、ターゲット読者層に親近感を持ってもらえる、かつ互いに区別しやすいキャラクター設定を心がけてください。Few-Shot例と同レベルの詳細さと具体性で記述してください。`,
  },

  plot: {
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

    generateStructure: `以下のプロジェクト情報に基づいて、{structureType}の物語構成を提案してください。

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
{ending}

{reversePrompting}

{structureDescription}

以下のJSON形式で出力してください：
{outputFormat}`,

    setting: `以下のテーマに基づいて、魅力的な舞台・世界観を提案してください。

テーマ: {theme}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}

以下の観点から詳細な舞台設定を提案してください：

【時代・時期】
（現代、近未来、過去、異世界など）

【場所・地理】
（都市、田舎、学校、職場、異世界など）

【社会背景】
（政治体制、文化、技術レベル、社会問題など）

【独特な要素】
（魔法、SF技術、特殊なルール、文化的特徴など）

【雰囲気・トーン】
（明るい、暗い、ミステリアス、ロマンチックなど）

特に、メインジャンルを基調とし、サブジャンルの要素を組み合わせた独特な世界観を構築してください。`,

    structure: `以下の設定に基づいて、起承転結の物語構造を提案してください。

テーマ: {theme}
舞台: {setting}
主要キャラクター: {characters}

以下の形式で回答してください：
【起】導入部
（状況設定、キャラクター紹介、日常の描写）

【承】発展部
（問題の発生、複雑化、キャラクターの成長）

【転】転換部
（クライマックス、大きな変化、対立の頂点）

【結】結末部
（解決、結論、キャラクターの変化）`,

    hook: `読者を引き込む魅力的な「フック」要素を提案してください。

テーマ: {theme}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {target}

以下の観点から提案してください：
・冒頭の引きつけ方
・謎や疑問の設定
・キャラクターの魅力
・独特な設定や世界観

特に、メインジャンルの特徴を活かしつつ、サブジャンルの要素で読者の興味を引く工夫をしてください。`,
  },

  synopsis: {
    generate: `以下の情報から魅力的なあらすじを作成してください。

【プロジェクト基本情報】
{projectInfo}

【キャラクター情報】
{characters}

【プロット基本設定】
{basicPlotInfo}

【物語構造の詳細】
{detailedStructureInfo}

【重要指示】
上記の情報を総合的に活用して、以下の要素を含む魅力的なあらすじを作成してください：

1. **主人公の動機と目標**：プロット基本設定の「主人公の目標」を基に、明確な動機を表現
2. **主要な対立や問題**：「主要な障害」を活用し、物語の核心となる対立を設定
3. **物語の核心となる出来事**：物語構造の詳細（起承転結、三幕構成、または四幕構成）に沿った展開
4. **読者の興味を引く要素**：「フック要素」を活かした魅力的な導入
5. **適切な文字数**：500文字程度で簡潔かつ魅力的に

【特に重視すべき点】
- 物語構造の詳細（起承転結、三幕構成、または四幕構成）を必ず反映
- キャラクターの性格や背景を活かした物語展開
- プロット基本設定（主人公の目標、主要な障害を含む）の一貫性を保つ
- 読者の心を掴む、魅力的で読みやすい文章

【出力形式】
あらすじのみを出力してください。説明文やコメントは不要です。`,

    improveReadable: `以下のあらすじを読みやすく調整してください。文章を整理し、理解しやすく、流れの良い文章に修正してください。

【現在のあらすじ】
{synopsis}

【調整方針】
- 文章の流れを自然にする
- 重複や冗長な表現を整理する
- 読み手が理解しやすい構造にする
- 物語の魅力は保ちつつ、簡潔で分かりやすくする

【出力形式】
調整されたあらすじのみを出力してください。`,

    improveSummary: `以下のあらすじから重要なポイントを抽出し、要約版を作成してください。

【現在のあらすじ】
{synopsis}

【要約方針】
- 物語の核心となる要素を抽出
- 主人公の動機と目標を明確にする
- 重要な出来事と転換点を簡潔に表現
- 読者の興味を引く要素を残す

【出力形式】
要約されたあらすじのみを出力してください。`,

    improveEngaging: `以下のあらすじをより魅力的で読者の興味を引く表現に調整してください。

【現在のあらすじ】
{synopsis}

【演出方針】
- 読者の好奇心を刺激する表現を使う
- 感情に訴える描写を強化する
- 物語の魅力を際立たせる
- 読者を引き込む力強い文章にする

【出力形式】
魅力的に演出されたあらすじのみを出力してください。`,

    improve: `以下のあらすじをより魅力的に改善してください。

現在のあらすじ:
{synopsis}

改善のポイント:
・読者の興味を引く表現
・物語の核心を伝える
・キャラクターの魅力を表現
・適切な文字数（500文字程度）`,
  },

  chapter: {
    generateBasic: `以下のプロジェクト情報に基づいて、物語の章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}

【最重要】構成詳細
{structureDetails}

【主要キャラクター】
{characters}

【既存の章】
{existingChapters}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. **構成詳細の情報を最優先で従い、逸脱しない**
   - 起承転結、三幕構成、四幕構成の詳細に厳密に従う
   - 各段階の役割と配置を正確に反映

2. **メインジャンルに適した章構成**
   - メインジャンルの特徴を活かした章の配置とペース
   - ジャンル特有の構成パターンを考慮

3. **キャラクターの役割と性格を考慮**
   - 各キャラクターの個性を活かした章の内容
   - キャラクター関係性の発展を考慮
   - 役割に応じた登場タイミング

4. **既存の章との整合性**
   - 既存の章がある場合は、それらとの流れを保つ
   - 物語の一貫性を維持

5. **章数と配置の最適化**
   - 構成詳細に基づいた適切な章数
   - 各段階の比重に応じた章の長さ配分
   - クライマックスの適切な配置

6. **登場キャラクターの提案**
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング
   - 既存キャラクターの性格・背景を活かした章の内容
   - 物語の展開に必要なサブキャラクターの適切な配置`,

    generateStructure: `以下のプロジェクト情報に基づいて、未完了の構成要素「{incompleteStructures}」に対応する章立てを提案してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}

【最重要】構成詳細
{structureDetails}

【キャラクター情報】
{characters}

【既存章構成】
{existingChapters}

【未完了構成要素】
{incompleteStructures}

【必須出力形式】（この形式を厳密に守ってください）
第1章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

第2章: [章タイトル]
概要: [章の概要（200文字以内）]
設定・場所: [章の舞台となる場所や設定]
雰囲気・ムード: [章の雰囲気やムード]
重要な出来事: [重要な出来事1, 重要な出来事2, 重要な出来事3]
登場キャラクター: [登場するキャラクター名1, 登場するキャラクター名2]

（以下同様に続く）

【出力制約】
- 最低4章以上作成すること
- 各章は必ず上記の6項目（章タイトル、概要、設定・場所、雰囲気・ムード、重要な出来事、登場キャラクター）を含むこと
- 項目名は「概要:」「設定・場所:」等の形式を厳密に守ること
- 章番号は「第X章:」の形式を使用すること
- 各章の概要は200文字以内に収めること
- 会話内容や詳細な描写は避け、章の目的と内容のみを簡潔に記述すること
- 重要な出来事は3つ以上、登場キャラクターは2つ以上含めること

【最重要指示】
1. **構成詳細の情報を最優先で従い、逸脱しない**
   - 起承転結、三幕構成、四幕構成の詳細に厳密に従う
   - 各段階の役割と配置を正確に反映

2. **未完了の構成要素に焦点を当てた章立て**
   - 「{incompleteStructures}」の要素を重点的に補完
   - 構成詳細に基づいた適切な配置

3. **メインジャンルに適した章構成**
   - メインジャンルの特徴を活かした章の配置とペース
   - ジャンル特有の構成パターンを考慮

4. **キャラクターの役割と性格を考慮**
   - 各キャラクターの個性を活かした章の内容
   - キャラクター関係性の発展を考慮
   - 役割に応じた登場タイミング

5. **既存の章との整合性**
   - 既存の章構成との整合性を保つ
   - 物語の流れを自然に構成
   - 一貫性のある展開

6. **登場キャラクターの提案**
   - 主要キャラクターを尊重し、各章に適切に配置
   - 章の内容に必要であれば、新しいキャラクターを追加提案
   - キャラクターの関係性や役割を考慮した登場タイミング
   - 既存キャラクターの性格・背景を活かした章の内容
   - 物語の展開に必要なサブキャラクターの適切な配置`,

    structure: `以下の情報に基づいて章立て構成を提案してください。

物語のテーマ: {theme}
プロット: {plot}
想定文字数: {wordCount}

各章のタイトルと概要を提案してください。バランスの取れた構成を心がけてください。`,
  },

  draft: {
    generateSingle: `以下の設定に基づいて物語の草案を執筆してください。

【章情報】
章タイトル: {chapterTitle}
章の概要: {chapterSummary}
登場キャラクター: {characters}
設定・場所: {setting}
雰囲気・ムード: {mood}
重要な出来事: {keyEvents}

【プロジェクト情報】
作品タイトル: {projectTitle}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}

【前章までのあらすじ】
{previousStory}

【直前の章の末尾（一貫性確保用）】
{previousChapterEnd}

【プロジェクト全体のキャラクター情報（一貫性確保用）】
{projectCharacters}

【プロット情報（一貫性確保用）】
テーマ: {plotTheme}
舞台設定: {plotSetting}
物語の構造: {plotStructure}

【文体設定】
文体: {style}

{styleDetails}

【執筆指示】
1. **文字数**: 3000-4000文字程度で執筆してください
2. **会話重視**: キャラクター同士の会話を豊富に含め、生き生きとした対話を心がけてください
3. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
4. **章の目的**: 章の概要に沿った内容で、物語を前進させてください
5. **設定の整合性**: 「設定資料・世界観」や「重要用語集」の内容と矛盾しないようにしてください
6. **関係性の反映**: 「キャラクター相関図」の関係性に基づいた会話や態度を描写してください
{styleDetails ? '7. **文体の統一**: 上記の文体設定を厳密に守り、一貫性のある文章を執筆してください' : ''}

【文体の特徴（基本）】
- 現代的な日本語小説の文体
- 適度な改行と段落分け（会話の前後、場面転換時など）
- 会話は「」で囲む
- 情景描写は詩的で美しい表現を
- 改行は自然な文章の流れに従って適切に行う

【改行の指示】
- 会話の前後で改行する
- 場面転換時に改行する
- 段落の区切りで改行する
- 長い文章は読みやすく適度に改行する
- 改行は通常の改行文字（\n）で表現する

{customPrompt}

章の内容を執筆してください。`,

    generateFull: `以下のプロジェクト全体の情報を基に、一貫性のある魅力的な小説の全章を執筆してください。

【プロジェクト基本情報】
作品タイトル: {title}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}
プロジェクトテーマ: {projectTheme}

【プロット基本設定】
テーマ: {plotTheme}
舞台設定: {plotSetting}
フック: {plotHook}
主人公の目標: {protagonistGoal}
主要な障害: {mainObstacle}

【物語構造の詳細】
{structureDetails}

【キャラクター情報】
{charactersInfo}

【章立て構成】
{chaptersInfo}

【執筆指示】
1. **全章の一貫性**: キャラクターの性格、設定、物語の流れを全章を通して一貫させてください
2. **文字数**: 各章3000-4000文字程度で執筆してください
3. **会話重視**: キャラクター同士の会話を豊富に含め、自然で生き生きとした対話を心がけてください
4. **臨場感**: 読者がその場にいるような感覚を与える詳細な情景描写を入れてください
5. **感情表現**: キャラクターの心理状態や感情を丁寧に描写してください
6. **五感の活用**: 視覚、聴覚、触覚、嗅覚、味覚を意識した描写を入れてください
7. **章の目的**: 各章の概要に沿った内容で、物語を前進させてください
8. **文体の統一**: 現代的な日本語小説の文体で、読み手が感情移入しやすい表現を使用してください

【出力形式】
以下の形式で各章の草案を出力してください：

=== 第1章: [章タイトル] ===
[章の草案内容]

=== 第2章: [章タイトル] ===
[章の草案内容]

[以下、全章分続く]

各章の草案を執筆してください。`,

    enhanceDescription: `以下の文章の描写をより詳細で魅力的に強化してください。

【現在の文章】
{currentText}

【強化指示】
- 情景描写をより詳細に
- キャラクターの感情表現を豊かに
- 五感を使った表現を追加
- 会話の自然さを保ちつつ、心理描写を強化
- 文章の長さは元の1.2-1.5倍程度に
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

強化された文章：`,

    adjustStyle: `以下の文章の文体を調整し、より読みやすく魅力的にしてください。

【現在の文章】
{currentText}

【調整指示】
- 文章のリズムを整える
- 冗長な表現を簡潔に
- 読みやすい改行と段落分け
- 自然で現代的な日本語に
- 内容は変えずに表現のみ改善
- 改行は通常の改行文字（\n）で表現してください

調整された文章：`,

    shorten: `以下の文章を簡潔にまとめ、冗長な部分を削除してください。

【現在の文章】
{currentText}

【短縮指示】
- 重要な内容は保持
- 冗長な表現を削除
- 文章の流れを保つ
- 約70-80%の長さに短縮
- 読みやすさを維持
- 適度な改行と段落分けを行ってください
- 改行は通常の改行文字（\n）で表現してください

短縮された文章：`,

    improve: `以下の章の草案を総合的に改善してください。

【章情報】
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【現在の草案】
{currentText}

【改善指示】
1. **描写の強化**
   - 情景描写をより詳細で魅力的に
   - キャラクターの感情表現を豊かに
   - 五感を使った表現を追加
   - 会話の自然さを保ちつつ、心理描写を強化

2. **文体の調整**
   - 文章のリズムを整える
   - 冗長な表現を簡潔に
   - 読みやすい改行と段落分け
   - 自然で現代的な日本語に

3. **文字数と内容**
   - 現在の文字数（{currentLength}文字）を維持または3,000-4,000文字程度に調整
   - 重要な内容は保持しつつ、表現を改善
   - 章の目的に沿った内容を維持

4. **改行の指示**
   - 適度な改行と段落分けを行ってください
   - 改行は通常の改行文字（\n）で表現してください

改善された草案：`,

    critique: `あなたは辛口で知られるプロの文芸編集者です。以下の文章を、構成、キャラクターの一貫性、描写、文体、感情表現の各側面で客観的に評価してください。

【章情報】
作品タイトル: {projectTitle}
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【評価対象の文章】
{currentText}

【評価基準（各項目10点満点で採点）】
1. **プロットの一貫性**：物語に矛盾や論理的な飛躍がないか？
2. **キャラクターの深み**：登場人物は多面的で、行動に説得力があるか？
3. **描写の具体性**：五感に訴えかける具体的な描写がなされているか？
4. **読者共感度**：読者が感情移入できる感情的な真正性があるか？
5. **文体の完成度**：文章のリズムが整い、読みやすいか？

【出力形式】
以下のJSON形式で出力してください（余計な文章は書かないこと）:
{{
  "scores": {{
    "plot": 点数（0-10の整数）,
    "character": 点数（0-10の整数）,
    "description": 点数（0-10の整数）,
    "empathy": 点数（0-10の整数）,
    "style": 点数（0-10の整数）
  }},
  "weaknesses": [
    {{
      "aspect": "評価項目名（例：プロットの一貫性）",
      "score": 点数,
      "problem": "具体的な問題点の説明",
      "solutions": [
        "改善策1（具体的な修正案）",
        "改善策2（具体的な修正案）",
        "改善策3（具体的な修正案）"
      ]
    }}
  ],
  "summary": "全体的な評価と最も重要な改善点の要約（200文字程度）"
}}

7点以下の項目について、特に詳しく分析してください。`,

    revise: `フェーズ1で指摘された弱点を克服するために、以下の文章を書き直してください。

【章情報】
作品タイトル: {projectTitle}
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【元の文章】
{currentText}

【フェーズ1での評価結果】
{critiqueResult}

【改訂指示】
1. フェーズ1で指摘されたすべての弱点を克服してください
2. 特に7点以下の評価項目については、改善策を必ず適用してください
3. 現在の文字数（{currentLength}文字）を維持または3,000-4,000文字程度に調整してください
4. 重要な内容は保持しつつ、表現を改善してください
5. 適度な改行と段落分けを行ってください（改行は通常の改行文字\\nで表現）

改訂された文章：`,

    generate: `以下の設定に基づいて物語の草案を執筆してください。

章タイトル: {chapterTitle}
章の概要: {chapterSummary}
登場キャラクター: {characters}

文体: {style}

{styleDetails}

上記の文体設定を厳密に守り、一貫性のある文章を執筆してください。自然な日本語で、読みやすい文章を心がけてください。`,


    continue: `以下の文章の続きを執筆してください。
ただし、いきなり執筆するのではなく、
まず以下のステップで思考してください。

【ステップ1：現在の状況分析】
- 現在の文章の最後の場面・状況を要約
- 登場キャラクターの現在の感情・状態を分析
- 未解決の伏線や緊張感の要素を特定

【ステップ2：次の展開の方向性】
- 章の概要に照らして、次に起きるべき出来事を検討
- キャラクターの動機に基づいた自然な行動を予測
- 読者の興味を維持するための引き要素を考案

【ステップ3：文体とトーンの確認】
- 既存の文章の文体を分析
- 次の場面にふさわしいトーンを決定

【ステップ4：執筆】
上記の分析を踏まえ、続きを執筆してください。

---

【現在の文章】
{currentText}

【章情報】
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【プロジェクト全体のキャラクター情報（一貫性確保用）】
{projectCharacters}

【プロット情報（一貫性確保用）】
テーマ: {plotTheme}
舞台設定: {plotSetting}
物語の構造: {plotStructure}

文体: {style}

{styleDetails}

【出力形式】
思考プロセス（ステップ1〜3）は簡潔に、
執筆本文は600〜1000文字程度で自然な流れで書いてください。
上記の文体設定を厳密に守り、一貫性のある文章を執筆してください。文体を統一し、章設定に沿った自然な流れで続きを書いてください。章の雰囲気や登場キャラクターの性格を維持しながら執筆してください。`,

    // dialogue: 現在未使用（将来の機能拡張用に保持）
    // dialogue: `以下の状況での対話シーンを作成してください。
    //
    // 【章情報（参考）】
    // 章タイトル: {chapterTitle}
    // 章の概要: {chapterSummary}
    //
    // 【対話シーン設定】
    // 状況: {situation}
    // 目的: {purpose}
    //
    // 【キャラクター詳細情報（一貫性確保用）】
    // {projectCharacters}
    //
    // 各キャラクターの性格を反映し、章の雰囲気と場所に適した自然な対話を作成してください。章設定から逸脱しないよう注意してください。`,
  },

  world: {
    generate: `以下の情報を基に、指定されたカテゴリに特化した世界観設定を生成してください。

【プロジェクト基本情報】
タイトル: {title}
テーマ: {theme}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}
作品内容・概要: {description}

【キャラクター情報】
{characters}

【プロット基礎設定】
{plotInfo}

【既存の世界観情報】
{existingWorldInfo}

【生成カテゴリ】
{category}

【生成指示】
{instruction}

【重要】以下の点を厳守してください：
1. 指定されたカテゴリ「{category}」に特化した内容のみを生成してください
2. 他のカテゴリの内容は含めないでください
3. 物語執筆に直接役立つ具体的な情報を提供してください
4. 簡潔で実用的な内容にしてください
5. **既存のキャラクター情報とプロット基礎設定と整合性を保った世界観を構築してください**
6. キャラクターの背景や設定と矛盾しない世界観を生成してください
7. プロットの舞台設定や物語の流れと一貫性のある世界観を構築してください

以下の形式で世界観設定を生成してください：

【タイトル】
（カテゴリ「{category}」に特化した世界観設定のタイトル）

【詳細】
（カテゴリ「{category}」に関する具体的な設定内容。物語執筆に必要な情報を含める。100-300文字程度で簡潔に。キャラクター情報とプロット基礎設定との整合性を保つこと）

特に、メインジャンルとサブジャンルの特徴を活かし、作品のテーマに沿った一貫性のある世界観を構築してください。既存のキャラクター設定やプロット設定と矛盾しないよう注意してください。指定されたカテゴリ以外の内容は含めないでください。`,
    enhance: `以下の世界観設定をより詳細に補完・改善してください。

【現在の設定】
タイトル: {title}
カテゴリ: {category}
内容:
{content}

【プロジェクト情報】
タイトル: {projectTitle}
テーマ: {theme}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}

【補完指示】
{instruction}

既存の設定を活かしつつ、より深みのある世界観設定にしてください。物語執筆に役立つ具体的な情報を追加してください。

以下の形式で改善された設定を出力してください：

【タイトル】
（改善されたタイトル）

【詳細な内容】
（補完・改善された詳細な設定内容）`,
    expand: `以下の世界観設定から、関連する新しい設定を展開してください。

【元の設定】
タイトル: {sourceTitle}
カテゴリ: {sourceCategory}
内容: {sourceContent}

【展開カテゴリ】
{targetCategory}

【展開指示】
{instruction}

元の設定と一貫性を保ちながら、新しい側面を展開してください。物語の世界観をより豊かにする設定を提案してください。

以下の形式で展開された設定を出力してください：

【タイトル】
（新しい設定のタイトル）

【詳細な内容】
（展開された詳細な設定内容）

【元の設定との関連性】
（元の設定との関連性や接続点）`,
    // validate: 現在未使用（将来の機能拡張用に保持）
    // validate: `以下の世界観設定に矛盾や不整合がないか検証してください。
    //
    // 【世界観設定一覧】
    // {worldSettings}
    //
    // 【プロジェクト情報】
    // タイトル: {projectTitle}
    // テーマ: {theme}
    // メインジャンル: {mainGenre}
    //
    // 【検証ポイント】
    // - 設定間の矛盾
    // - 論理的な不整合
    // - 物語の一貫性
    // - キャラクター設定との整合性
    // - プロット設定との整合性
    //
    // 問題があれば指摘し、改善案を提示してください。問題がなければ、設定の一貫性を確認した旨を伝えてください。`,
  },
};

class AIService {
  private async callOpenAI(request: AIRequest): Promise<AIResponse> {
    try {
      if (!request.settings.apiKey) {
        throw new Error('OpenAI APIキーが設定されていません');
      }

      // APIキーの復号化
      const apiKey = decryptApiKey(request.settings.apiKey);

      // Tauri環境検出（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      
      // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
      const apiUrl = isTauriEnv || !import.meta.env.DEV
        ? 'https://api.openai.com/v1/chat/completions'
        : '/api/openai/v1/chat/completions';

      // 画像がある場合のメッセージ構築
      let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      if (request.image) {
        // Base64データURLをそのまま使用（OpenAI Vision APIはdata:形式をサポート）
        userContent = [
          {
            type: 'text',
            text: request.prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: request.image,
            },
          },
        ];
      } else {
        userContent = request.prompt;
      }

      const requestBody = {
        model: request.settings.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: request.settings.temperature,
        max_tokens: request.settings.maxTokens,
        stream: !!request.onStream, // ストリーミング有効化
      };

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';
        
        await httpService.postStream(
          apiUrl,
          requestBody,
          (chunk) => {
            // SSEの解析
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullContent += content;
                    request.onStream!(content);
                  }
                } catch (e) {
                  console.warn('SSE parse error:', e);
                }
              }
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
            signal: request.signal
          }
        );

        return {
          content: fullContent,
        };
      }

      // 通常のリクエスト（非ストリーミング）
      const response = await httpService.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API エラー: ${errorMessage}`);
      }

      const data = response.data as { choices: Array<{ message: { content: string } }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('OpenAI API からの応答が無効です');
      }

      return {
        content: data.choices[0].message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async callClaude(request: AIRequest): Promise<AIResponse> {
    try {
      if (!request.settings.apiKey) {
        throw new Error('Claude APIキーが設定されていません');
      }

      // APIキーの復号化
      const apiKey = decryptApiKey(request.settings.apiKey);

      // Tauri環境検出（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      
      // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
      const apiUrl = isTauriEnv || !import.meta.env.DEV
        ? 'https://api.anthropic.com/v1/messages'
        : '/api/anthropic/v1/messages';

      console.log('Claude API Request:', {
        model: request.settings.model,
        prompt: request.prompt.substring(0, 100) + '...',
        hasImage: !!request.image,
        temperature: request.settings.temperature,
        maxTokens: request.settings.maxTokens,
        apiUrl,
        stream: !!request.onStream
      });

      // 画像がある場合のコンテンツ構築
      let userContent: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
      if (request.image) {
        // Base64データURLからBase64部分とMIMEタイプを抽出
        const match = request.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          userContent = [
            {
              type: 'text',
              text: request.prompt,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            },
          ];
        } else {
          // data:形式でない場合は画像なしとして扱う
          userContent = request.prompt;
        }
      } else {
        userContent = request.prompt;
      }

      const requestBody = {
        model: request.settings.model,
        max_tokens: request.settings.maxTokens,
        temperature: request.settings.temperature,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
        stream: !!request.onStream,
      };

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';
        
        await httpService.postStream(
          apiUrl,
          requestBody,
          (chunk) => {
            // SSEの解析
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  const content = data.delta.text;
                  fullContent += content;
                  request.onStream!(content);
                }
              } catch (e) {
                console.warn('SSE parse error:', e);
              }
            }
          },
          {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: request.signal
          }
        );

        return {
          content: fullContent,
        };
      }

      const response = await httpService.post(apiUrl, requestBody, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`Claude API エラー: ${errorMessage}`);
      }

      const data = response.data as { content: Array<{ text: string }>; usage?: { input_tokens: number; output_tokens: number } };
      
      console.log('Claude API Response:', data);
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        console.error('Invalid Claude response structure:', data);
        throw new Error('Claude API からの応答が無効です');
      }

      return {
        content: data.content[0].text,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('Claude API Error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async callGemini(request: AIRequest): Promise<AIResponse> {
    try {
      if (!request.settings.apiKey) {
        throw new Error('Gemini APIキーが設定されていません');
      }

      // APIキーの復号化
      const apiKey = decryptApiKey(request.settings.apiKey);

      // Tauri環境検出（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      
      // ストリーミングの場合はエンドポイントが異なる (streamGenerateContent)
      const method = request.onStream ? 'streamGenerateContent' : 'generateContent';
      
      // 開発環境（ブラウザ）ではプロキシ経由、Tauri環境では直接アクセス
      const apiUrl = isTauriEnv || !import.meta.env.DEV
        ? `https://generativelanguage.googleapis.com/v1beta/models/${request.settings.model}:${method}?key=${apiKey}`
        : `/api/gemini/v1beta/models/${request.settings.model}:${method}?key=${apiKey}`;

      console.log('Gemini API Request:', {
        model: request.settings.model,
        prompt: request.prompt.substring(0, 100) + '...',
        hasImage: !!request.image,
        temperature: request.settings.temperature,
        maxTokens: request.settings.maxTokens,
        apiUrl,
        stream: !!request.onStream
      }, {
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      // 画像がある場合のパーツ構築
      const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
        {
          text: request.prompt,
        },
      ];

      if (request.image) {
        // Base64データURLからBase64部分とMIMEタイプを抽出
        const match = request.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        }
      }

      const requestBody = {
        contents: [{
          parts: parts,
        }],
        systemInstruction: {
          parts: [{
            text: SYSTEM_PROMPT,
          }],
        },
        generationConfig: {
          temperature: request.settings.temperature,
          maxOutputTokens: request.settings.maxTokens,
        },
      };

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';
        
        // GeminiのストリーミングはJSONの配列が送られてくる特殊な形式
        // 通常のSSEとは異なり、]で終わるJSON配列のストリーム
        // ここでは簡易的にパースする
        
        await httpService.postStream(
          apiUrl,
          requestBody,
          (chunk) => {
            // チャンク処理が複雑なため、Geminiの場合は
            // 行ごとに分割して処理を試みる
            
            // Note: GeminiのREST APIストリーミングは単純なSSEではなく、
            // JSON配列が徐々に送られてくる形式。
            // 完全な実装にはストリーミングJSONパーサーが必要だが、
            // ここでは簡易的にtextフィールドを抽出する
            
            // 簡易実装: "text": "..." を正規表現で探す
            const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            while ((match = regex.exec(chunk)) !== null) {
              try {
                // JSON文字列のエスケープを解除
                const text = JSON.parse(`"${match[1]}"`);
                fullContent += text;
                request.onStream!(text);
              } catch (e) {
                console.warn('Gemini stream parse error:', e);
              }
            }
          },
          {
            timeout: 120000, // Gemini APIストリーミングも120秒に設定
            signal: request.signal
          }
        );

        return {
          content: fullContent,
        };
      }

      // Gemini APIは長文生成に時間がかかることがあるため、タイムアウトを120秒に設定
      const response = await httpService.post(apiUrl, requestBody, {
        timeout: 120000, // 120秒
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { message?: string; code?: number } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        
        // 429エラーの場合、より詳細なメッセージを提供
        if (response.status === 429) {
          let detailedMessage = `Gemini API エラー (429): ${errorMessage}`;
          
          if (errorMessage.includes('Resource has been exhausted') || errorMessage.includes('quota')) {
            detailedMessage += '\n\n【考えられる原因】\n';
            detailedMessage += '1. リージョンのリソース制限: 特定のリージョンでリソースが一時的に枯渇している可能性があります\n';
            detailedMessage += '2. プロビジョニングされたスループット未購入: 従量課金制の場合、リソースの優先度が低い可能性があります\n';
            detailedMessage += '3. 一時的なリソース不足: Googleのインフラストラクチャが一時的に高負荷状態にある可能性があります\n';
            detailedMessage += '4. Proモデルの制限: Gemini 2.5 ProはFlashモデルよりも厳しいリソース制限があります\n\n';
            detailedMessage += '【対処法】\n';
            detailedMessage += '- しばらく待ってから再試行してください\n';
            detailedMessage += '- Gemini 2.5 Flashなどの軽量モデルを試してください\n';
            detailedMessage += '- Google Cloud Consoleでクォータとレート制限を確認してください\n';
            detailedMessage += '- プロビジョニングされたスループットの購入を検討してください';
          }
          
          throw new Error(detailedMessage);
        }
        
        throw new Error(`Gemini API エラー (${response.status}): ${errorMessage}`);
      }

      const data = response.data as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
      
      console.log('Gemini API Response:', data);
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('Invalid Gemini response structure:', data);
        throw new Error('Gemini API からの応答が無効です');
      }

      return {
        content: data.candidates[0].content.parts[0].text,
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async callLocal(request: AIRequest): Promise<AIResponse> {
    try {
      let endpoint = request.settings.localEndpoint || 'http://localhost:1234/v1/chat/completions';
      
      if (!endpoint) {
        throw new Error('ローカルエンドポイントが設定されていません');
      }

      // エンドポイントにパスが含まれていない場合は追加
      if (!endpoint.includes('/v1/chat/completions') && !endpoint.includes('/api/') && !endpoint.includes('/chat')) {
        if (endpoint.endsWith('/')) {
          endpoint = endpoint + 'v1/chat/completions';
        } else {
          endpoint = endpoint + '/v1/chat/completions';
        }
      }

      // Tauri環境チェック（Tauri 2対応）
      const isTauriEnv = typeof window !== 'undefined' && 
        ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
      
      // 開発環境でブラウザの場合のみプロキシ経由（CORS回避）
      let apiEndpoint = endpoint;
      if (!isTauriEnv && import.meta.env.DEV) {
        // ブラウザ開発環境ではViteのプロキシを使用
        // http://localhost:1234 -> /api/local
        if (endpoint.includes('localhost:1234')) {
          apiEndpoint = '/api/local';
        } else if (endpoint.includes('localhost:11434')) {
          // Ollama用のプロキシも追加
          apiEndpoint = '/api/ollama';
        }
        // それ以外のローカルエンドポイントの場合は直接接続を試みる
      }
      // Tauri環境では常に元のエンドポイントを使用（HTTPプラグインがlocalhostにアクセス可能）

      // プロンプトの長さを制限（Local LLMでは短めに）
      const maxPromptLength = 3000;
      const truncatedPrompt = request.prompt.length > maxPromptLength 
        ? request.prompt.substring(0, maxPromptLength) + '\n\n[プロンプトが長すぎるため省略されました]'
        : request.prompt;

      // max_tokensを制限（Local LLMでは適度に設定）
      const maxTokens = Math.min(request.settings.maxTokens, 8192);

      console.log('Local LLM Request:', {
        endpoint: apiEndpoint,
        originalEndpoint: endpoint,
        model: request.settings.model,
        promptLength: truncatedPrompt.length,
        originalPromptLength: request.prompt.length,
        temperature: request.settings.temperature,
        maxTokens: maxTokens,
        stream: !!request.onStream
      });

      const requestBody = {
        model: request.settings.model || 'local-model',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: truncatedPrompt,
          },
        ],
        temperature: request.settings.temperature,
        max_tokens: maxTokens,
        stream: !!request.onStream,
      };

      // ストリーミング処理
      if (request.onStream) {
        let fullContent = '';
        
        await httpService.postStream(
          apiEndpoint,
          requestBody,
          (chunk) => {
            // OpenAI互換のSSE解析
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  const content = data.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullContent += content;
                    request.onStream!(content);
                  }
                } catch (_e) {
                  // JSONパースエラーは無視（不完全なチャンクの可能性）
                }
              }
            }
          },
          {
            timeout: 120000,
            signal: request.signal
          }
        );

        return {
          content: fullContent,
        };
      }

      const response = await httpService.post(apiEndpoint, requestBody, {
        timeout: 120000,
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        console.error('Local LLM HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint: apiEndpoint
        });
        throw new Error(`ローカルLLM エラー: ${errorMessage}`);
      }

      const data = response.data as { choices?: Array<{ message: { content: string } }>; content?: string; response?: string; error?: string };
      
      console.log('Local LLM Response:', data);
      
      // エラーレスポンスの処理
      if (data.error) {
        throw new Error(`ローカルLLM エラー: ${data.error}`);
      }
      
      // 複数の応答形式に対応
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return {
          content: data.choices[0].message.content,
        };
      } else if (data.content) {
        // 一部のローカルLLMは直接contentを返す
        return {
          content: data.content,
        };
      } else if (data.response) {
        // 別の形式
        return {
          content: data.response,
        };
      } else {
        console.error('Unexpected response format:', data);
        throw new Error(`ローカルLLM からの応答が無効です。応答形式: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Local LLM Error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        endpoint: request.settings.localEndpoint
      });
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.message.includes('ネットワークエラー')) {
          errorMessage = `ローカルLLMサーバーに接続できません。サーバーが起動しているか確認してください。\nエンドポイント: ${request.settings.localEndpoint || 'http://localhost:1234'}`;
        } else if (error.message.includes('タイムアウト')) {
          errorMessage = `ローカルLLMサーバーからの応答がタイムアウトしました。サーバーが正常に動作しているか確認してください。`;
        } else {
          errorMessage = `ローカルLLM エラー: ${error.message}`;
        }
      }
      
      return {
        content: '',
        error: errorMessage,
      };
    }
  }

  async generateContent(request: AIRequest): Promise<AIResponse> {
    try {
      const { prompt, settings } = request;
      
      // 入力値のサニタイゼーション
      const sanitizedPrompt = sanitizeInput(prompt);
      
      if (!settings.apiKey && settings.provider !== 'local') {
        return {
          content: '',
          error: 'APIキーが設定されていません'
        };
      }

      // プロンプトの検証
      if (!sanitizedPrompt.trim()) {
        return {
          content: '',
          error: 'プロンプトが空です'
        };
      }

      // 再試行機能付きでAPI呼び出しを実行
      const isLocalProvider = settings.provider === 'local';
      const response = await retryApiCall(
        async () => {
          switch (settings.provider) {
            case 'openai':
              return this.callOpenAI({ ...request, prompt: sanitizedPrompt });
            case 'claude':
              return this.callClaude({ ...request, prompt: sanitizedPrompt });
            case 'gemini':
              return this.callGemini({ ...request, prompt: sanitizedPrompt });
            case 'local':
              return this.callLocal({ ...request, prompt: sanitizedPrompt });
            default:
              throw new Error('サポートされていないプロバイダーです');
          }
        },
        {
          // プロバイダーごとのタイムアウト設定
          // Gemini APIは長文生成に時間がかかるため、120秒に設定
          // ローカルLLMも120秒、その他のAPIは60秒
          timeout: isLocalProvider 
            ? 120000 
            : request.settings.provider === 'gemini' 
              ? 120000 
              : 60000,
          retryConfig: {
            maxRetries: isLocalProvider ? 2 : 3, // ローカルLLMは再試行回数を減らす
            baseDelay: isLocalProvider ? 2000 : 1000, // ローカルLLMは待機時間を長く
            maxDelay: isLocalProvider ? 15000 : 10000,
            backoffMultiplier: 2
          },
          // ストリーミングの場合は再試行しない（複雑になるため）
          shouldRetry: (error: unknown) => {
            if (request.onStream) return false;
            if (!(error instanceof Error)) return false;
            return (
              error.message.includes('timeout') || 
              error.message.includes('network') ||
              error.message.includes('rate limit') ||
              error.message.includes('500') ||
              error.message.includes('503')
            );
          },
          onRetry: (attempt, error) => {
            console.warn(`AI API呼び出し失敗 (試行 ${attempt}):`, error);
          },
          onError: (error) => {
            console.error('AI API呼び出し最終失敗:', error);
          }
        }
      );

      // ストリーミングの場合はそのまま返す
      if (request.onStream) {
        return response;
      }

      // 応答の解析と検証
      if (response.content) {
        const parsedResponse = parseAIResponse(response.content, 'auto');
        
        if (parsedResponse.success && validateResponse(parsedResponse)) {
          const data = parsedResponse.data as Record<string, unknown>;
          return {
            content: data.type === 'text' ? (data.content as string) : response.content,
            error: response.error
          };
        } else {
          console.warn('AI応答の解析に失敗しましたが、生の応答を返します:', parsedResponse.error);
        }
      }

      return {
        content: response.content || '',
        error: response.error
      };
    } catch (error) {
      console.error('AI generation error:', error);
      
      // ユーザーフレンドリーなエラーメッセージを生成
      const friendlyMessage = getUserFriendlyErrorMessage(error, 'AI生成');
      
      return {
        content: '',
        error: friendlyMessage
      };
    }
  }

  buildPrompt(type: string, subType: string, variables: Record<string, string>): string {
    const promptType = PROMPTS[type as keyof typeof PROMPTS];
    if (!promptType) {
      throw new Error(`Prompt type not found: ${type}`);
    }
    
    const template = promptType[subType];
    if (!template) {
      throw new Error(`Prompt template not found: ${type}.${subType}`);
    }

    let prompt = template;
    
    // 文体の詳細指示を構築（draftタイプの場合）
    if (type === 'draft' && (subType === 'generate' || subType === 'continue')) {
      const styleDetails = this.buildStyleDetails(variables);
      variables.styleDetails = styleDetails;
    }
    
    Object.entries(variables).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value || '');
    });

    return prompt;
  }

  private buildStyleDetails(variables: Record<string, string>): string {
    const {
      perspective,
      formality,
      rhythm,
      metaphor,
      dialogue,
      emotion,
      tone
    } = variables;

    // 文体の詳細パラメータが1つでも提供されている場合のみ、詳細指示を構築
    if (!perspective && !formality && !rhythm && !metaphor && !dialogue && !emotion && !tone) {
      return '';
    }

    const details: string[] = [];
    details.push('【文体の詳細指示】');

    if (perspective) {
      details.push(`- **人称**: ${perspective} （一人称 / 三人称 / 神の視点）`);
    }
    if (formality) {
      details.push(`- **硬軟**: ${formality} （硬め / 柔らかめ / 口語的 / 文語的）`);
    }
    if (rhythm) {
      details.push(`- **リズム**: ${rhythm} （短文中心 / 長短混合 / 流れるような長文）`);
    }
    if (metaphor) {
      details.push(`- **比喩表現**: ${metaphor} （多用 / 控えめ / 詩的 / 写実的）`);
    }
    if (dialogue) {
      details.push(`- **会話比率**: ${dialogue} （会話多め / 描写重視 / バランス型）`);
    }
    if (emotion) {
      details.push(`- **感情描写**: ${emotion} （内面重視 / 行動で示す / 抑制的）`);
    }

    if (tone) {
      details.push('');
      details.push(`【参考となるトーン】`);
      details.push(`${tone} （緊張感 / 穏やか / 希望 / 切なさ / 謎めいた）`);
    }

    return details.join('\n');
  }
}

export const aiService = new AIService();