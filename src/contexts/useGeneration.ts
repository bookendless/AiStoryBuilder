import { createContext, useContext } from 'react';

/**
 * GenerationContext の型定義・Contextオブジェクト・参照フック
 *
 * Provider（GenerationContext.tsx）はコンポーネント専用ファイルに保つ必要があるため、
 * 非コンポーネントのexportを本ファイルへ分離している。
 *
 * 注意: 本ファイルを vi.mock でフルモックすると Context オブジェクトも潰れ、Provider が壊れる。
 * フックのみ差し替える場合は vi.importActual で元モジュールをスプレッドして維持すること。
 */

// 章ごとの進捗（AILoadingIndicatorと同形）
export interface GenerationChapterProgress {
  chapterId: string;
  chapterTitle: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

// バッチ生成などの進捗情報
export interface GenerationProgress {
  current: number;
  total: number;
  status?: string;
  chapters?: GenerationChapterProgress[];
}

export type GenerationStatus = 'running';

// 実行中の生成タスク
export interface GenerationTask {
  id: string;
  key: string; // 重複排除キー（例: `${projectId}:plot1:basic`）
  label: string; // 表示用ラベル（例: 「基本設定を生成中」）
  step?: string; // 生成元のステップ
  status: GenerationStatus;
  progress?: GenerationProgress;
  startedAt: number;
  signal: AbortSignal;
}

export interface StartTaskOptions {
  key: string;
  label: string;
  step?: string;
}

export interface GenerationContextType {
  tasks: GenerationTask[];
  /** 生成を開始しタスクを登録。同keyの既存タスクはキャンセルして置換。id と signal を返す */
  startTask: (opts: StartTaskOptions) => { id: string; signal: AbortSignal };
  /** ラベル/進捗の更新 */
  updateTask: (id: string, patch: { label?: string; progress?: GenerationProgress }) => void;
  /** 完了としてタスクを除去 */
  completeTask: (id: string) => void;
  /** 指定タスクをキャンセル（abort）して除去 */
  cancelTask: (id: string) => void;
  /** keyでタスクをキャンセルして除去 */
  cancelByKey: (key: string) => void;
  /** 指定keyのタスクが実行中か */
  isKeyActive: (key: string) => boolean;
  /** 指定keyの実行中タスクを取得 */
  getTaskByKey: (key: string) => GenerationTask | undefined;
}

export const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const useGeneration = (): GenerationContextType => {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};
