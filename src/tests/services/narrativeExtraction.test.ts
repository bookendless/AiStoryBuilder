import { describe, expect, it, vi } from 'vitest';
import { extractNarrativeDelta, narrativeChunks, parseNarrativeDelta } from '../../services/narrative/extract';
import { emptyDelta, emptyState, itemsOf } from '../../services/narrative/state';
import type { NarrativeExtractionJob } from '../../types/narrative';
import { narrativeProject } from './narrativeFixtures';

describe('chapter extraction', () => {
  it('covers a 50K+ chapter through the last quotation', async () => {
    const p = narrativeProject(); p.chapters[0].draft = '長い旅の記録。'.repeat(7000) + '最後の鍵を置いた。';
    const chunks = narrativeChunks(p.chapters[0].draft, 6000);
    expect(chunks[0].start).toBe(0); expect(chunks[chunks.length - 1].end).toBe(p.chapters[0].draft.length);
    expect(chunks.every((c, i) => !i || c.start <= chunks[i - 1].end)).toBe(true);
    const run = vi.fn(async (prompt: string) => ({ finishReason: 'stop' as const, content: JSON.stringify({ ...emptyDelta(), addEvents: prompt.includes('最後の鍵を置いた。') ? [{ description: '鍵を置いた', characterIds: ['a'], quote: '最後の鍵を置いた。', interpretation: 'fact' }] : [] }) }));
    const result = await extractNarrativeDelta(p, 'c1', { run, budget: 28000, onCheckpoint: async () => {} });
    expect(result.delta.addEvents[0].source.end).toBe(p.chapters[0].draft.length);
    expect(run).toHaveBeenCalledTimes(chunks.length);
  });
  it('resumes saved chunks without calling the model for them again', async () => {
    const p = narrativeProject(); p.chapters[0].draft = '長い旅の記録。'.repeat(1600);
    const controller = new AbortController(); let checkpoint: NarrativeExtractionJob | undefined;
    const run = vi.fn(async () => ({ content: JSON.stringify(emptyDelta()), finishReason: 'stop' as const }));
    await expect(extractNarrativeDelta(p, 'c1', { run, budget: 28000, signal: controller.signal, onCheckpoint: async j => { checkpoint = j; if (j.finished === 1) controller.abort(); } })).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
    await extractNarrativeDelta(p, 'c1', { run, budget: 28000, previousJob: checkpoint, onCheckpoint: async () => {} });
    expect(run).toHaveBeenCalledTimes(checkpoint!.chunks.length);
  });
  it('repairs invalid JSON once, refuses truncation, and does not call the model for missing prior state', async () => {
    const p = narrativeProject();
    const run = vi.fn(async () => ({ content: 'broken', finishReason: 'stop' as const }));
    await expect(extractNarrativeDelta(p, 'c1', { run, budget: 28000, onCheckpoint: async () => {} })).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(2);
    run.mockClear();
    await expect(extractNarrativeDelta(p, 'c2', { run, budget: 28000, onCheckpoint: async () => {} })).rejects.toThrow('確認');
    expect(run).not.toHaveBeenCalled();
    const partial = vi.fn(async () => ({ content: JSON.stringify(emptyDelta()), finishReason: 'length' as const }));
    await expect(extractNarrativeDelta(p, 'c1', { run: partial, budget: 28000, onCheckpoint: async () => {} })).rejects.toThrow('未完成');
    expect(partial).toHaveBeenCalledTimes(1);
  });
  it('rejects invented quotes and unknown fields, flags flashbacks for review', () => {
    const p = narrativeProject();
    const wire = { ...emptyDelta(), characterChanges: [{ characterId: 'a', field: 'location', operation: 'set', values: [{ text: '港' }], quote: '港にいた。', interpretation: 'flashback' }] };
    const result = parseNarrativeDelta(JSON.stringify(wire), p, 'c1', emptyState(), 0, 100);
    expect(itemsOf(result)[0].warnings.length).toBeGreaterThan(0);
    wire.characterChanges[0].quote = '存在しない引用';
    expect(() => parseNarrativeDelta(JSON.stringify(wire), p, 'c1', emptyState(), 0, 100)).toThrow('引用');
    expect(() => parseNarrativeDelta(JSON.stringify({ ...emptyDelta(), unexpected: [] }), p, 'c1', emptyState(), 0, 100)).toThrow('未知');
  });
});
