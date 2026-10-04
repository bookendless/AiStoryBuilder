import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import { HttpService } from '../../services/httpService';
const respond = (body: ReadableStream<Uint8Array>) => vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, status: 200, body } as unknown as Response);
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('stream response lifetime', () => {
  it('decodes multibyte text split at every byte and releases the reader on success', async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { for (const b of new TextEncoder().encode('本文😀')) c.enqueue(new Uint8Array([b])); c.close(); } });
    respond(body); const onChunk = vi.fn<(text: string) => void>();
    await new HttpService().postStream('/stream', {}, onChunk);
    expect(onChunk.mock.calls.map(c => c[0]).join('')).toBe('本文😀'); expect(body.locked).toBe(false);
  });
  it.each(['timeout', 'cancel'])('aborts and releases a stalled reader on %s', async mode => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('途中')); }, cancel });
    respond(body); const controller = new AbortController(); const remove = vi.spyOn(controller.signal, 'removeEventListener'); const onChunk = vi.fn();
    const work = new HttpService().postStream('/stream', {}, onChunk, { timeout: 20, signal: controller.signal });
    const assertion = mode === 'timeout' ? expect(work).rejects.toMatchObject({ code: 'TIMEOUT' }) : expect(work).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0); expect(onChunk).toHaveBeenCalledWith('途中');
    if (mode === 'cancel') controller.abort(); else await vi.advanceTimersByTimeAsync(20);
    await assertion; expect(cancel).toHaveBeenCalled(); expect(body.locked).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function)); expect(onChunk).toHaveBeenCalledTimes(1);
  });
  it('cancels and releases the reader when the response parser throws', async () => {
    const cancel = vi.fn(); const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('bad')); }, cancel });
    respond(body);
    await expect(new HttpService().postStream('/stream', {}, () => { throw new Error('invalid SSE'); })).rejects.toThrow('invalid SSE');
    expect(cancel).toHaveBeenCalled(); expect(body.locked).toBe(false);
  });
});
