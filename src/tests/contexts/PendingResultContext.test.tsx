import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { PendingResultProvider, usePendingResult } from '../../contexts/PendingResultContext';

// useToast をモック（プロバイダは showSuccess/showInfo/showError を利用する）
const showSuccess = vi.fn();
const showInfo = vi.fn();
const showError = vi.fn();
vi.mock('../../components/Toast', () => ({
  useToast: () => ({ showSuccess, showInfo, showError }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(PendingResultProvider, null, children);

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
    const opts = showSuccess.mock.calls[0][2];
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
});
