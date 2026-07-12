/**
 * What-ifシミュレーション用の AIRunner ファクトリ（createRecapRunner 等と同型）
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

export function createWhatIfRunner(settings: AISettings, signal: AbortSignal): AIRunner {
    return async (prompt, opts) => {
        const response = await aiService.generateContent({
            prompt,
            type: 'plot',
            settings: {
                ...settings,
                temperature: opts?.temperature ?? settings.temperature,
            },
            signal: opts?.signal ?? signal,
            timeout: opts?.timeout ?? 180000,
            maxPromptLength: opts?.maxPromptLength,
        });
        // generateContent はエラー時に content='' / error=メッセージ を返すため明示的に例外化する
        if (response.error || !response.content?.trim()) {
            throw new Error(response.error || 'AIの応答が空でした');
        }
        return response.content;
    };
}
