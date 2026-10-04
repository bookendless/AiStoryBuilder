import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiService } from '../../services/aiService';
import { httpService } from '../../services/httpService';
import { getMaxOutputTokens } from '../../services/providers';
import type { AISettings } from '../../types/ai';
vi.mock('../../services/httpService', () => ({ httpService: { post: vi.fn(), postStream: vi.fn() } }));
vi.mock('../../services/aiCostService', () => ({ recordUsage: vi.fn() }));
vi.mock('../../utils/securityUtils', async original => ({ ...await original<typeof import('../../utils/securityUtils')>(), decryptApiKeyAsync: vi.fn(async (s: string) => s) }));
const settings = (provider: string, model: string): AISettings => ({ provider, model, apiKey: 'test-key', maxTokens: 999999, temperature: 0, localEndpoint: 'http://localhost:1234', recordAIUsageTally: false });
const payload = (provider: string, reason = 'stop', text: string | null = '本文') => provider === 'claude'
  ? { content: [{ type: 'thinking', thinking: '思考' }, { type: 'text', text }, { type: 'text', text: '続き' }], stop_reason: reason === 'stop' ? 'end_turn' : reason }
  : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: '思考', thought: true }, { text }, { text: '続き' }] }, finishReason: reason === 'stop' ? 'STOP' : reason }] }
    : { choices: [{ message: { content: text }, finish_reason: reason }] };
const sse = (events: unknown[]) => events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
describe('model request and completion compatibility', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ['openai', 'gpt-6-astra', false, 'max_completion_tokens'], ['openai', 'gpt-6-sol', false, 'max_completion_tokens'],
    ['openai', 'gpt-6-luna', false, 'max_completion_tokens'], ['openai', 'o1', false, 'max_completion_tokens'],
    ['openai', 'gpt-4o', true, 'max_tokens'], ['openai', 'gpt-6-sol-2026-09-27', false, 'max_completion_tokens'],
    ['claude', 'claude-opus-5-5', false, 'max_tokens'], ['claude', 'claude-haiku-4-5-20251001', true, 'max_tokens'],
    ['grok', 'grok-4.7', true, 'max_tokens'], ['local', 'gpt-6-sol', true, 'max_tokens'],
  ])('%s/%s uses the correct budget and temperature in text, image and stream requests', async (provider, model, temperature, tokenKey) => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: payload(provider) } as never);
    vi.mocked(httpService.postStream).mockImplementation(async (_url, _body, onChunk) => onChunk(provider === 'claude'
      ? sse([{ type: 'content_block_delta', delta: { text: '本文' } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }])
      : sse([{ choices: [{ delta: { content: '本文' }, finish_reason: 'stop' }] }])));
    for (const image of [undefined, 'data:image/png;base64,YQ==']) for (const stream of [false, true]) {
      // Local accepts text only; that transport deliberately rejects image input.
      if (provider === 'local' && image) continue;
      const response = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider, model), retryLimit: 0, image, onStream: stream ? vi.fn() : undefined });
      expect(response.error).toBeUndefined();
      const calls = (stream ? vi.mocked(httpService.postStream) : vi.mocked(httpService.post)).mock.calls;
      const body = calls[calls.length - 1][1] as Record<string, unknown>;
      expect(body[tokenKey]).toBe(getMaxOutputTokens(provider, model));
      expect(body.temperature).toBe(temperature ? 0 : undefined);
      if (provider === 'openai') {
        expect(body[tokenKey === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens']).toBeUndefined();
        expect(body.stream_options).toEqual(stream ? { include_usage: true } : undefined);
      }
    }
  });
  it.each(['claude', 'gemini'])('%s joins all visible parts and excludes thoughts', async provider => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: payload(provider) } as never);
    expect(await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider, 'test'), retryLimit: 0 })).toMatchObject({ content: '本文続き', finishReason: 'stop', error: undefined });
  });
  it.each([false, true])('Gemini text/image requests clamp maxOutputTokens (stream=%s)', async stream => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: payload('gemini') } as never);
    vi.mocked(httpService.postStream).mockImplementation(async (_url, _body, onChunk) => { for (const c of JSON.stringify([payload('gemini')])) onChunk(c); });
    const response = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings('gemini', 'gemini-3.8-flash'), image: 'data:image/png;base64,YQ==', retryLimit: 0, onStream: stream ? vi.fn() : undefined });
    expect(response.error).toBeUndefined(); expect(response.content).toBe('本文続き');
    const calls = (stream ? vi.mocked(httpService.postStream) : vi.mocked(httpService.post)).mock.calls;
    const body = calls[calls.length - 1][1] as { generationConfig: { maxOutputTokens: number; temperature: number } };
    expect(body.generationConfig).toMatchObject({ maxOutputTokens: getMaxOutputTokens('gemini', 'gemini-3.8-flash'), temperature: 0 });
  });
  it.each([['claude', 'max_tokens', 'length'], ['claude', 'refusal', 'blocked'], ['gemini', 'MAX_TOKENS', 'length'], ['gemini', 'SAFETY', 'blocked'], ['openai', 'length', 'length'], ['openai', 'content_filter', 'blocked']])('%s/%s retains partial text and reports failure', async (provider, reason, finishReason) => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: payload(provider, reason) } as never);
    const result = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider, 'test'), retryLimit: 0 });
    expect(result.content).toContain('本文'); expect(result.finishReason).toBe(finishReason); expect(result.error).toBeTruthy();
  });
  it('rejects OpenAI reasoning-only budget exhaustion and retains usage', async () => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: { ...payload('openai', 'length', null), usage: { prompt_tokens: 2, completion_tokens: 100, total_tokens: 102 } } } as never);
    const result = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings('openai', 'gpt-6-sol'), retryLimit: 0 });
    expect(result).toMatchObject({ content: '', finishReason: 'length', usage: { totalTokens: 102 } }); expect(result.error).toContain('思考');
  });
  it.each(['claude', 'openai', 'gemini', 'grok', 'local'])('%s keeps text when a later event in the same chunk fails', async provider => {
    const textEvent = provider === 'claude' ? { type: 'content_block_delta', delta: { text: '受信済み' } }
      : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: '受信済み' }] } }] }
        : { choices: [{ delta: { content: '受信済み' } }] };
    vi.mocked(httpService.postStream).mockImplementation(async (_url, _body, onChunk) => onChunk(sse([textEvent, { type: 'error', error: { message: 'overloaded' } }])));
    const onStream = vi.fn();
    const result = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider, 'test'), retryLimit: 0, onStream });
    expect(result.content).toBe('受信済み'); expect(result.error).toBeTruthy(); expect(onStream).toHaveBeenCalledWith('受信済み');
  });
  it.each(['max_tokens', 'refusal'])('Claude stream %s is not a completed generation', async reason => {
    vi.mocked(httpService.postStream).mockImplementation(async (_url, _body, onChunk) => {
      for (const c of sse([{ type: 'content_block_delta', delta: { thinking: '秘密' } }, { type: 'content_block_delta', delta: { text: '本文' } }, { type: 'message_delta', delta: { stop_reason: reason } }])) onChunk(c);
    });
    const result = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings('claude', 'claude-opus-5-5'), retryLimit: 0, onStream: vi.fn() });
    expect(result.content).toBe('本文'); expect(result.error).toBeTruthy();
  });
});
