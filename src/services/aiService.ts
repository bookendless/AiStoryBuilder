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

// プロンプトテンプレート
interface PromptTemplates {
  [key: string]: {
    [subType: string]: string;
  };
}

const PROMPTS: PromptTemplates = {
  character: {
    enhance: `以下のキャラクター情報を簡潔に補完してください。

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

作品タイトル: {title}
作品テーマ: {theme}
作品内容・概要: {description}
メインジャンル: {mainGenre}
サブジャンル: {subGenre}
ターゲット読者: {targetReader}

【重要】作品のタイトル、テーマ、内容に合ったキャラクター設定を心がけてください：
- 作品タイトルから物語の方向性や雰囲気を読み取り、それに適したキャラクターを設定
- 作品内容・概要から具体的な物語の流れや設定を把握し、それに馴染むキャラクターを設定
- テーマに沿ったキャラクターの動機や目標を考慮
- 作品の世界観や設定に馴染むキャラクター背景を設定

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

以下の形式で3〜5人のキャラクターを回答してください：

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

【キャラクター4】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）

【キャラクター5】
名前: （キャラクターの名前）
基本設定: （年齢、性別、職業など）
外見: （具体的な外見特徴）
性格: （主要な性格特徴）
背景: （出身や過去の経験）

特に、作品タイトル、テーマ、内容を基に、メインジャンルとサブジャンルの特徴を活かし、ターゲット読者層に親近感を持ってもらえる、かつ互いに区別しやすいキャラクター設定を心がけてください。`,
  },

  plot: {
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
    structure: `以下の情報に基づいて章立て構成を提案してください。

物語のテーマ: {theme}
プロット: {plot}
想定文字数: {wordCount}

各章のタイトルと概要を提案してください。バランスの取れた構成を心がけてください。`,
  },

  draft: {
    generate: `以下の設定に基づいて物語の草案を執筆してください。

章タイトル: {chapterTitle}
章の概要: {chapterSummary}
登場キャラクター: {characters}
文体: {style}

自然な日本語で、読みやすい文章を心がけてください。`,


    continue: `以下の文章の続きを執筆してください。

【現在の文章】
{currentText}

【章情報（参考）】
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【プロジェクト全体のキャラクター情報（一貫性確保用）】
{projectCharacters}

【プロット情報（一貫性確保用）】
テーマ: {plotTheme}
舞台設定: {plotSetting}
物語の構造: {plotStructure}

文体: {style}

文体を統一し、章設定に沿った自然な流れで続きを書いてください。章の雰囲気や登場キャラクターの性格を維持しながら執筆してください。`,

    dialogue: `以下の状況での対話シーンを作成してください。

【章情報（参考）】
章タイトル: {chapterTitle}
章の概要: {chapterSummary}

【対話シーン設定】
状況: {situation}
目的: {purpose}

【キャラクター詳細情報（一貫性確保用）】
{projectCharacters}

各キャラクターの性格を反映し、章の雰囲気と場所に適した自然な対話を作成してください。章設定から逸脱しないよう注意してください。`,
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
    validate: `以下の世界観設定に矛盾や不整合がないか検証してください。

【世界観設定一覧】
{worldSettings}

【プロジェクト情報】
タイトル: {projectTitle}
テーマ: {theme}
メインジャンル: {mainGenre}

【検証ポイント】
- 設定間の矛盾
- 論理的な不整合
- 物語の一貫性
- キャラクター設定との整合性
- プロット設定との整合性

問題があれば指摘し、改善案を提示してください。問題がなければ、設定の一貫性を確認した旨を伝えてください。`,
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

      const response = await httpService.post('https://api.openai.com/v1/chat/completions', {
        model: request.settings.model,
        messages: [
          {
            role: 'system',
            content: '日本語の小説創作を支援するAIアシスタントです。自然で読みやすい日本語で回答してください。',
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        temperature: request.settings.temperature,
        max_tokens: request.settings.maxTokens,
      }, {
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

      console.log('Claude API Request:', {
        model: request.settings.model,
        prompt: request.prompt.substring(0, 100) + '...',
        hasImage: !!request.image,
        temperature: request.settings.temperature,
        maxTokens: request.settings.maxTokens,
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

      const response = await httpService.post('https://api.anthropic.com/v1/messages', {
        model: request.settings.model,
        max_tokens: request.settings.maxTokens,
        temperature: request.settings.temperature,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }, {
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

      console.log('Gemini API Request:', {
        model: request.settings.model,
        prompt: request.prompt.substring(0, 100) + '...',
        hasImage: !!request.image,
        temperature: request.settings.temperature,
        maxTokens: request.settings.maxTokens,
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

      const response = await httpService.post(`https://generativelanguage.googleapis.com/v1beta/models/${request.settings.model}:generateContent?key=${apiKey}`, {
        contents: [{
          parts: parts,
        }],
        generationConfig: {
          temperature: request.settings.temperature,
          maxOutputTokens: request.settings.maxTokens,
        },
      });

      if (response.status >= 400) {
        const errorData = response.data as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(`Gemini API エラー: ${errorMessage}`);
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

      // Tauri環境チェック
      const isTauriEnv = typeof window !== 'undefined' && '__TAURI__' in window;
      
      // 開発環境でTauriでない場合はプロキシ経由（CORS回避）
      let apiEndpoint = endpoint;
      if (!isTauriEnv && import.meta.env.DEV) {
        // 開発環境ではViteのプロキシを使用
        // http://localhost:1234 -> /api/local
        if (endpoint.includes('localhost:1234')) {
          apiEndpoint = '/api/local';
        } else if (endpoint.includes('localhost:11434')) {
          // Ollama用のプロキシも追加
          apiEndpoint = '/api/ollama';
        }
        // それ以外のローカルエンドポイントの場合は直接接続を試みる
      }

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
      });

      const response = await httpService.post(apiEndpoint, {
        model: request.settings.model || 'local-model',
        messages: [
          {
            role: 'system',
            content: '日本語の小説創作を支援するAIアシスタントです。自然で読みやすい日本語で回答してください。',
          },
          {
            role: 'user',
            content: truncatedPrompt,
          },
        ],
        temperature: request.settings.temperature,
        max_tokens: maxTokens,
      }, {
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
          timeout: isLocalProvider ? 120000 : 30000, // ローカルLLMは2分、その他は30秒
          retryConfig: {
            maxRetries: isLocalProvider ? 2 : 3, // ローカルLLMは再試行回数を減らす
            baseDelay: isLocalProvider ? 2000 : 1000, // ローカルLLMは待機時間を長く
            maxDelay: isLocalProvider ? 15000 : 10000,
            backoffMultiplier: 2
          },
          onRetry: (attempt, error) => {
            console.warn(`AI API呼び出し失敗 (試行 ${attempt}):`, error);
          },
          onError: (error) => {
            console.error('AI API呼び出し最終失敗:', error);
          }
        }
      );

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
    Object.entries(variables).forEach(([key, value]) => {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return prompt;
  }
}

export const aiService = new AIService();