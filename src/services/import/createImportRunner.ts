/**
 * 取り込みパイプライン用の AIRunner ファクトリ
 *
 * すべての取り込みAI呼び出し（本文要約・全体集約・概要抽出・キャラ抽出）が共有する。
 * ここで分析用システムプロンプト（IMPORT_SYSTEM_PROMPT）と大入力上限（maxPromptLength）を
 * 一元的に付与することで、既定の創作支援システムプロンプトによる創作・捏造を防ぐ。
 *
 * フック（useStoryImporter）から切り離してあるのは、systemPrompt の受け渡しを
 * 単体テストで固定できるようにするため。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { IMPORT_SYSTEM_PROMPT } from '../prompts/import';

export function createImportRunner(settings: AISettings, signal: AbortSignal): AIRunner {
    return async (prompt, opts) => {
        const response = await aiService.generateContent({
            prompt,
            type: 'synopsis',
            systemPrompt: IMPORT_SYSTEM_PROMPT,
            settings: {
                ...settings,
                temperature: opts?.temperature ?? settings.temperature,
            },
            signal: opts?.signal ?? signal,
            timeout: opts?.timeout ?? 180000,
            maxPromptLength: opts?.maxPromptLength,
        });
        // generateContent はエラー時に content='' / error=メッセージ を返す。
        // 黙って空文字を流すと抽出結果が空になるため、明示的に例外化してパイプラインを止める。
        if (response.error || !response.content?.trim()) {
            throw new Error(response.error || 'AIの応答が空でした');
        }
        return response.content;
    };
}
