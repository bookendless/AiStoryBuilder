import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Project } from '../../types/project';
import { NarrativeStatusSection } from '../../components/tools/narrative/NarrativeStatusSection';
import { accept, location, narrativeProject } from '../services/narrativeFixtures';

let current: Project;
vi.mock('../../contexts/useProject', () => ({ useProject: () => ({ currentProject: current }) }));
vi.mock('../../contexts/useGeneration', () => ({ useGeneration: () => ({ isKeyActive: () => false }) }));

const renderSection = (chapterId: string, onOpen = vi.fn()) => {
  render(<NarrativeStatusSection chapterId={chapterId} expanded onToggle={() => {}} onOpen={onOpen} />);
  return onOpen;
};

describe('NarrativeStatusSection', () => {
  beforeEach(() => { current = narrativeProject(); });
  afterEach(cleanup);

  it('explains that the feature is unused and opens the modal on the selected chapter', () => {
    current.narrativeMemory!.enabled = false;
    const onOpen = renderSection('c2');
    expect(screen.getByText('未使用')).toBeInTheDocument();
    expect(screen.getByText('現在は生成に使われていません。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /物語状態を設定/ }));
    expect(onOpen).toHaveBeenCalledWith('c2');
  });

  it('guides the author to the earlier chapter that blocks generation', () => {
    const onOpen = renderSection('c2');
    expect(screen.getByText('要確認')).toBeInTheDocument();
    expect(screen.getByText(/この章の生成に必要な「第一章」の状態が未確定です/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /「第一章」を確認/ }));
    expect(onOpen).toHaveBeenCalledWith('c1');
  });

  it('shows what is inherited by this chapter and offers to analyze it next', () => {
    current = accept(current, 'c1', location(current, 'c1', '港'));
    const onOpen = renderSection('c2');
    expect(screen.getByText('引き継ぎ中')).toBeInTheDocument();
    expect(screen.getByText('この章の生成に引き継ぐ状態: 人物 1・未解決 0・出来事 0件')).toBeInTheDocument();
    expect(screen.getByText(/この章は未解析です/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /この章を解析・確認/ }));
    expect(onOpen).toHaveBeenCalledWith('c2');
  });

  it('asks for the earlier chapter to be written when it has no draft yet', () => {
    current = { ...current, chapters: current.chapters.map(c => c.id === 'c1' ? { ...c, draft: '' } : c) };
    renderSection('c2');
    expect(screen.getByText(/「第一章」の本文がまだありません/)).toBeInTheDocument();
    expect(screen.getByText('本文を書いてから解析します')).toBeInTheDocument();
  });

  it('keeps the status badge visible while collapsed', () => {
    render(<NarrativeStatusSection chapterId="c2" expanded={false} onToggle={() => {}} onOpen={vi.fn()} />);
    expect(screen.getByText('要確認')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /「第一章」を確認/ })).not.toBeInTheDocument();
  });
});
