import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from '../../services/aiService';
import { httpService } from '../../services/httpService';
import { AISettings } from '../../types/ai';

/**
 * 送信側の配線テスト。
 *
 * maxOutputTokens.test.ts はヘルパー単体とモデル表を検証するが、
 * aiService が実際にそのヘルパーを通しているかは見ていない。
 * 送信箇所が settings.maxTokens 直渡しに戻ると、ヘルパーのテストは全部通ったまま
 * コンテキスト長を出力上限として送る不具合が復活する。ここはその配線を押さえる。
 */

vi.mock('../../services/httpService', () => ({
  httpService: { post: vi.fn(), postStream: vi.fn() },
}));

// APIキーの復号だけ差し替える。サニタイズ等は本物を使う
vi.mock('../../utils/securityUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/securityUtils')>();
  return { ...actual, decryptApiKeyAsync: vi.fn(async (key: string) => key) };
});

const settingsFor = (provider: string, model: string, maxTokens: number): AISettings => ({
  provider,
  model,
  temperature: 0.7,
  maxTokens,
  apiKey: 'test-key',
  apiKeys: { openai: 'test-key', claude: 'test-key', gemini: 'test-key', grok: 'test-key' },
});

const lastRequestBody = () =>
  vi.mocked(httpService.post).mock.calls[0][1] as Record<string, unknown>;

describe('aiService が送る出力上限', () => {
  beforeEach(() => {
    vi.mocked(httpService.post).mockReset();
  });

  it('Claude: 設定値がモデルの出力上限を超えたらクランプして送る', async () => {
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data: { content: [{ type: 'text', text: 'ok' }] },
    } as Awaited<ReturnType<typeof httpService.post>>);

    // 1,000,000 は claude-opus-5 のコンテキスト長。出力上限として送ると400になる値
    await aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('claude', 'claude-opus-5', 1000000),
    });

    expect(lastRequestBody().max_tokens).toBe(128000);
  });

  it('Claude: 設定値が上限以下ならそのまま送る', async () => {
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data: { content: [{ type: 'text', text: 'ok' }] },
    } as Awaited<ReturnType<typeof httpService.post>>);

    await aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('claude', 'claude-opus-5', 3000),
    });

    expect(lastRequestBody().max_tokens).toBe(3000);
  });

  it('Gemini: generationConfig.maxOutputTokens をクランプして送る', async () => {
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
    } as Awaited<ReturnType<typeof httpService.post>>);

    // 2,000,000 は gemini-2.5-pro のコンテキスト長
    await aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('gemini', 'gemini-2.5-pro', 2000000),
    });

    const generationConfig = lastRequestBody().generationConfig as { maxOutputTokens: number };
    expect(generationConfig.maxOutputTokens).toBe(65536);
  });

  it('OpenAI: リーズニングモデルの max_completion_tokens もクランプして送る', async () => {
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data: { choices: [{ message: { content: 'ok' } }] },
    } as Awaited<ReturnType<typeof httpService.post>>);

    // o3 のコンテキスト長は 200,000、出力上限は 100,000
    await aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('openai', 'o3', 200000),
    });

    const body = lastRequestBody();
    expect(body.max_completion_tokens).toBe(100000);
    expect(body.max_tokens).toBeUndefined();
  });

  it('OpenAI: GPT-6系はリーズニングモデルとして max_completion_tokens を使い temperature を送らない', async () => {
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data: { choices: [{ message: { content: 'ok' } }] },
    } as Awaited<ReturnType<typeof httpService.post>>);

    // gpt-6-sol のコンテキスト長は 1,050,000、出力上限は 128,000
    await aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('openai', 'gpt-6-sol', 1050000),
    });

    const body = lastRequestBody();
    expect(body.max_completion_tokens).toBe(128000);
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });
});

describe('aiService の Claude 応答解析', () => {
  beforeEach(() => {
    vi.mocked(httpService.post).mockReset();
  });

  const respond = (data: unknown) =>
    vi.mocked(httpService.post).mockResolvedValue({
      status: 200,
      data,
    } as Awaited<ReturnType<typeof httpService.post>>);

  const generate = () =>
    aiService.generateContent({
      prompt: 'テスト',
      type: 'draft',
      settings: settingsFor('claude', 'claude-opus-5-5', 3000),
    });

  it('先頭が thinking ブロックでも本文の text ブロックを返す', async () => {
    // 思考が常時有効なモデルは display 既定（omitted）で空の thinking ブロックを先頭に返す
    respond({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: '本文' },
      ],
      stop_reason: 'end_turn',
    });

    const result = await generate();
    expect(result.error).toBeUndefined();
    expect(result.content).toBe('本文');
  });

  it('複数の text ブロックは連結して返す', async () => {
    respond({
      content: [
        { type: 'text', text: '前半' },
        { type: 'text', text: '後半' },
      ],
    });

    const result = await generate();
    expect(result.content).toBe('前半後半');
  });

  it('本文なしで refusal なら専用のエラーを返す', async () => {
    respond({ content: [], stop_reason: 'refusal' });

    const result = await generate();
    expect(result.content).toBe('');
    expect(result.error).toContain('安全上の理由');
  });

  it('思考だけで出力上限に達したら最大トークン数の見直しを促す', async () => {
    respond({
      content: [{ type: 'thinking', thinking: '', signature: 'sig' }],
      stop_reason: 'max_tokens',
    });

    const result = await generate();
    expect(result.content).toBe('');
    expect(result.error).toContain('最大出力トークン数');
  });
});
