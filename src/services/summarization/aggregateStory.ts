/**
 * 章ダイジェストを物語全体の要約に集約する（階層 fold reduce）
 *
 * 全ダイジェストを結合してコンテキスト予算内に収まれば1回で集約。
 * 超える場合は前半・後半に分割して再帰的に集約し、最後に統合する。
 */

import { ChapterDigest, AIRunner, SequelProgress } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { getInputCharBudget, SUMMARIZATION_PROMPT_CAP } from './tokenBudget';
import { buildAggregatePrompt } from '../prompts/sequel';

interface AggregateOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

function formatDigests(digests: ChapterDigest[]): string {
    return digests
        .map((d, idx) => `第${idx + 1}章「${d.title}」\n${d.summary}`)
        .join('\n\n');
}

/**
 * ダイジェスト配列を1つの全体要約テキストに集約する。
 */
export async function aggregateStory(
    digests: ChapterDigest[],
    options: AggregateOptions
): Promise<string> {
    if (digests.length === 0) return '';

    const { settings, run, signal, onProgress } = options;
    const budget = getInputCharBudget(settings);

    // 進捗カウンタ（再帰呼び出し全体での集約回数を概算表示）
    let done = 0;
    const estimatedTotal = Math.max(1, Math.ceil(digests.length / 8));

    const fold = async (items: ChapterDigest[], isPartial: boolean): Promise<string> => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const joined = formatDigests(items);

        // 予算内、または1要素まで分割済みなら集約実行
        if (joined.length <= budget || items.length <= 1) {
            // 単一の章ダイジェストが予算超過の場合（詳細モードで巨大な章など）は
            // これ以上分割できないため、予算内に収まるよう末尾を切り詰めてから渡す。
            const safe = joined.length > budget ? joined.substring(0, budget) : joined;
            onProgress?.({ phase: '全体要約の集約', current: Math.min(done + 1, estimatedTotal), total: estimatedTotal });
            const result = await run(buildAggregatePrompt(safe, isPartial), { signal, maxPromptLength: SUMMARIZATION_PROMPT_CAP });
            done++;
            return result.trim();
        }

        // 予算超過 → 半分に分割して各々を部分集約し、その結果を再度集約
        const mid = Math.ceil(items.length / 2);
        const left = await fold(items.slice(0, mid), true);
        const right = await fold(items.slice(mid), true);

        const merged: ChapterDigest[] = [
            { id: 'part-1', title: '前半', summary: left },
            { id: 'part-2', title: '後半', summary: right },
        ];
        onProgress?.({ phase: '全体要約の統合', current: estimatedTotal, total: estimatedTotal });
        const result = await run(buildAggregatePrompt(formatDigests(merged), false), { signal, maxPromptLength: SUMMARIZATION_PROMPT_CAP });
        return result.trim();
    };

    return fold(digests, false);
}
