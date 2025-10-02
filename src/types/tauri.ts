// Tauri API の型定義

export interface Project {
  id: string;
  title: string;
  description?: string;
  characters: Character[];
  plot?: Plot;
  synopsis?: string;
  chapters: Chapter[];
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  name: string;
  age?: number;
  description: string;
  role: string;
  personality: string;
  background: string;
}

export interface Plot {
  id: string;
  title: string;
  genre: string;
  theme: string;
  setting: string;
  conflict: string;
  resolution: string;
  acts: Act[];
}

export interface Act {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  word_count: number;
}

export interface AIConfig {
  provider: string;
  api_key?: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

// Tauri API コマンドの型定義
export interface TauriAPI {
  create_project: (title: string, description?: string) => Promise<Project>;
  get_projects: () => Promise<Project[]>;
  get_project: (project_id: string) => Promise<Project>;
  update_project: (project_id: string, project: Project) => Promise<Project>;
  delete_project: (project_id: string) => Promise<void>;
  generate_ai_content: (prompt: string, config: AIConfig) => Promise<string>;
  export_project: (project_id: string, format: string) => Promise<string>;
}

// Tauri API の実装
declare global {
  interface Window {
    __TAURI__?: {
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    };
  }
}

// ローカルLLMプロキシ用の型定義
export interface LocalLLMProxyRequest {
  endpoint: string;
  body: string;
  headers: Record<string, string>;
}

// API クライアント
export class TauriAPIClient implements TauriAPI {
  async create_project(title: string, description?: string): Promise<Project> {
    return window.__TAURI__.invoke('create_project', { title, description });
  }

  async get_projects(): Promise<Project[]> {
    return window.__TAURI__.invoke('get_projects');
  }

  async get_project(project_id: string): Promise<Project> {
    return window.__TAURI__.invoke('get_project', { project_id });
  }

  async update_project(project_id: string, project: Project): Promise<Project> {
    return window.__TAURI__.invoke('update_project', { project_id, project });
  }

  async delete_project(project_id: string): Promise<void> {
    return window.__TAURI__.invoke('delete_project', { project_id });
  }

  async generate_ai_content(prompt: string, config: AIConfig): Promise<string> {
    return window.__TAURI__.invoke('generate_ai_content', { prompt, config });
  }

  async export_project(project_id: string, format: string): Promise<string> {
    return window.__TAURI__.invoke('export_project', { project_id, format });
  }
}

// デフォルトのAPIクライアントインスタンス
export const tauriAPI = new TauriAPIClient();

