import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { PendingResultProvider } from '../../contexts/PendingResultContext';
import { usePendingResult } from '../../contexts/usePendingResult';
import { ProjectContext, ProjectContextType } from '../../contexts/useProject';

// useToast をモック（プロバイダは showSuccess/showInfo/showError を利用する）
const showSuccess = vi.fn();
const showInfo = vi.fn();
const showError = vi.fn();
vi.mock('../../components/useToast', () => ({
  useToast: () => ({ showSuccess, showInfo, showError }),
}));

const projectContext: ProjectContextType = {
  currentProject: null,
  setCurrentProject: vi.fn(),
  projects: [],
  setProjects: vi.fn(),
  updateProject: vi.fn(async () => {}),
  commitProjectUpdate: vi.fn(),
  getCurrentProject: vi.fn(() => null),
  createNewProject: vi.fn(),
  createSequelProject: vi.fn(),
  createImportedProject: vi.fn(),
  createBranchProject: vi.fn(),
  saveProject: vi.fn(),
  createManualBackup: vi.fn(),
  loadProject: vi.fn(),
  deleteProject: vi.fn(),
  duplicateProject: vi.fn(),
  loadAllProjects: vi.fn(),
  deleteChapter: vi.fn(),
  calculateProjectProgress: vi.fn(),
  getStepCompletion: vi.fn(),
  getPreviousAccess: vi.fn(),
};

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ProjectContext.Provider, { value: projectContext },
    React.createElement(PendingResultProvider, null, children)
  );

describe('PendingResultContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('proposeResult で保留に追加され、完了トーストが発火する', () => {
    const { result } = renderHook(() => usePendingResult(), { wrapper });

    act(() => {
      result.current.proposeResult({ label: '構成', preview: 'preview', onApply: vi.fn() });
    });

    expect(result.current.pendingResults).toHaveLength(1);
    expect(result.current.pendingResults[0].label).toBe('構成');
    // 完了トースト（「確認する」アクション付き、自動で消える一時通知）
    expect(showSuccess).toHaveBeenCalledTimes(1);
    const opts = showSuccess.mock.calls[0][2] as {
      persistent?: boolean;
      action: { label: string };
    };
    expect(opts.persistent).toBeFalsy();
    expect(opts.action.label).toBe('確認する');
  });

  it('applyResult で onApply が実行され、保留から除去される', async () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => usePendingResult(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.proposeResult({ label: 'あらすじ', preview: 'p', onApply });
    });

    await act(async () => {
      await result.current.applyResult(id);
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(result.current.pendingResults).toHaveLength(0);
  });

  it('生成元とは別のプロジェクトが開かれている結果を反映しない', async () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => usePendingResult(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.proposeResult({
        label: 'あらすじ', preview: 'p', projectId: 'source-project', onApply,
      });
    });

    await act(async () => { await result.current.applyResult(id); });

    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.pendingResults).toHaveLength(1);
    expect(showError).toHaveBeenCalledWith('生成元のプロジェクトを開いてから反映してください。');
  });

  it('discardResult では onApply は実行されず、保留から除去される', () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => usePendingResult(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.proposeResult({ label: '章立て', preview: 'p', onApply });
    });

    act(() => {
      result.current.discardResult(id);
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.pendingResults).toHaveLength(0);
    expect(showInfo).toHaveBeenCalled();
  });

  it('openResult / closeActive で activeResult が切り替わる', () => {
    const { result } = renderHook(() => usePendingResult(), { wrapper });

    let id = '';
    act(() => {
      id = result.current.proposeResult({ label: 'キャラ', preview: 'p', onApply: vi.fn() });
    });
    expect(result.current.activeResult).toBeNull();

    act(() => {
      result.current.openResult(id);
    });
    expect(result.current.activeResult?.id).toBe(id);

    act(() => {
      result.current.closeActive();
    });
    expect(result.current.activeResult).toBeNull();
    // 閉じても保留は残る
    expect(result.current.pendingResults).toHaveLength(1);
  });
  it('保存失敗では本文と理由を保持し、再試行が成功した後だけ除去する', async () => {
    const onApply = vi.fn().mockRejectedValueOnce(new Error('保存先に書き込めません')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePendingResult(), { wrapper });
    let id = '';
    act(() => { id = result.current.proposeResult({ label: '草案', preview: '全文', draftPreview: { oldText: '元', newText: '全文' }, onApply }); });
    await act(async () => { await result.current.applyResult(id); });
    expect(result.current.pendingResults[0].draftPreview?.newText).toBe('全文');
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('保存先に書き込めません'));
    await act(async () => { await result.current.applyResult(id); });
    expect(result.current.pendingResults).toHaveLength(0);
  });
  it('同時の適用操作でも保存処理を重複実行しない', async () => {
    let finish!: () => void;
    const onApply = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => usePendingResult(), { wrapper });
    let id = '';
    act(() => { id = result.current.proposeResult({ label: '草案', preview: '全文', onApply }); });
    let saving!: Promise<void>;
    await act(async () => { saving = result.current.applyResult(id); await result.current.applyResult(id); });
    expect(onApply).toHaveBeenCalledOnce();
    await act(async () => { finish(); await saving; });
  });
  it('送信制限で適用できない受信本文も確認用に保持する', async () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => usePendingResult(), { wrapper });
    let id = '';
    act(() => { id = result.current.proposeResult({ label: '草案', preview: '受信本文', applyBlockedReason: '受信が未完了です', onApply }); });
    await act(async () => { await result.current.applyResult(id); });
    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.pendingResults).toHaveLength(1);
  });
});
