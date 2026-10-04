import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpService } from '../../services/httpService';

describe('HttpService', () => {
  it('propagates caller cancellation during body reading and removes its listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    let started = false;
    vi.spyOn(window, 'fetch').mockImplementation(async (_url, options) => ({
      status: 200, statusText: 'OK', headers: new Headers(),
      text: () => new Promise<string>((_resolve, reject) => {
        started = true;
        options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    } as Response));
    const request = new HttpService().post('/cancel-body', {}, { signal: controller.signal });
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(started).toBe(true));
    controller.abort(); await assertion;
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps the timeout active while reading a browser response body', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'fetch').mockImplementation(async (_url, options) => {
      const signal = options?.signal;
      return {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: () => new Promise<string>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
      } as Response;
    });

    const request = new HttpService().request('/slow-body', { timeout: 20 });
    const assertion = expect(request).rejects.toMatchObject({ category: 'timeout', code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });
});
