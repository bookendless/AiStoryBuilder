/**
 * 章単位のダイジェスト生成
 *
 * 通常モード: Chapter.summary をそのまま使用（AI呼び出し 0回）
 * 詳細モード: Chapter.draft を要約してダイジェスト化（章ごとに 1回）
 */

import { Chapter } from '../../types/project';
import { ChapterDigest, AIRunner, SequelProgress } from '../../types/sequel';
import { AISettings } from '../../types/ai';
import { getInputCharBudget, SUMMARIZATION_PROMPT_CAP } from './tokenBudget';
import { buildChapterSummaryPrompt } from '../prompts/sequel';

interface SummarizeOptions {
    detailed: boolean;
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

/**
 * 章配列からダイジェスト配列を生成する。
 */
export async function summarizeChapters(
    chapters: Chapter[],
    options: SummarizeOptions
): Promise<ChapterDigest[]> {
    const { detailed, settings, run, signal, onProgress } = options;
    const budget = getInputCharBudget(settings);
    const digests: ChapterDigest[] = [];

    for (let i = 0; i < chapters.length; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const chapter = chapters[i];
        const summary = (chapter.summary || '').trim();
        const body = (chapter.draft || '').trim();

        onProgress?.({ phase: '章の要約', current: i + 1, total: chapters.length });

        // 詳細モードかつ本文があり、サマリーだけでは情報が薄い場合に本文を要約
        if (detailed && body.length > 0) {
            // 本文が予算を超える場合は予算内に収めてから要約（章単体での簡易対策）
            const trimmedBody = body.length > budget ? body.substring(0, budget) : body;
            try {
                const result = await run(buildChapterSummaryPrompt(chapter.title, trimmedBody), { signal, maxPromptLength: SUMMARIZATION_PROMPT_CAP });
                digests.push({ id: chapter.id, title: chapter.title, summary: result.trim() || summary });
                continue;
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') throw error;
                // 要約失敗時はサマリーにフォールバック
                digests.push({ id: chapter.id, title: chapter.title, summary: summary || '（要約取得失敗）' });
                continue;
            }
        }

        // 通常モード: サマリーをそのまま使用（空なら本文の冒頭で補完）
        const fallback = summary || (body ? body.substring(0, 200) : '（内容なし）');
        digests.push({ id: chapter.id, title: chapter.title, summary: fallback });
    }

    return digests;
}
