/**
 * 章あらすじ再生成用の AIRunner ファクトリ（createRecapRunner と同型）
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

export function createSummaryRunner(settings: AISettings, signal?: AbortSignal): AIRunner {
    return async (prompt, opts) => {
        const response = await aiService.generateContent({
            prompt,
            type: 'chapter',
            settings: {
                ...settings,
                // あらすじは本文の要約であって創作ではないため、既定より低い温度で振れ幅を抑える
                temperature: opts?.temperature ?? Math.min(settings.temperature, 0.4),
            },
            signal: opts?.signal ?? signal,
            timeout: opts?.timeout ?? 120000,
            maxPromptLength: opts?.maxPromptLength,
            projectId: opts?.projectId,
            purpose: opts?.purpose,
            chapterId: opts?.chapterId,
        });
        // generateContent はエラー時に content='' / error=メッセージ を返すため明示的に例外化する
        if (response.error || !response.content?.trim()) {
            throw new Error(response.error || 'AIの応答が空でした');
        }
        return response.content;
    };
}
