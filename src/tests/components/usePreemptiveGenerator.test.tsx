import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AISettings } from '../../types/ai';
import { Chapter } from '../../types/project/chapter';

type MockChar = { id: string; name: string; role: string; appearance: string; personality: string; background: string };
type MockProject = {
  id: string;
  chapters: Chapter[];
  synopsis: string;
  plot: Record<string, unknown>;
  characters: MockChar[];
  writingStyle?: Record<string, unknown>;
  styleSample?: string;
};
const makeMockProject = (over: Partial<MockProject> = {}): MockProject => ({
  id: 'p1', chapters: [], synopsis: '', plot: { theme: 'A' }, characters: [], ...over,
});
type ProposeInput = {
  label: string;
  preview: unknown;
  onApply: () => void | Promise<void>;
  applySuccessMessage?: string;
};

/**
 * usePreemptiveGenerator（Phase D）の結線ロジックを検証する。
 * 重い実生成は services をモックし、フックの責務に集中する:
 * - supersede: 同keyの再実行で古い PendingResult を removeResult する
 * - 反映ガード: 反映時に対象プロジェクトが切り替わっていたら updateProject せず警告する
 */

// --- モック対象のスパイ ---
const settingsRef: { current: AISettings } = {
  current: { provider: 'local', model: 'm', temperature: 0.7, maxTokens: 100 },
};
const isConfiguredRef = { current: true };
const updateProject = vi.fn(async () => {});
const currentProjectRef: { current: MockProject } = { current: makeMockProject() };

let taskSeq = 0;
const startTask = vi.fn(() => ({ id: `task-${++taskSeq}`, signal: new AbortController().signal }));
const completeTask = vi.fn();

let resultSeq = 0;
const lastProposed: { input: ProposeInput | null } = { input: null };
const proposeResult = vi.fn((input: ProposeInput) => {
  lastProposed.input = input;
  return `pending-${++resultSeq}`;
});
const removeResult = vi.fn();
const showWarning = vi.fn();

vi.mock('../../contexts/AIContext', () => ({
  useAI: () => ({ settings: settingsRef.current, isConfigured: isConfiguredRef.current }),
}));
vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({ updateProject, currentProject: currentProjectRef.current }),
}));
vi.mock('../../contexts/GenerationContext', () => ({
  useGeneration: () => ({ startTask, completeTask, updateTask: vi.fn() }),
}));
vi.mock('../../contexts/PendingResultContext', () => ({
  usePendingResult: () => ({ proposeResult, removeResult }),
}));
vi.mock('../../components/Toast', () => ({
  useToast: () => ({ showWarning }),
}));
// 実生成サービスはモック（type別に結果を返す）
vi.mock('../../services/preemptive/createPreemptiveRunner', () => ({
  createPreemptiveRunner: () => async () => 'ai output',
}));
vi.mock('../../services/preemptive/generatePreemptiveSynopsis', () => ({
  generatePreemptiveSynopsis: async () => ({ kind: 'synopsis', synopsis: '先回りあらすじ' }),
}));
vi.mock('../../services/preemptive/generatePreemptiveChapters', () => ({
  generatePreemptiveChapters: async () => ({ kind: 'chapter', chapters: [{ id: 'x', title: 't', summary: 's' }] }),
}));
vi.mock('../../services/preemptive/generatePreemptiveDraft', () => ({
  generatePreemptiveDraft: async () => ({ kind: 'draft', chapterId: 'ch1', chapterTitle: '第1章', draft: '本文' }),
}));

import { usePreemptiveGenerator } from '../../components/preemptive/usePreemptiveGenerator';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  taskSeq = 0;
  resultSeq = 0;
  lastProposed.input = null;
  isConfiguredRef.current = true;
  currentProjectRef.current = makeMockProject();
});

describe('usePreemptiveGenerator', () => {
  it('未設定なら何もしない', async () => {
    isConfiguredRef.current = false;
    const { result } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(startTask).not.toHaveBeenCalled();
    expect(proposeResult).not.toHaveBeenCalled();
  });

  it('生成完了で proposeResult を呼び、completeTask する', async () => {
    const { result } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(startTask).toHaveBeenCalledTimes(1);
    expect(proposeResult).toHaveBeenCalledTimes(1);
    expect(proposeResult.mock.calls[0][0].label).toBe('先回り: あらすじ');
    expect(completeTask).toHaveBeenCalledTimes(1);
  });

  it('入力が変わった同keyの再実行で古い PendingResult を removeResult する（supersede）', async () => {
    const { result, rerender } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(proposeResult).toHaveBeenCalledTimes(1);
    expect(removeResult).not.toHaveBeenCalled();

    // 入力（plot）を変更してから再実行 → シグネチャが変わり作り直す
    currentProjectRef.current = makeMockProject({ plot: { theme: 'B（変更後）' } });
    rerender();
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(removeResult).toHaveBeenCalledWith('pending-1');
    expect(proposeResult).toHaveBeenCalledTimes(2);
  });

  it('入力が同じ同keyの再実行は何もしない（再課金しない）', async () => {
    const { result } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(startTask).toHaveBeenCalledTimes(1);
    expect(proposeResult).toHaveBeenCalledTimes(1);

    // 入力を変えずに再実行 → 生成しない
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    expect(startTask).toHaveBeenCalledTimes(1);
    expect(proposeResult).toHaveBeenCalledTimes(1);
    expect(removeResult).not.toHaveBeenCalled();
  });

  it('反映ガード: 対象プロジェクトが切替わっていたら updateProject せず警告', async () => {
    const { result, rerender } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    const onApply = lastProposed.input.onApply as () => Promise<void>;

    // 別プロジェクトを開いた状態に切替えて再レンダー（ref 更新）
    currentProjectRef.current = makeMockProject({ id: 'p2' });
    rerender();

    await act(async () => { await onApply(); });
    expect(updateProject).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledTimes(1);
  });

  it('反映ガード通過: 同一プロジェクトなら synopsis を updateProject する', async () => {
    const { result } = renderHook(() => usePreemptiveGenerator());
    act(() => result.current.startPreempt('synopsis', 'p1'));
    await flush();
    const onApply = lastProposed.input.onApply as () => Promise<void>;

    await act(async () => { await onApply(); });
    expect(updateProject).toHaveBeenCalledWith({ synopsis: '先回りあらすじ' }, true);
  });
});
