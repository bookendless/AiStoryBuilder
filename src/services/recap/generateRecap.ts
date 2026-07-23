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
import { ensureIndexFresh, retrieveRecapSummaries } from '../rag';

interface GenerateRecapOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

/** プロンプト内で章ダイジェストに割り当てる最大文字数（指示文・他データ分を差し引いた安全枠） */
const DIGEST_MAX_CHARS = 6000;

/** RAG選抜時に必ず含める直近章の数（リキャップは直近の展開が最重要） */
const RECENT_KEEP = 3;

/**
 * 章ごとのダイジェスト行から予算内のダイジェストを構成する。
 *
 * 直近 recentKeep 章は新しい順に必ず確保し、残り予算を関連度スコア順の過去章で埋める。
 * 出力は章順を維持し、選ばれなかった章の位置には「…（中略）…」を挟む。
 */
export function composeRecapDigest(
    lines: string[],
    scores: Map<number, number>,
    budget: number,
    recentKeep: number = RECENT_KEEP
): string {
    const selected = new Set<number>();
    let used = 0;
    const tryAdd = (index: number): boolean => {
        if (selected.has(index)) return true;
        const cost = lines[index].length + 1;
        if (used + cost > budget) return false;
        selected.add(index);
        used += cost;
        return true;
    };

    // 直近章を新しい順に確保
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - recentKeep); i--) {
        tryAdd(i);
    }

    // 残りをスコア順で埋める（スコアの無い章は候補外）
    const rankedIndices = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([index]) => index)
        .filter((index) => index >= 0 && index < lines.length);
    for (const index of rankedIndices) {
        tryAdd(index);
    }

    // 予算に余裕が残っていればスコアの無い章も新しい順に充填する
    // （全章が収まる規模なら結果的に全章が含まれ、従来の全量ダイジェストと一致する）
    for (let i = lines.length - 1; i >= 0; i--) {
        tryAdd(i);
    }

    const ordered = Array.from(selected).sort((a, b) => a - b);
    const parts: string[] = [];
    let prev = -1;
    for (const index of ordered) {
        if (index - prev > 1) parts.push('…（中略）…');
        parts.push(lines[index]);
        prev = index;
    }
    return parts.join('\n');
}

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
    const digestLines = digests.map((d, i) => `第${i + 1}章「${d.title}」: ${d.summary}`);
    let digest = digestLines.join('\n');
    if (!digest.trim()) {
        digest = (project.synopsis ?? '').trim() || project.description || '（本文はまだありません）';
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
    const openSorted = open
        .slice()
        .sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance])
        .slice(0, 8);
    const openText = openSorted
        .map(f => `- ${f.title}: ${(f.description ?? '').substring(0, 80)}`)
        .join('\n') || 'なし';

    // ダイジェストの予算超過処理:
    // RAG有効時は「直近章 + 再開地点・未回収伏線に関連する過去章」を選抜して章順に再構成する。
    // 無効時・失敗時は従来通り末尾を切り詰める。
    const budget = Math.min(getInputCharBudget(settings), DIGEST_MAX_CHARS);
    if (digest.length > budget) {
        let composed: string | null = null;
        if (settings.ragEnabled) {
            try {
                await ensureIndexFresh(project, undefined, signal);
                const recentChapters = project.chapters
                    .slice(-2)
                    .map(c => `${c.title}\n${c.summary ?? ''}`);
                const query = [
                    resume.lastDraftedChapterTitle ?? '',
                    resume.nextChapterTitle ?? '',
                    ...recentChapters,
                    ...openSorted.map(f => `${f.title} ${f.description ?? ''}`),
                ].filter(Boolean).join('\n');
                const ranked = await retrieveRecapSummaries(project, query);

                const chapterIndexById = new Map(project.chapters.map((c, i) => [c.id, i]));
                const scores = new Map<number, number>();
                for (const { chunk, score } of ranked) {
                    const index = chapterIndexById.get(chunk.sourceId);
                    if (index !== undefined) {
                        scores.set(index, Math.max(scores.get(index) ?? 0, score));
                    }
                }
                composed = composeRecapDigest(digestLines, scores, budget);
            } catch (ragError) {
                console.warn('RAG検索に失敗したため従来のダイジェスト切り詰めを使用します:', ragError);
            }
        }
        digest = composed?.trim() ? composed : digest.substring(0, budget);
    }

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
