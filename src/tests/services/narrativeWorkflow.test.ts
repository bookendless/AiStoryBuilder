import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractAndSaveNarrative } from '../../services/narrative/workflow';
import { aiService } from '../../services/aiService';
import { emptyDelta } from '../../services/narrative/state';
import { narrativeProject } from './narrativeFixtures';
import type { ProjectContextType } from '../../contexts/useProject';
import type { AIResponse } from '../../types/ai';
vi.mock('../../services/aiService', () => ({ aiService: { generateContent: vi.fn() } }));
const settings = { provider: 'local', model: 'm', maxTokens: 1000, temperature: 0.5, localContextLength: 12000 };

describe('durable extraction workflow', () => {
  beforeEach(() => vi.clearAllMocks());
  it('does not call the AI when the initial save fails', async () => {
    const p = narrativeProject();
    const commit = vi.fn<ProjectContextType['commitProjectUpdate']>(async () => { throw new Error('保存失敗'); });
    await expect(extractAndSaveNarrative(p.id, 'c1', settings, commit, () => p, new AbortController().signal)).rejects.toThrow('保存失敗');
    expect(aiService.generateContent).not.toHaveBeenCalled();
  });
  it('persists checkpoints and a proposal without silently approving the chapter', async () => {
    let p = narrativeProject(); const saved: typeof p[] = [];
    const commit: ProjectContextType['commitProjectUpdate'] = async change => { p = { ...p, ...change(p) }; saved.push(structuredClone(p)); return { project: p, generation: saved.length }; };
    vi.mocked(aiService.generateContent).mockResolvedValue({ content: JSON.stringify(emptyDelta()), finishReason: 'stop' });
    await extractAndSaveNarrative(p.id, 'c1', settings, commit, () => p, new AbortController().signal);
    expect(saved[0].narrativeMemory!.jobs).toEqual([]);
    expect(saved.some(p => p.narrativeMemory!.jobs[0]?.finished === 1)).toBe(true);
    expect(saved[saved.length - 1].narrativeMemory!.proposals).toHaveLength(1);
    expect(p.narrativeMemory!.records).toEqual([]);
  });
  it.each(['edit', 'switch', 'cancel'])('rejects a late extraction result after %s', async action => {
    let p = narrativeProject(); let finish!: (response: AIResponse) => void;
    const controller = new AbortController();
    const commit: ProjectContextType['commitProjectUpdate'] = async (change, id) => {
      if (p.id !== id) throw new Error('作品が切り替わりました');
      p = { ...p, ...change(p) }; return { project: p, generation: 1 };
    };
    vi.mocked(aiService.generateContent).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const work = extractAndSaveNarrative(p.id, 'c1', settings, commit, () => p, controller.signal);
    const assertion = expect(work).rejects.toThrow();
    await vi.waitFor(() => expect(aiService.generateContent).toHaveBeenCalledOnce());
    if (action === 'edit') p = { ...p, chapters: p.chapters.map(c => c.id === 'c1' ? { ...c, draft: '最新本文' } : c) };
    if (action === 'switch') p = { ...p, id: 'another-project' };
    if (action === 'cancel') controller.abort();
    finish({ content: JSON.stringify(emptyDelta()), finishReason: 'stop' });
    await assertion;
    expect(p.narrativeMemory!.proposals).toEqual([]);
  });
});
