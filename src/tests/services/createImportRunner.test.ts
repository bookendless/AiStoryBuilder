import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImportRunner } from '../../services/import/createImportRunner';
import { IMPORT_SYSTEM_PROMPT } from '../../services/prompts/import';
import { aiService } from '../../services/aiService';
import { AISettings } from '../../types/ai';

// aiService をモック化（createImportRunner はこの generateContent を呼ぶ）
vi.mock('../../services/aiService', () => ({
    aiService: { generateContent: vi.fn() },
}));

const settings: AISettings = {
    provider: 'claude',
    model: 'claude-opus-4-8',
    temperature: 0.7,
    maxTokens: 1000,
};

describe('createImportRunner', () => {
    beforeEach(() => {
        vi.mocked(aiService.generateContent).mockReset();
    });

    it('分析用システムプロンプト(IMPORT_SYSTEM_PROMPT)を generateContent に渡す', async () => {
        vi.mocked(aiService.generateContent).mockResolvedValue({ content: 'ok' });
        const run = createImportRunner(settings, new AbortController().signal);
        await run('テストプロンプト', { temperature: 0.2, maxPromptLength: 30000 });

        expect(aiService.generateContent).toHaveBeenCalledTimes(1);
        const arg = vi.mocked(aiService.generateContent).mock.calls[0][0];
        // 創作支援用の既定プロンプトではなく、忠実抽出用の分析プロンプトが渡ること
        expect(arg.systemPrompt).toBe(IMPORT_SYSTEM_PROMPT);
        expect(arg.prompt).toBe('テストプロンプト');
        expect(arg.maxPromptLength).toBe(30000);
        expect(arg.settings.temperature).toBe(0.2);
    });

    it('応答が空文字ならエラーを投げる（黙ってパイプラインに空を流さない）', async () => {
        vi.mocked(aiService.generateContent).mockResolvedValue({ content: '' });
        const run = createImportRunner(settings, new AbortController().signal);
        await expect(run('x')).rejects.toThrow();
    });

    it('error フィールドがあればそのメッセージで例外化する', async () => {
        vi.mocked(aiService.generateContent).mockResolvedValue({ content: '', error: 'レート制限' });
        const run = createImportRunner(settings, new AbortController().signal);
        await expect(run('x')).rejects.toThrow('レート制限');
    });
});
