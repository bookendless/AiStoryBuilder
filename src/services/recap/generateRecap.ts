/**
 * リキャップ（前回までのあらすじ）のAI生成
 *
 * 章ダイジェストは summarizeChapters の通常モード（AI呼び出し0回）で作り、
 * ナレーション＋提案の生成でAIを1回だけ呼ぶ。結果は呼び出し側がキャッシュする。
 */

import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import { RecapAIContent } from '../../types/recap';
import { summarizeChapters } from '../summarization/summarizeChapters';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { parseJsonLoose } from '../summarization/parseJson';
import { buildRecapPrompt } from '../prompts/recap';
import { computeResumePoint, getOpenForeshadowings } from './recapLocal';

interface GenerateRecapOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

/** プロンプト内で章ダイジェストに割り当てる最大文字数（指示文・他データ分を差し引いた安全枠） */
const DIGEST_MAX_CHARS = 6000;

export async function generateRecap(
    project: Project,
    options: GenerateRecapOptions
): Promise<RecapAIContent> {
    const { settings, run, signal } = options;

    // 章ダイジェスト（通常モード: Chapter.summary / 本文冒頭のフォールバック。AI呼び出しなし）
    const digests = await summarizeChapters(project.chapters, {
        detailed: false,
        settings,
        run,
        signal,
    });
    let digest = digests
        .map((d, i) => `第${i + 1}章「${d.title}」: ${d.summary}`)
        .join('\n');
    if (!digest.trim()) {
        digest = (project.synopsis ?? '').trim() || project.description || '（本文はまだありません）';
    }
    const budget = Math.min(getInputCharBudget(settings), DIGEST_MAX_CHARS);
    if (digest.length > budget) {
        digest = digest.substring(0, budget);
    }

    // 中断地点（ローカル計算）
    const resume = computeResumePoint(project);
    const resumeParts: string[] = [];
    if (resume.stepLabel) resumeParts.push(`最後に編集していた画面: ${resume.stepLabel}`);
    if (resume.lastDraftedChapterTitle) resumeParts.push(`最後に本文を書いた章: ${resume.lastDraftedChapterTitle}`);
    if (resume.nextChapterTitle) resumeParts.push(`次に本文を書く章: ${resume.nextChapterTitle}`);
    const resumeInfo = resumeParts.length > 0 ? resumeParts.join('\n') : '記録なし';

    // 未回収の伏線（多すぎる場合は重要度の高いものを優先して絞る）
    const open = getOpenForeshadowings(project);
    const importanceOrder = { high: 0, medium: 1, low: 2 } as const;
    const openText = open
        .slice()
        .sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance])
        .slice(0, 8)
        .map(f => `- ${f.title}: ${(f.description ?? '').substring(0, 80)}`)
        .join('\n') || 'なし';

    const prompt = buildRecapPrompt({
        title: project.title,
        genre: project.mainGenre || project.genre,
        digest,
        resumeInfo,
        openForeshadowings: openText,
    });

    const responseText = await run(prompt, { signal });
    const parsed = parseJsonLoose<{ narrative?: unknown; suggestions?: unknown }>(responseText);

    if (!parsed || typeof parsed.narrative !== 'string' || !parsed.narrative.trim()) {
        throw new Error('リキャップの生成結果を解析できませんでした');
    }

    const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map(s => s.trim())
            .slice(0, 3)
        : [];

    return { narrative: parsed.narrative.trim(), suggestions };
}
