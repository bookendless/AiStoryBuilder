import React from 'react';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { AISettings } from '../../components/AISettings';
import { httpService } from '../../services/httpService';
import { aiService } from '../../services/aiService';
const state = vi.hoisted(() => ({ provider: 'claude', model: 'claude-opus-5-5', temperature: 0, maxTokens: 999999, apiKey: 'sk-ant-test-key',
  apiKeys: { openai: 'sk-test-key', claude: 'sk-ant-test-key', gemini: 'test-key', grok: 'xai-test-key' },
}));
vi.mock('../../contexts/useAI', () => ({ useAI: () => ({ settings: state, updateSettings: vi.fn() }) }));
vi.mock('../../contexts/useProject', () => ({ useProject: () => ({ currentProject: null }) }));
vi.mock('../../components/useToast', () => ({ useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }));
vi.mock('../../hooks/useKeyboardNavigation', () => ({ useModalNavigation: () => ({ modalRef: null }) }));
vi.mock('../../contexts/useOverlayBackHandler', () => ({ useOverlayBackHandler: vi.fn() }));
vi.mock('../../components/common/Modal', () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../../services/rag', () => ({ ragStore: {}, reindexProject: vi.fn() }));
vi.mock('../../utils/securityUtils', async original => ({ ...await original<typeof import('../../utils/securityUtils')>(), decryptApiKeyAsync: async (key: string) => key, isEncryptedApiKey: () => false }));
vi.mock('../../services/httpService', () => ({ httpService: { post: vi.fn() } }));
vi.mock('../../services/aiCostService', () => ({ recordUsage: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); state.provider = 'claude'; state.model = 'claude-opus-5-5'; state.maxTokens = 999999; state.apiKeys.grok = 'xai-test-key'; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const mount = async () => {
  const result = render(<AISettings isOpen onClose={vi.fn()} />);
  await waitFor(() => expect((screen.getByPlaceholderText('APIキーを入力してください') as HTMLInputElement).value).toBe(state.apiKeys[state.provider as keyof typeof state.apiKeys]));
  return result;
};
it('thinking-only max_tokens fails the connection test instead of declaring AI success', async () => {
  vi.mocked(httpService.post).mockResolvedValue({ status: 200, data: { content: [{ type: 'thinking', thinking: '秘密' }], stop_reason: 'max_tokens' } } as never);
  await mount(); fireEvent.click(screen.getByRole('button', { name: '接続をテスト' }));
  await screen.findByText(/本文を出力する前に最大出力トークン数/);
  expect(screen.queryByText('接続と本文の生成を確認しました。')).toBeNull();
  expect((vi.mocked(httpService.post).mock.calls[0][1] as Record<string, unknown>).max_tokens).toBe(4096);
});
it.each([['openai', 'gpt-6-sol'], ['claude', 'claude-opus-5-5'], ['gemini', 'gemini-3.8-flash'], ['grok', 'grok-4.7']])('connection test uses the same %s generation path and unsaved key', async (provider, model) => {
  state.provider = provider; state.model = model;
  const generate = vi.spyOn(aiService, 'generateContent').mockResolvedValue({ content: 'こんにちは', finishReason: 'stop' });
  await mount();
  fireEvent.change(screen.getByPlaceholderText('APIキーを入力してください'), { target: { value: 'new-entered-key' } });
  fireEvent.click(screen.getByRole('button', { name: '接続をテスト' }));
  await screen.findByText('接続と本文の生成を確認しました。');
  const request = generate.mock.calls[0][0];
  expect(request.settings).toMatchObject({ provider, model, apiKey: 'new-entered-key', maxTokens: 4096, temperature: 0, recordAIUsageTally: false });
  expect(request.settings.apiKeys?.[provider]).toBe('new-entered-key'); expect(request.signal).toBeInstanceOf(AbortSignal);
});
it.each([['OpenAI', 'gpt-6-sol'], ['Google Gemini', 'gemini-3.8-flash'], ['xAI Grok', 'grok-4.7']])('changing provider %s selects its explicit default', async (name, model) => {
  await mount(); fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(model));
});
it('clicking the active provider retains the saved model', async () => {
  state.model = 'claude-haiku-4-5-20251001'; await mount();
  fireEvent.click(screen.getByRole('button', { name: /Anthropic Claude/ }));
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(state.model);
});
it('retains and displays a saved snapshot absent from the selectable model list', async () => {
  state.provider = 'openai'; state.model = 'gpt-6-sol-2026-09-27'; await mount();
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(state.model);
  expect(screen.getByRole('option', { name: /保存済みのモデル/ })).toBeInTheDocument();
});
it('does not reuse another provider key when switching to an unconfigured provider', async () => {
  state.apiKeys.grok = ''; await mount(); fireEvent.click(screen.getByRole('button', { name: /xAI Grok/ }));
  await waitFor(() => expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('grok-4.7'));
  expect((screen.getByPlaceholderText('APIキーを入力してください') as HTMLInputElement).value).toBe('');
});
it('connection tests respect a configured output budget below the test ceiling', async () => {
  state.maxTokens = 500;
  const generate = vi.spyOn(aiService, 'generateContent').mockResolvedValue({ content: 'こんにちは', finishReason: 'stop' });
  await mount(); fireEvent.click(screen.getByRole('button', { name: '接続をテスト' }));
  await screen.findByText('接続と本文の生成を確認しました。'); expect(generate.mock.calls[0][0].settings.maxTokens).toBe(500);
});
it.each(['model', 'close'])('a late test response cannot overwrite the %s state', async change => {
  let finish!: (response: { content: string; finishReason: 'stop' }) => void;
  const generate = vi.spyOn(aiService, 'generateContent').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = await mount(); fireEvent.click(screen.getByRole('button', { name: '接続をテスト' }));
  await waitFor(() => expect(generate).toHaveBeenCalled());
  if (change === 'close') view.rerender(<AISettings isOpen={false} onClose={vi.fn()} />);
  else fireEvent.change(screen.getByRole('combobox'), { target: { value: 'claude-haiku-4-5-20251001' } });
  await waitFor(() => expect(generate.mock.calls[0][0].signal?.aborted).toBe(true));
  finish({ content: '遅れて届いた本文', finishReason: 'stop' });
  await waitFor(() => expect(screen.queryByText('接続と本文の生成を確認しました。')).toBeNull());
});
