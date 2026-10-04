import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aiService } from '../../services/aiService';
import { httpService } from '../../services/httpService';
import type { AISettings } from '../../types/ai';
vi.mock('../../services/httpService', () => ({ httpService: { post: vi.fn(), postStream: vi.fn() } }));
vi.mock('../../services/aiCostService', () => ({ recordUsage: vi.fn() }));
vi.mock('../../utils/securityUtils', async importOriginal => ({ ...await importOriginal<typeof import('../../utils/securityUtils')>(), decryptApiKeyAsync: vi.fn(async (s: string) => s) }));
const settings = (provider: string): AISettings => ({ provider, model: 'test-model', apiKey: 'test-key', maxTokens: 1000, temperature: 0.3, localEndpoint: 'http://localhost:1234', recordAIUsageTally: false });
const payload = (provider: string, reason: 'stop' | 'length') => provider === 'claude'
  ? { content: [{ type: 'text', text: '本文' }], stop_reason: reason === 'stop' ? 'end_turn' : 'max_tokens', usage: { input_tokens: 2, output_tokens: 3 } }
  : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: '本文' }] }, finishReason: reason === 'stop' ? 'STOP' : 'MAX_TOKENS' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 } }
    : { choices: [{ message: { content: '本文' }, finish_reason: reason }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } };
describe('AI metadata transport wiring', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['openai', 'claude', 'gemini', 'local', 'grok'])('%s preserves nonstream finish reason and usage', async provider => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: payload(provider, 'length') } as Awaited<ReturnType<typeof httpService.post>>);
    const response = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider), retryLimit: 0 });
    expect(response).toMatchObject({ content: '本文', finishReason: 'length', usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } });
  });
  it.each(['openai', 'claude', 'gemini', 'local', 'grok'])('%s handles arbitrarily fragmented streaming and terminal metadata', async provider => {
    const events = provider === 'claude'
      ? [{ type: 'message_start', message: { usage: { input_tokens: 2, output_tokens: 0 } } }, { type: 'content_block_delta', delta: { text: '本文' } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } }]
      : provider === 'gemini' ? [payload(provider, 'stop')]
        : [{ choices: [{ delta: { content: '本文' } }] }, { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }];
    const wire = provider === 'gemini' ? JSON.stringify(events) : events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('') + 'data: [DONE]\n';
    vi.mocked(httpService.postStream).mockImplementation(async (_url, _body, onChunk) => { for (const char of wire) onChunk(char); });
    const onStream = vi.fn();
    const response = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings(provider), retryLimit: 0, onStream });
    expect(onStream.mock.calls.map(c => c[0] as string).join('')).toBe('本文');
    expect(response).toMatchObject({ content: '本文', finishReason: 'stop', usage: { totalTokens: 5 } });
  });
  it('keeps refusal metadata for a Claude response with no text', async () => {
    vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: { content: [], stop_reason: 'refusal', usage: { input_tokens: 2, output_tokens: 0 } } } as Awaited<ReturnType<typeof httpService.post>>);
    const response = await aiService.generateContent({ prompt: '本文', type: 'draft', settings: settings('claude'), retryLimit: 0 });
    expect(response).toMatchObject({ content: '', finishReason: 'blocked', usage: { promptTokens: 2 } });
  });
});
