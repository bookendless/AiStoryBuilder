import { describe, expect, it } from 'vitest';
import { summarizeNarrativeStatus } from '../../services/narrative/state';
import { accept, location, narrativeProject, proposal } from './narrativeFixtures';

describe('summarizeNarrativeStatus', () => {
  it('reports off while the project has not enabled state tracking', () => {
    const p = narrativeProject();
    p.narrativeMemory!.enabled = false;
    expect(summarizeNarrativeStatus(p, 'c2', false)).toEqual({ kind: 'off' });
  });

  it('points to the first unconfirmed earlier chapter', () => {
    const p = narrativeProject();
    expect(summarizeNarrativeStatus(p, 'c2', false)).toEqual({ kind: 'blocked', chapterId: 'c1', hasDraft: true });
    const empty = { ...p, chapters: p.chapters.map(c => c.id === 'c1' ? { ...c, draft: '' } : c) };
    expect(summarizeNarrativeStatus(empty, 'c2', false)).toEqual({ kind: 'blocked', chapterId: 'c1', hasDraft: false });
  });

  it('summarizes the inherited state and marks the selected chapter as unanalyzed, pending or stale', () => {
    let p = accept(narrativeProject(), 'c1', location(narrativeProject(), 'c1', '港'));
    expect(summarizeNarrativeStatus(p, 'c2', false)).toEqual({ kind: 'ready', characters: 1, openRequirements: 0, events: 0, chapter: 'unanalyzed' });

    const pending = proposal(p, 'c2');
    p = { ...p, narrativeMemory: { ...p.narrativeMemory!, proposals: [...p.narrativeMemory!.proposals, pending] } };
    expect(summarizeNarrativeStatus(p, 'c2', false)).toMatchObject({ kind: 'ready', chapter: 'pending' });

    p = { ...p, chapters: p.chapters.map(c => c.id === 'c2' ? { ...c, draft: '書き直した本文' } : c) };
    expect(summarizeNarrativeStatus(p, 'c2', false)).toMatchObject({ kind: 'ready', chapter: 'stale' });
  });

  it('treats a chapter as confirmed only while its approved record is still current', () => {
    const base = accept(narrativeProject(), 'c1');
    const p = accept(base, 'c2');
    expect(summarizeNarrativeStatus(p, 'c2', false)).toMatchObject({ kind: 'ready', chapter: 'confirmed' });
    const edited = { ...p, chapters: p.chapters.map(c => c.id === 'c2' ? { ...c, draft: '確定後に編集' } : c) };
    expect(summarizeNarrativeStatus(edited, 'c2', false)).toMatchObject({ kind: 'ready', chapter: 'stale' });
    expect(summarizeNarrativeStatus(p, 'c3', false)).toMatchObject({ kind: 'ready', chapter: 'unanalyzed' });
  });

  it('shows progress of a running extraction only while the task is active', () => {
    const p = narrativeProject();
    p.narrativeMemory!.jobs.push({ chapterId: 'c1', signature: 's', status: 'running', finished: 1, chunks: [{ start: 0, end: 5 }, { start: 5, end: 10 }] });
    expect(summarizeNarrativeStatus(p, 'c2', true)).toEqual({ kind: 'running', chapterId: 'c1', finished: 1, total: 2 });
    // アプリ再起動後などで running のまま残ったジョブは、実行中として扱わない
    expect(summarizeNarrativeStatus(p, 'c2', false)).toEqual({ kind: 'blocked', chapterId: 'c1', hasDraft: true });
  });

  it('reports a starting analysis before its first checkpoint is stored', () => {
    expect(summarizeNarrativeStatus(narrativeProject(), 'c2', true)).toEqual({ kind: 'running', chapterId: 'c2', finished: 0, total: 0 });
  });
});
