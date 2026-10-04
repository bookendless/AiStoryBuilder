import { describe, it, expect } from 'vitest';
import { AIStreamDecoder, responseMetadata } from '../../services/aiResponseMetadata';

describe('AI response completion metadata', () => {
  it.each([
    [{ choices: [{ finish_reason: 'length' }] }, 'length'],
    [{ stop_reason: 'max_tokens' }, 'length'],
    [{ stop_reason: 'end_turn' }, 'stop'],
    [{ candidates: [{ finishReason: 'SAFETY' }] }, 'blocked'],
    [{ candidates: [{ finishReason: 'STOP' }] }, 'stop'],
    [{ choices: [{ finish_reason: 'content_filter' }] }, 'blocked'],
    [{}, 'unknown'],
  ])('normalizes completion without assuming success', (data, expected) => {
    expect(responseMetadata(data).finishReason).toBe(expected);
  });
  it('handles SSE split in the middle of escaped strings and terminal events', () => {
    const decoder = new AIStreamDecoder();
    const wire = 'data: '+JSON.stringify({ choices: [{ delta: { content: '本文「\\"」' } }] })+'\n\ndata: '+JSON.stringify({ choices: [{ finish_reason: 'length' }], usage: { prompt_tokens: 3, completion_tokens: 8, total_tokens: 11 } })+'\n\ndata: [DONE]\n';
    const parts: string[] = [];
    for (const c of wire) parts.push(...decoder.push(c));
    expect(parts.join('')).toBe('本文「\\"」');
    expect(decoder.finish()).toMatchObject({ finishReason: 'length', usage: { totalTokens: 11 } });
  });
  it('reads Gemini arrays and ignores thinking parts', () => {
    const d = new AIStreamDecoder();
    expect(d.push(JSON.stringify([{ candidates: [{ content: { parts: [{ text: '秘密', thought: true }, { text: '本文' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } }]))).toEqual(['本文']);
    expect(d.finish()).toMatchObject({ finishReason: 'stop', usage: { totalTokens: 7 } });
  });
  it('merges Claude usage across start and end events', () => {
    const d = new AIStreamDecoder();
    d.push(JSON.stringify({ message: { usage: { input_tokens: 9, output_tokens: 0 } } }));
    d.push(JSON.stringify({ delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 4 } }));
    expect(d.finish()).toMatchObject({ finishReason: 'stop', usage: { totalTokens: 13 } });
  });
  it('rejects interrupted JSON instead of calling it complete', () => {
    const d = new AIStreamDecoder(); d.push('{"choices":');
    expect(() => d.finish()).toThrow('途中');
  });
  it('rejects error terminal events while retaining already received usage', () => {
    const d = new AIStreamDecoder();
    d.push(JSON.stringify({ usage: { input_tokens: 9 } }));
    expect(() => d.push(JSON.stringify({ type: 'error', error: { message: 'overloaded' } }))).toThrow('overloaded');
    expect(d.snapshot().usage?.promptTokens).toBe(9);
  });
});
