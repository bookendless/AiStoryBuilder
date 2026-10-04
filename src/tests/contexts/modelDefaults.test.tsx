// Regression tests for startup selection and persisted settings.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { AIProvider } from '../../contexts/AIContext';
import { useAI } from '../../contexts/useAI';
vi.mock('../../utils/securityUtils', () => ({
  encryptApiKey: (key: string) => `encrypted:${key}`,
  encryptApiKeyAsync: async (key: string) => `encrypted:${key}`,
}));
vi.mock('../../services/storageService', () => ({ storageService: {
  migrateFromLocalStorage: vi.fn(async () => {}),
  loadApiKeys: vi.fn(async () => ({})),
  saveApiKeys: vi.fn(async () => {}),
} }));
const envs = ['VITE_OPENAI_API_KEY', 'VITE_CLAUDE_API_KEY', 'VITE_GEMINI_API_KEY', 'VITE_GROK_API_KEY', 'VITE_LOCAL_LLM_ENDPOINT'];
beforeEach(() => { localStorage.clear(); for (const key of envs) vi.stubEnv(key, ''); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
const mount = () => renderHook(() => useAI(), { wrapper: ({ children }) => <AIProvider>{children}</AIProvider> });
it.each([
  { keys: [] as string[], provider: 'openai', model: 'gpt-5.4-mini', configured: false },
  { keys: ['VITE_LOCAL_LLM_ENDPOINT'], provider: 'local', model: 'local-model', configured: true },
  { keys: ['VITE_CLAUDE_API_KEY', 'VITE_GEMINI_API_KEY', 'VITE_GROK_API_KEY'], provider: 'claude', model: 'claude-haiku-4-5-20251001', configured: true },
  { keys: ['VITE_GEMINI_API_KEY', 'VITE_GROK_API_KEY', 'VITE_LOCAL_LLM_ENDPOINT'], provider: 'gemini', model: 'gemini-3.8-flash', configured: true },
  { keys: ['VITE_GROK_API_KEY', 'VITE_LOCAL_LLM_ENDPOINT'], provider: 'grok', model: 'grok-4.7', configured: true },
  { keys: envs, provider: 'openai', model: 'gpt-5.4-mini', configured: true },
])('startup selection follows priority: $keys', async ({ keys, provider, model, configured }) => {
  for (const key of keys) vi.stubEnv(key, key === 'VITE_LOCAL_LLM_ENDPOINT' ? 'http://localhost:1234' : 'test-key');
  const { result } = mount();
  await waitFor(() => expect(result.current.isStorageReady).toBe(true));
  expect(result.current.settings).toMatchObject({ provider, model }); expect(result.current.isConfigured).toBe(configured);
});
it.each([['openai', 'gpt-6-sol-2026-09-27', 128000], ['grok', 'grok-4.6', 131072], ['local', 'custom-local-model', 8192]])('retains saved %s models and caps the restored output budget', (provider, model, cap) => {
  for (const key of envs) vi.stubEnv(key, 'test-key');
  localStorage.setItem('ai-settings', JSON.stringify({ provider, model, temperature: 0, maxTokens: 999999 }));
  const { result } = mount(); expect(result.current.settings).toMatchObject({ provider, model, temperature: 0, maxTokens: cap });
});
it.each([
  ['VITE_OPENAI_API_KEY', 'openai', 'gpt-5.4-mini'],
  ['VITE_CLAUDE_API_KEY', 'claude', 'claude-haiku-4-5-20251001'],
  ['VITE_GEMINI_API_KEY', 'gemini', 'gemini-3.8-flash'],
])('environment-only default %s', async (env, provider, model) => {
  vi.stubEnv(env, 'test-key');
  const { result } = mount();
  await waitFor(() => expect(result.current.settings.apiKeys?.[provider]).toBe('encrypted:test-key'));
  expect(result.current.settings).toMatchObject({ provider, model });
});
it('Grok-only environment selects Grok and is configured', async () => {
  vi.stubEnv('VITE_GROK_API_KEY', 'xai-test-key');
  const { result } = mount();
  await waitFor(() => expect(result.current.settings.apiKeys?.grok).toBe('encrypted:xai-test-key'));
  expect(result.current.settings).toMatchObject({ provider: 'grok', model: 'grok-4.7', apiKey: 'encrypted:xai-test-key' });
  expect(result.current.isConfigured).toBe(true);
});
it('OpenAI key currently takes precedence over the recommended Gemini provider', () => {
  vi.stubEnv('VITE_OPENAI_API_KEY', 'test-key');
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
  const { result } = mount();
  expect(result.current.settings.provider).toBe('openai');
});
it('saved Gemini 2.5 model is retained after the new-default change', () => {
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
  localStorage.setItem('ai-settings', JSON.stringify({ provider: 'gemini', model: 'gemini-2.5-flash', temperature: 0.7, maxTokens: 3000 }));
  const { result } = mount();
  expect(result.current.settings.model).toBe('gemini-2.5-flash');
});
it('saved temperature 0 survives reload', () => {
  localStorage.setItem('ai-settings', JSON.stringify({ provider: 'gemini', model: 'gemini-3.8-flash', temperature: 0, maxTokens: 3000 }));
  const { result } = mount();
  expect(result.current.settings.temperature).toBe(0);
});
