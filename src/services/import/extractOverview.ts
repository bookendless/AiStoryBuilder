/**
 * 概要フェーズ: 本文 → 全体要約 → 概要フィールド抽出
 *
 * 概要系フィールド（あらすじ・テーマ・プロット基本・ジャンル等）は、要約から抽出してよい
 * （損失があっても物語の骨子は保たれるため）。列挙系（キャラクター）は extractCharacters 側で
 * 全文を走査する。ここでは map（チャンク要約）→ reduce（aggregateStory）→ 概要抽出 を行う。
 */

import { ChapterDigest, AIRunner, SequelProgress } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { ImportOverview } from '../../types/import';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { aggregateStory } from '../summarization/aggregateStory';
import { parseJsonLoose } from '../summarization/parseJson';
import { chunkProse } from './chunkProse';
import { buildProseChunkSummaryPrompt, buildOverviewExtractPrompt } from '../prompts/import';
import { IMPORT_PROMPT_HARD_CAP } from './constants';

interface OverviewOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

/**
 * プローズ全体を要約して1つの全体要約テキストにまとめる。
 * チャンクごとに要約（map）し、複数あれば aggregateStory で集約（reduce）する。
 */
export async function buildStoryDigest(prose: string, options: OverviewOptions): Promise<string> {
    const { settings, run, signal, onProgress } = options;
    const budget = getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP);
    const chunks = chunkProse(prose, budget);
    if (chunks.length === 0) return '';

    const digests: ChapterDigest[] = [];
    for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        onProgress?.({ phase: '本文の要約', current: i + 1, total: chunks.length });
        const raw = await run(
            buildProseChunkSummaryPrompt(chunks[i].text, i + 1, chunks.length),
            { signal, temperature: 0.3, maxPromptLength: IMPORT_PROMPT_HARD_CAP }
        );
        digests.push({ id: `chunk-${i}`, title: `部分${i + 1}`, summary: raw.trim() });
    }

    // 単一チャンクならそのチャンク要約をそのまま全体要約とする
    if (digests.length === 1) return digests[0].summary;

    // 複数なら既存の階層 fold-reduce で集約（入力は要約済みで小さいため既定上限で十分）
    return aggregateStory(digests, { settings, run, signal, onProgress });
}

/**
 * 全体要約から概要フィールド（タイトル案・ジャンル・あらすじ・プロット基本）を抽出する。
 */
export async function extractOverview(storyDigest: string, options: OverviewOptions): Promise<ImportOverview> {
    const { run, signal } = options;

    const raw = await run(
        buildOverviewExtractPrompt(storyDigest),
        { signal, temperature: 0.3, maxPromptLength: IMPORT_PROMPT_HARD_CAP }
    );
    const parsed = parseJsonLoose<Partial<ImportOverview>>(raw);

    return {
        title: parsed?.title?.trim() || '',
        mainGenre: parsed?.mainGenre?.trim() || '',
        subGenre: parsed?.subGenre?.trim() || '',
        targetReader: parsed?.targetReader?.trim() || '',
        synopsis: parsed?.synopsis?.trim() || '',
        plot: {
            theme: parsed?.plot?.theme?.trim() || '',
            setting: parsed?.plot?.setting?.trim() || '',
            hook: parsed?.plot?.hook?.trim() || '',
            protagonistGoal: parsed?.plot?.protagonistGoal?.trim() || '',
            mainObstacle: parsed?.plot?.mainObstacle?.trim() || '',
        },
    };
}
