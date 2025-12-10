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