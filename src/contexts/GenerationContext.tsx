import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';

/**
 * GenerationContext - 実行中のAI生成を一元管理するコンテキスト
 *
 * 目的:
 * - 各アシスタントパネルが個別に持っていたAbortControllerを集約し、
 *   コンポーネントのアンマウント（ステップ移動）で生成が自動キャンセルされる問題を解消する。
 * - 実行中の生成を常時可視化し、どこからでも任意のキャンセルを可能にする。
 *
 * 設計方針（AIContextとは分離）:
 * - 生成ロジック自体はパネル側に残す。ここではタスク状態とAbortControllerのみ所有する。
 * - タスクは key（プロジェクト+ステップ+種別）で識別し、同keyの再実行は前タスクをキャンセルして置換する。
 * - 経過時間は本コンテキストの状態に持たず、表示側で startedAt から算出する（状態の無駄な更新を防ぐ）。
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

interface StartTaskOptions {
  key: string;
  label: string;
  step?: string;
}

interface GenerationContextType {
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

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export const useGeneration = (): GenerationContextType => {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
};

const genId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const GenerationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  // id -> AbortController（状態に入れず ref で保持。abort呼び出し用）
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // 最新の tasks を同期参照するための ref（startTaskでの同key検索に使用）
  const tasksRef = useRef<GenerationTask[]>([]);
  tasksRef.current = tasks;

  // 内部: 指定idのタスクをabortして除去
  const abortAndRemove = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) {
      try {
        controller.abort();
      } catch {
        // abort失敗は無視
      }
      controllersRef.current.delete(id);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTask = useCallback(
    (opts: StartTaskOptions): { id: string; signal: AbortSignal } => {
      // 同keyの既存タスクをキャンセルして置換
      const existing = tasksRef.current.filter((t) => t.key === opts.key);
      for (const t of existing) {
        const controller = controllersRef.current.get(t.id);
        if (controller) {
          try {
            controller.abort();
          } catch {
            // 無視
          }
          controllersRef.current.delete(t.id);
        }
      }

      const id = genId();
      const controller = new AbortController();
      controllersRef.current.set(id, controller);

      const task: GenerationTask = {
        id,
        key: opts.key,
        label: opts.label,
        step: opts.step,
        status: 'running',
        startedAt: Date.now(),
        signal: controller.signal,
      };

      setTasks((prev) => [...prev.filter((t) => t.key !== opts.key), task]);

      return { id, signal: controller.signal };
    },
    []
  );

  const updateTask = useCallback(
    (id: string, patch: { label?: string; progress?: GenerationProgress }) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...(patch.label !== undefined ? { label: patch.label } : {}),
                ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
              }
            : t
        )
      );
    },
    []
  );

  const completeTask = useCallback((id: string) => {
    // 完了時はabortせずにcontroller参照のみ破棄して除去
    controllersRef.current.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const cancelTask = useCallback(
    (id: string) => {
      abortAndRemove(id);
    },
    [abortAndRemove]
  );

  // 呼び出しはイベントハンドラ前提（startTaskとは別フレーム）。effect内からstartTask直後に
  // 同期呼び出しする場合はtasksRefがstaleになるため、controllersRefベースの同期検索が必要。
  const cancelByKey = useCallback((key: string) => {
    const targets = tasksRef.current.filter((t) => t.key === key);
    for (const t of targets) {
      const controller = controllersRef.current.get(t.id);
      if (controller) {
        try {
          controller.abort();
        } catch {
          // 無視
        }
        controllersRef.current.delete(t.id);
      }
    }
    if (targets.length > 0) {
      const ids = new Set(targets.map((t) => t.id));
      setTasks((prev) => prev.filter((t) => !ids.has(t.id)));
    }
  }, []);

  const isKeyActive = useCallback(
    (key: string): boolean => tasks.some((t) => t.key === key),
    [tasks]
  );

  const getTaskByKey = useCallback(
    (key: string): GenerationTask | undefined => tasks.find((t) => t.key === key),
    [tasks]
  );

  const value = useMemo(
    () => ({
      tasks,
      startTask,
      updateTask,
      completeTask,
      cancelTask,
      cancelByKey,
      isKeyActive,
      getTaskByKey,
    }),
    [tasks, startTask, updateTask, completeTask, cancelTask, cancelByKey, isKeyActive, getTaskByKey]
  );

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
};
