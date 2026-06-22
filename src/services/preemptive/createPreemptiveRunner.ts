/**
 * 先回りバックグラウンド生成（Phase D）用の AIRunner ファクトリ
 *
 * createSkeletonRunner と同型だが、生成対象ステップ（あらすじ/章立て/草案）に応じて
 * AIRequest の type を切り替える。各 generatePreemptive* が共有する。
 */

import { aiService } from '../aiService';
import { AIRunner } from '../../types/sequel';
import { AISettings, AIRequest } from '../../types/ai';

export function createPreemptiveRunner(
  settings: AISettings,
  signal: AbortSignal,
  type: AIRequest['type']
): AIRunner {
  return async (prompt, opts) => {
    const response = await aiService.generateContent({
      prompt,
      type,
      settings: {
        ...settings,
        temperature: opts?.temperature ?? settings.temperature,
      },
      signal: opts?.signal ?? signal,
      timeout: opts?.timeout ?? 180000,
      maxPromptLength: opts?.maxPromptLength,
    });
    // generateContent はエラー時に content='' / error=メッセージ を返す。
    // 黙って空文字を流すと結果が空になるため、明示的に例外化して先回りを止める。
    if (response.error || !response.content?.trim()) {
      throw new Error(response.error || 'AIの応答が空でした');
    }
    return response.content;
  };
}
