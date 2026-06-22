/**
 * 骨組み生成パイプライン用の AIRunner ファクトリ（Phase B）
 *
 * createImportRunner（忠実抽出・分析用）とは異なり、こちらは創作タスクのため
 * 既定の創作支援システムプロンプト（SYSTEM_PROMPT）をそのまま使う。
 * すべての骨組みAI呼び出し（plot生成・キャラ生成・構成推定）が共有する。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

export function createSkeletonRunner(settings: AISettings, signal: AbortSignal): AIRunner {
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
        // generateContent はエラー時に content='' / error=メッセージ を返す。
        // 黙って空文字を流すと解析結果が空になるため、明示的に例外化してパイプラインを止める。
        if (response.error || !response.content?.trim()) {
            throw new Error(response.error || 'AIの応答が空でした');
        }
        return response.content;
    };
}
