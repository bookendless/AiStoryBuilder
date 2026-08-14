export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  requiresApiKey: boolean;
  isLocal?: boolean;
  description?: string;
  apiDocsUrl?: string;
  recommendedUses?: string[];
  regions?: string[];
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  capabilities?: string[];
  recommendedUse?: string;
  latencyClass?: 'standard' | 'fast' | 'reasoning';
}

export interface AISettings {
  provider: string;
  model: string;
  apiKey?: string; // 後方互換性のため残す（現在のプロバイダーのAPIキー）
  apiKeys?: Record<string, string>; // プロバイダーごとのAPIキー（プロバイダーIDをキーとして暗号化されたAPIキーを保存）
  localEndpoint?: string;
  localContextLength?: number; // ローカルLLMに送るプロンプトの最大文字数（未設定時は既定値を使用）
  temperature: number;
  maxTokens: number;
  /** 創造ポイント（Phase C）の提案を有効にするか。未設定は有効（true）扱い。 */
  creativePointsEnabled?: boolean;
  /** 先回りバックグラウンド生成（Phase D）を有効にするか。未設定/false は無効（OFF）扱い＝オプトイン。 */
  preemptiveGenerationEnabled?: boolean;
  /** リキャップ（前回までのあらすじ）の表示条件。'gap'=前回から48時間以上空いたら / 'always'=毎回 / 'off'=表示しない。未設定は 'gap' 扱い。 */
  recapMode?: 'always' | 'gap' | 'off';
  /** リキャップのAIナレーションを自動生成するか。未設定/false は手動ボタン（API課金のためオプトイン）。 */
  recapAutoNarrative?: boolean;
  /** 関連情報検索（RAG）を有効にするか。未設定/false は無効（OFF）扱い＝オプトイン。 */
  ragEnabled?: boolean;
  /** 埋め込みベクトルのプロバイダ（Phase 2）。'auto'=チャットプロバイダに追随。未設定は 'auto' 扱い。 */
  ragEmbeddingProvider?: 'auto' | 'openai' | 'gemini' | 'local' | 'none';
  /** ローカルLLMの埋め込みモデル名（Phase 2、例: nomic-embed-text）。 */
  ragLocalEmbeddingModel?: string;
  /** AI利用の工程を作品ごとに数えるか（投稿時のAI利用区分の説明用）。未設定は有効（true）扱い。プロンプト本文は保存しない。 */
  recordAIUsageTally?: boolean;
}

/**
 * AI呼び出しの「工程」。投稿サイトのAI利用区分（なろう4区分・カクヨム3タグ）を
 * 説明できるようにするための記録用で、プロンプトの内容や解析経路には影響しない。
 *
 * 重要: AIRequest.type は「プロンプト種別」であり工程ではない（例: AI校正は type='draft'）。
 * 区分の判定に type を流用すると校正を本文生成と誤って申告しかねないため、
 * 工程は purpose として明示的に渡す。未指定は「未分類」として扱い、推定はしない。
 */
export type AIUsagePurpose =
  | 'prose'      // 本文そのものの生成・書き換え（草案・続き・一括生成・リライト）
  | 'proofread'  // 誤字脱字・表記ゆれの校正
  | 'review'     // 講評・批評・整合性チェック
  | 'plan'       // プロット・章立て・あらすじ・構成
  | 'setting'    // キャラクター・世界観・用語集・伏線
  | 'analysis'   // 要約・分析・リキャップ・What-If
  | 'chat';      // 相談・チャット

export interface AIRequest {
  prompt: string;
  context?: string;
  type: 'character' | 'plot' | 'synopsis' | 'chapter' | 'draft' | 'world' | 'foreshadowing' | 'evaluation' | 'imageToStory' | 'audioToStory' | 'audioImageToStory';
  settings: AISettings;
  /** 利用記録の集計単位。未指定の呼び出しは作品別サマリーに現れない */
  projectId?: string;
  /** 工程（AI利用区分の説明用）。未指定は「未分類」として記録され、type からは推定しない */
  purpose?: AIUsagePurpose;
  /** 本文生成がどの章に対するものかの記録用（開示サマリーで章数を示すのに使う） */
  chapterId?: string;
  image?: string; // Base64エンコードされた画像データ（data:image/...形式）
  audio?: string; // Base64エンコードされた音声データ（data:audio/...形式）
  onStream?: (chunk: string) => void; // ストリーミング用のコールバック
  signal?: AbortSignal; // 中断用のシグナル
  timeout?: number; // タイムアウト時間（ミリ秒）。全章生成など長時間かかる処理で使用
  maxPromptLength?: number; // プロンプトのサニタイズ上限（文字数）。未指定時は既定の10000。インポート/要約など大入力パイプラインで明示的に引き上げる
  systemPrompt?: string; // システムプロンプトの上書き。未指定時は既定の創作支援用 SYSTEM_PROMPT。小説取り込みなど「忠実抽出（創作禁止）」タスクで分析用プロンプトに差し替える
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface ImageItem {
  id: string;
  url: string; // Base64 URL または Blob URL（後方互換性のため）
  imageId?: string; // Blobストレージの画像ID（新形式）
  title: string;
  description?: string;
  category: 'reference' | 'character' | 'setting' | 'mood' | 'other';
  addedAt: Date;
}

// OpenAI API レスポンス型
export interface OpenAIRequestBody {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
  temperature?: number; // リーズニング系モデル（GPT-5系 / o1・o3・o4系）は temperature 非対応のため省略可能
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    delta?: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIErrorResponse {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
}

// Claude API レスポンス型
export interface ClaudeRequestBody {
  model: string;
  max_tokens: number;
  temperature?: number; // 一部の新しいモデル（opus 4.7/4.8 など）は temperature 非対応のため省略可能
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image';
      text?: string;
      source?: {
        type: 'base64';
        media_type: string;
        data: string;
      };
    }>;
  }>;
  stream?: boolean;
}

export interface ClaudeResponse {
  content: Array<{
    text: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeStreamEvent {
  type: 'content_block_delta';
  delta?: {
    text: string;
  };
}

export interface ClaudeErrorResponse {
  error: {
    message: string;
    type?: string;
  };
}

// Gemini API レスポンス型
export interface GeminiRequestBody {
  contents: Array<{
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }>;
  }>;
  systemInstruction: {
    parts: Array<{
      text: string;
    }>;
  };
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
}

export interface GeminiSafetyRating {
  category: string;
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  blocked?: boolean;
}

export interface GeminiPromptFeedback {
  blockReason?: string;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiCandidate {
  content: {
    parts: Array<{
      text: string;
    }>;
  };
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
}

export interface GeminiErrorResponse {
  error: {
    message: string;
    code?: number;
  };
}

// Local LLM API レスポンス型（OpenAI互換形式をサポート）
export interface LocalLLMRequestBody {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
  temperature: number;
  max_tokens: number;
  stream?: boolean;
}

export interface LocalLLMResponse {
  choices?: Array<{
    message: {
      content: string;
    };
    delta?: {
      content: string;
    };
  }>;
  content?: string;
  response?: string;
  error?: string;
}

export interface LocalLLMErrorResponse {
  error: {
    message: string;
  };
}