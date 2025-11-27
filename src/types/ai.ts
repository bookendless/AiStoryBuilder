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
  apiKey?: string;
  localEndpoint?: string;
  temperature: number;
  maxTokens: number;
}

export interface AIRequest {
  prompt: string;
  context?: string;
  type: 'character' | 'plot' | 'synopsis' | 'chapter' | 'draft' | 'world';
  settings: AISettings;
  image?: string; // Base64エンコードされた画像データ（data:image/...形式）
  onStream?: (chunk: string) => void; // ストリーミング用のコールバック
  signal?: AbortSignal; // 中断用のシグナル
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
  url: string;
  title: string;
  description?: string;
  category: 'reference' | 'character' | 'setting' | 'mood' | 'other';
  addedAt: Date;
}