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



















