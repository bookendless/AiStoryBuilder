import { openaiProvider } from './openai';
import { claudeProvider } from './claude';
import { geminiProvider } from './gemini';
import { grokProvider } from './grok';
import { localProvider } from './local';
import { AIProvider } from '../../types/ai';

// AIプロバイダーの定義
export const AI_PROVIDERS: AIProvider[] = [
  openaiProvider,
  claudeProvider,
  geminiProvider,
  grokProvider,
  localProvider,
];

// Android環境チェック: ローカルLLMはAndroidでは使用不可
const isAndroidPlatform = typeof window !== 'undefined' &&
  (window as any).__TAURI_PLATFORM__ === 'android';

// Android環境ではローカルLLMプロバイダーを除外したリスト
export const AVAILABLE_PROVIDERS: AIProvider[] = isAndroidPlatform
  ? AI_PROVIDERS.filter(p => !p.isLocal)
  : AI_PROVIDERS;



















