import { afterEach, expect, it, vi } from 'vitest';
import { retryApiCall } from '../../utils/apiUtils';
afterEach(() => vi.useRealTimers());
it.each(['success', 'failure'])('clears the timeout after %s', async mode => {
  vi.useFakeTimers();
  const result = retryApiCall(() => mode === 'success' ? Promise.resolve('ok') : Promise.reject(new Error('failed')), { retryConfig: { maxRetries: 0, baseDelay: 1, maxDelay: 1, backoffMultiplier: 1 } });
  if (mode === 'success') expect(await result).toBe('ok'); else await expect(result).rejects.toThrow('failed');
  expect(vi.getTimerCount()).toBe(0);
});
it('can delegate timeout ownership to an abortable transport', async () => {
  vi.useFakeTimers();
  let finish!: (text: string) => void;
  const result = retryApiCall(() => new Promise<string>(resolve => { finish = resolve; }), { timeout: 0 });
  await vi.advanceTimersByTimeAsync(30001); expect(vi.getTimerCount()).toBe(0);
  finish('partial retained'); expect(await result).toBe('partial retained');
});
