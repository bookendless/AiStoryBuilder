/**
 * What-if分岐レポートのAI生成
 *
 * 章ダイジェストは summarizeChapters の通常モード（AI呼び出し0回）で作り、
 * レポート生成でAIを1回だけ呼ぶ。設定台帳は整合性ガードの buildFactSheet を流用する。
 */

import { Project } from '../../types/project';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import { WhatIfBranchPoint, WhatIfReport } from '../../types/whatIf';
import { summarizeChapters } from '../summarization/summarizeChapters';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { parseJsonLoose } from '../summarization/parseJson';
import { buildFactSheet } from '../consistency/buildFactSheet';
import { getOpenForeshadowings } from '../recap/recapLocal';
import { buildWhatIfPrompt } from '../prompts/whatIf';
import { parseWhatIfReport } from './parseWhatIfReport';

interface GenerateWhatIfOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

/** ファクトシートの上限（本文ダイジェストに予算を残す） */
const FACT_SHEET_BUDGET = 2000;
/** ダイジェスト合計の上限 */
const DIGEST_MAX_CHARS = 5000;

const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
    friend: '友人',
    enemy: '敵対',
    family: '家族',
    romantic: '恋愛',
    mentor: '師弟',
    rival: 'ライバル',
    other: 'その他',
};

export async function generateWhatIfReport(
    project: Project,
    branchPoint: WhatIfBranchPoint,
    premise: string,
    options: GenerateWhatIfOptions
): Promise<WhatIfReport> {
    const { settings, run, signal } = options;

    // 分岐点で章を前後に分割（自由記述分岐は全章を波及対象にする）
    const branchIndex =
        branchPoint.type === 'chapter' && branchPoint.chapterId
            ? project.chapters.findIndex(c => c.id === branchPoint.chapterId)
            : -1;
    const beforeChapters = branchIndex >= 0 ? project.chapters.slice(0, branchIndex + 1) : [];
    const afterChapters = branchIndex >= 0 ? project.chapters.slice(branchIndex + 1) : project.chapters;

    const summarizeOptions = { detailed: false, settings, run, signal } as const;
    const beforeDigests = await summarizeChapters(beforeChapters, summarizeOptions);
    const afterDigests = await summarizeChapters(afterChapters, summarizeOptions);

    const chapterNumber = (id: string): number => project.chapters.findIndex(c => c.id === id) + 1;
    const formatDigests = (digests: { id: string; title: string; summary: string }[]): string =>
        digests.map(d => `第${chapterNumber(d.id)}章「${d.title}」: ${d.summary}`).join('\n');

    let digestBefore = formatDigests(beforeDigests);
    if (!digestBefore.trim()) {
        digestBefore = (project.synopsis ?? '').trim() || project.description || '（分岐点までの本文はありません）';
    }
    let digestAfter = formatDigests(afterDigests);

    // 予算内に切り詰め（前後合わせて上限。波及対象の後半を優先的に残す）
    const totalBudget = Math.min(getInputCharBudget(settings), DIGEST_MAX_CHARS);
    if (digestBefore.length + digestAfter.length > totalBudget) {
        const afterBudget = Math.min(digestAfter.length, Math.floor(totalBudget * 0.6));
        const beforeBudget = totalBudget - afterBudget;
        if (digestBefore.length > beforeBudget) digestBefore = digestBefore.substring(0, beforeBudget);
        if (digestAfter.length > afterBudget) digestAfter = digestAfter.substring(0, afterBudget);
    }

    // 未回収の伏線・関係性（ローカル計算）
    const openForeshadowings =
        getOpenForeshadowings(project)
            .slice(0, 8)
            .map(f => `- ${f.title}: ${(f.description ?? '').substring(0, 60)}`)
            .join('\n') || 'なし';

    const characterNames = new Map(project.characters.map(c => [c.id, c.name]));
    const relationships =
        (project.relationships ?? [])
            .slice(0, 12)
            .map(r => {
                const from = characterNames.get(r.from) ?? r.from;
                const to = characterNames.get(r.to) ?? r.to;
                const type = RELATIONSHIP_TYPE_LABELS[r.type] ?? r.type;
                return `- ${from} と ${to}: ${type}${r.description ? `（${r.description.substring(0, 40)}）` : ''}`;
            })
            .join('\n') || 'なし';

    const prompt = buildWhatIfPrompt({
        title: project.title,
        genre: project.mainGenre || project.genre,
        factSheet: buildFactSheet(project, FACT_SHEET_BUDGET),
        digestBefore,
        digestAfter,
        branchDescription: branchPoint.description,
        premise,
        openForeshadowings,
        relationships,
    });

    const responseText = await run(prompt, { signal });
    const report = parseWhatIfReport(parseJsonLoose(responseText), afterChapters);
    if (!report) {
        throw new Error('What-ifレポートの生成結果を解析できませんでした');
    }
    return report;
}
