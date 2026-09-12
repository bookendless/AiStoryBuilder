import type { Project } from '../types/project';

type SaveState = {
  generation: number;
  pending?: Project;
  timer?: ReturnType<typeof setTimeout>;
  tail: Promise<void>;
};

export interface ProjectSaveCoordinatorOptions {
  save: (project: Project) => Promise<void>;
  onSaveStart?: (projectId: string) => void;
  onSaveSuccess?: (projectId: string) => void;
  onSaveError?: (projectId: string, error: unknown) => void;
  delayMs?: number;
}

/**
 * プロジェクト単位で書き込みを直列化する。
 *
 * 各更新は最新世代だけを保存対象にし、保存中に更新された場合は必ずその後に
 * 最新世代を保存する。削除時は、先行する書き込みが終わってから削除を実行する。
 */
export class ProjectSaveCoordinator {
  private readonly states = new Map<string, SaveState>();
  private readonly deletedIds = new Set<string>();
  private readonly delayMs: number;

  constructor(private readonly options: ProjectSaveCoordinatorOptions) {
    this.delayMs = options.delayMs ?? 500;
  }

  activate(projectId: string): void {
    this.deletedIds.delete(projectId);
  }

  schedule(project: Project, immediate = false): Promise<void> {
    if (this.deletedIds.has(project.id)) {
      return Promise.reject(new Error('削除済みのプロジェクトは保存できません'));
    }

    const state = this.getState(project.id);
    state.generation += 1;
    state.pending = project;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    if (immediate) {
      return this.flush(project.id);
    }

    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.flush(project.id).catch(() => {
        // onSaveError で通知済み。非同期タイマーから未処理のrejectを出さない。
      });
    }, this.delayMs);
    return Promise.resolve();
  }

  async flush(projectId: string): Promise<void> {
    const state = this.states.get(projectId);
    if (!state || !state.pending || this.deletedIds.has(projectId)) return;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    const project = state.pending;
    const generation = state.generation;
    state.tail = state.tail.catch(() => undefined).then(async () => {
      // 待機中に新しい世代が予約済みなら、古いスナップショットは保存しない。
      if (this.deletedIds.has(projectId) || state.generation !== generation) return;

      this.options.onSaveStart?.(projectId);
      try {
        await this.options.save(project);
        if (state.generation === generation) {
          state.pending = undefined;
          this.options.onSaveSuccess?.(projectId);
        }
      } catch (error) {
        this.options.onSaveError?.(projectId, error);
        throw error;
      }
    });

    return state.tail;
  }

  async delete(projectId: string, remove: (id: string) => Promise<void>): Promise<void> {
    const state = this.getState(projectId);
    this.deletedIds.add(projectId);
    state.pending = undefined;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    // 先に始まった保存を待ち、その後に削除する。これで削除後の再作成を防ぐ。
    await state.tail.catch(() => undefined);
    await remove(projectId);
    this.states.delete(projectId);
  }

  private getState(projectId: string): SaveState {
    let state = this.states.get(projectId);
    if (!state) {
      state = { generation: 0, tail: Promise.resolve() };
      this.states.set(projectId, state);
    }
    return state;
  }
}
