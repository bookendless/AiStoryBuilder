import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import type { Project } from '../../types/project';
import { ProjectSaveCoordinator } from '../../services/projectSaveCoordinator';
import { NarrativeStatePanel } from '../../components/tools/NarrativeStatePanel';
import { deriveNarrativeState } from '../../services/narrative/state';
import { location, narrativeProject, proposal } from '../services/narrativeFixtures';

const listeners = new Set<() => void>();
let current: Project;
let failSave = false;
let coordinator: ProjectSaveCoordinator;
let db: Dexie;
const publish = (p: Project) => { current = p; listeners.forEach(f => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const getProject = () => current;
const commit = async (update: (p: Project) => Partial<Project>, id: string) => {
  if (current.id !== id) throw new Error('project changed');
  publish({ ...current, ...update(current) });
  await coordinator.schedule(current, true);
  return { project: current, generation: coordinator.getGeneration(id) };
};
const showError = vi.fn(), showSuccess = vi.fn(), cancelByKey = vi.fn();
vi.mock('../../contexts/useProject', () => ({ useProject: () => ({ currentProject: useSyncExternalStore(subscribe, getProject), getCurrentProject: getProject, commitProjectUpdate: commit }) }));
vi.mock('../../contexts/useAI', () => ({ useAI: () => ({ settings: {}, isConfigured: false }) }));
vi.mock('../../contexts/useGeneration', () => ({ useGeneration: () => ({ startTask: vi.fn(), completeTask: vi.fn(), cancelByKey, isKeyActive: () => false }) }));
vi.mock('../../components/useToast', () => ({ useToast: () => ({ showError, showSuccess }) }));

describe('author narrative review persistence', () => {
  beforeEach(async () => {
    vi.clearAllMocks(); failSave = false;
    db = new Dexie(`narrative-review-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); db.version(1).stores({ projects: 'id' });
    current = narrativeProject(); const p = proposal(current, 'c1', location(current, 'c1', '港')); p.decisions['location:c1'] = 'pending'; current.narrativeMemory!.proposals.push(p);
    await db.table('projects').put(current);
    coordinator = new ProjectSaveCoordinator({ save: async p => { if (failSave) throw new Error('保存容量が不足しています'); await db.table('projects').put(p); } });
  });
  afterEach(async () => { cleanup(); await db.delete(); });
  it('retains the decision across a database reload and confirms only after durable storage', async () => {
    const first = render(<NarrativeStatePanel isOpen onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '章の状態を確定' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '採用' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '章の状態を確定' })).toBeEnabled());
    first.rerender(<NarrativeStatePanel isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('radio', { name: '採用' })).not.toBeInTheDocument();
    first.rerender(<NarrativeStatePanel isOpen onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: '採用' })).toBeChecked();
    first.unmount();
    current = await db.table('projects').get('p1') as Project;
    render(<NarrativeStatePanel isOpen onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: '採用' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '章の状態を確定' }));
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('章の状態を保存・確定しました'));
    const reloaded = await db.table('projects').get('p1') as Project;
    expect(deriveNarrativeState(reloaded, 'c2').state.characters.a.location?.[0].text).toBe('港');
  });
  it('keeps a retry action after storage failure and does not duplicate approved records', async () => {
    current.narrativeMemory!.proposals[0].decisions['location:c1'] = 'accept';
    render(<NarrativeStatePanel isOpen onClose={() => {}} />);
    failSave = true;
    fireEvent.click(screen.getByRole('button', { name: '章の状態を確定' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('保存容量が不足しています'));
    expect(showSuccess).not.toHaveBeenCalled();
    expect((await db.table('projects').get('p1') as Project).narrativeMemory!.records).toHaveLength(0);
    failSave = false;
    fireEvent.click(screen.getByRole('button', { name: '確定内容の保存を再試行' }));
    await waitFor(() => expect(showSuccess).toHaveBeenCalled());
    expect((await db.table('projects').get('p1') as Project).narrativeMemory!.records).toHaveLength(1);
  });
  it('disables adoption after another editor changes the underlying chapter', async () => {
    render(<NarrativeStatePanel isOpen onClose={() => {}} />);
    act(() => publish({ ...current, chapters: current.chapters.map(c => c.id === 'c1' ? { ...c, draft: '編集後の本文' } : c) }));
    expect(screen.getByRole('button', { name: '章の状態を確定' })).toBeDisabled();
    expect(screen.getByText(/本文・設定・前章の確定状態が変わっています/)).toBeInTheDocument();
  });
  it('persists author corrections with a required reason and resets the decision', async () => {
    render(<NarrativeStatePanel isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '修正する' }));
    fireEvent.change(screen.getByLabelText('値'), { target: { value: '岸辺' } });
    expect(screen.getByRole('button', { name: '修正を保存して未判断に戻す' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('作者の修正理由（必須）'), { target: { value: '港の手前の岸辺を指す描写のため' } });
    fireEvent.click(screen.getByRole('button', { name: '修正を保存して未判断に戻す' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '修正する' })).toBeEnabled());
    const reloaded = await db.table('projects').get('p1') as Project;
    expect(reloaded.narrativeMemory!.proposals[0].delta.characterChanges[0]).toMatchObject({ values: [{ text: '岸辺', source: { kind: 'author', reason: '港の手前の岸辺を指す描写のため' } }] });
    expect(reloaded.narrativeMemory!.proposals[0].decisions['location:c1']).toBe('pending');
  });
});

describe('opening from the draft sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    current = narrativeProject();
    coordinator = new ProjectSaveCoordinator({ save: async () => {} });
  });
  afterEach(cleanup);
  it('shows the chapter requested by the sidebar', () => {
    const view = render(<NarrativeStatePanel isOpen={false} onClose={() => {}} initialChapterId="c2" />);
    view.rerender(<NarrativeStatePanel isOpen onClose={() => {}} initialChapterId="c2" />);
    expect(screen.getByRole('combobox', { name: '状態を確認する章' })).toHaveValue('c2');
  });
  it('keeps a running analysis when unmounted and stops it only when the project changes', () => {
    const view = render(<NarrativeStatePanel isOpen={false} onClose={() => {}} />);
    act(() => publish({ ...current, id: 'p2' }));
    expect(cancelByKey).toHaveBeenCalledWith('p1:narrative:extract');
    cancelByKey.mockClear();
    view.unmount();
    expect(cancelByKey).not.toHaveBeenCalled();
  });
});
