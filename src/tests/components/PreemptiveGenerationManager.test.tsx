import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

/**
 * PreemptiveGenerationManager（Phase D トリガー）の「発火判断」ロジックを検証する。
 * usePreemptiveGenerator はモックし、startPreempt が正しい遷移でのみ呼ばれることを確認:
 * - ステップ離脱（edge-trigger）で SOURCE_TO_TARGET に従い後続を先回り
 * - 離脱元が未完了 / 後続が完了済み / 実行中 / 設定OFF / 未設定 では発火しない
 */

const startPreempt = vi.fn();
const completedSet = new Set<string>();
const isKeyActiveRef = { current: false };
const settingsRef = { current: { preemptiveGenerationEnabled: true } as { preemptiveGenerationEnabled?: boolean } };
const isConfiguredRef = { current: true };
const projectRef = { current: { id: 'p1' } as { id: string } | null };

vi.mock('../../contexts/ProjectContext', () => ({
  useProject: () => ({
    currentProject: projectRef.current,
    getStepCompletion: (_p: unknown, step: string) => completedSet.has(step),
  }),
}));
vi.mock('../../contexts/AIContext', () => ({
  useAI: () => ({ settings: settingsRef.current, isConfigured: isConfiguredRef.current }),
}));
vi.mock('../../contexts/GenerationContext', () => ({
  useGeneration: () => ({ isKeyActive: () => isKeyActiveRef.current }),
}));
vi.mock('../../components/preemptive/usePreemptiveGenerator', () => ({
  usePreemptiveGenerator: () => ({ startPreempt }),
}));

import { PreemptiveGenerationManager } from '../../components/preemptive/PreemptiveGenerationManager';
import { Step } from '../../types/common';

function renderAt(step: Step) {
  return render(<PreemptiveGenerationManager currentStep={step} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  completedSet.clear();
  isKeyActiveRef.current = false;
  settingsRef.current = { preemptiveGenerationEnabled: true };
  isConfiguredRef.current = true;
  projectRef.current = { id: 'p1' };
});

describe('PreemptiveGenerationManager', () => {
  it('plot2(完了)→synopsis(未完了) の離脱で synopsis を先回り', () => {
    completedSet.add('plot2');
    const { rerender } = renderAt('plot2');
    expect(startPreempt).not.toHaveBeenCalled(); // 初回は発火しない
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).toHaveBeenCalledWith('synopsis', 'p1');
  });

  it('synopsis(完了)→chapter, chapter(完了)→draft も対象', () => {
    completedSet.add('synopsis');
    const { rerender } = renderAt('synopsis');
    rerender(<PreemptiveGenerationManager currentStep="chapter" />);
    expect(startPreempt).toHaveBeenCalledWith('chapter', 'p1');

    startPreempt.mockClear();
    completedSet.clear();
    completedSet.add('chapter');
    const r2 = renderAt('chapter');
    r2.rerender(<PreemptiveGenerationManager currentStep="draft" />);
    expect(startPreempt).toHaveBeenCalledWith('draft', 'p1');
  });

  it('対象外の離脱元（home→plot1 等）では発火しない', () => {
    const { rerender } = renderAt('home');
    rerender(<PreemptiveGenerationManager currentStep="plot1" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });

  it('離脱元が未完了なら発火しない', () => {
    // plot2 未完了
    const { rerender } = renderAt('plot2');
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });

  it('後続が既に完了済みなら発火しない', () => {
    completedSet.add('plot2');
    completedSet.add('synopsis');
    const { rerender } = renderAt('plot2');
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });

  it('同keyが実行中なら二重起動しない', () => {
    completedSet.add('plot2');
    isKeyActiveRef.current = true;
    const { rerender } = renderAt('plot2');
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });

  it('設定OFFなら発火しない', () => {
    completedSet.add('plot2');
    settingsRef.current = { preemptiveGenerationEnabled: false };
    const { rerender } = renderAt('plot2');
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });

  it('AI未設定なら発火しない', () => {
    completedSet.add('plot2');
    isConfiguredRef.current = false;
    const { rerender } = renderAt('plot2');
    rerender(<PreemptiveGenerationManager currentStep="synopsis" />);
    expect(startPreempt).not.toHaveBeenCalled();
  });
});
