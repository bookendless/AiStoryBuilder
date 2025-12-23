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
  temperature: number;
  maxTokens: number;
}

export interface AIRequest {
  prompt: string;
  context?: string;
  type: 'character' | 'plot' | 'synopsis' | 'chapter' | 'draft' | 'world' | 'foreshadowing' | 'evaluation' | 'imageToStory' | 'audioToStory' | 'audioImageToStory';
  settings: AISettings;
  image?: string; // Base64エンコードされた画像データ（data:image/...形式）
  audio?: string; // Base64エンコードされた音声データ（data:audio/...形式）
  onStream?: (chunk: string) => void; // ストリーミング用のコールバック
  signal?: AbortSignal; // 中断用のシグナル
  timeout?: number; // タイムアウト時間（ミリ秒）。全章生成など長時間かかる処理で使用
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
  temperature: number;
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
  temperature: number;
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