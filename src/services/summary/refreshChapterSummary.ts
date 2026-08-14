/**
 * 章あらすじを本文から作り直す
 *
 * 失敗を握りつぶさないのが summarizeChapters との違い。あちらは一括パイプラインの
 * 途中で止まらないよう「（要約取得失敗）」等にフォールバックするが、こちらは
 * ユーザーが明示的に押した更新なので、失敗はそのまま伝えて保存しない
 * （フォールバック文字列を保存すると、それが正規のあらすじとして次章の文脈に混ざる）。
 */

import { Chapter } from '../../types/project/chapter';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import { buildChapterSummaryRefreshPrompt } from '../prompts/chapterSummary';
import { getInputCharBudget, SUMMARIZATION_PROMPT_CAP } from '../summarization/tokenBudget';
import { computeSummarySourceHash } from './freshness';

/** updateProject にそのまま重ねられる形の更新差分 */
export interface RefreshedSummary {
    summary: string;
    summarySourceHash: string;
}

export interface RefreshChapterSummaryOptions {
    settings: AISettings;
    run: AIRunner;
    /** AI利用記録用（未指定なら作品別サマリーに現れない） */
    projectId?: string;
    signal?: AbortSignal;
}

export async function refreshChapterSummary(
    chapter: Pick<Chapter, 'id' | 'title' | 'draft'>,
    options: RefreshChapterSummaryOptions
): Promise<RefreshedSummary> {
    const draft = (chapter.draft ?? '').trim();
    if (!draft) {
        throw new Error('本文がまだ無いため、あらすじを更新できません');
    }

    // AIに渡す本文は予算内に切り詰めるが、ハッシュは切り詰め前の全文から取る。
    // 「どの本文を見て確定したあらすじか」の同一性判定は全文で行いたいため（ここは意図的な非対称）。
    const budget = getInputCharBudget(options.settings);
    const body = draft.length > budget ? draft.slice(0, budget) : draft;

    const result = await options.run(buildChapterSummaryRefreshPrompt(chapter.title, body), {
        signal: options.signal,
        maxPromptLength: SUMMARIZATION_PROMPT_CAP,
        projectId: options.projectId,
        purpose: 'analysis',
        chapterId: chapter.id,
    });

    const summary = result.trim();
    if (!summary) {
        throw new Error('AIの応答が空でした');
    }

    return { summary, summarySourceHash: computeSummarySourceHash(draft) };
}
