/**
 * 1章分の整合性スキャン
 *
 * 章本文をトークン予算内に収めてAIに突き合わせを依頼する。長い章は chunkProse で
 * 分割し、各チャンクを個別にスキャンして統合する（quote の実在照合は常に章全文に対して行う）。
 */

import { Chapter } from '../../types/project';
import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import { ConsistencyCategory, ScannedIssue } from '../../types/consistency';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { parseJsonLoose } from '../summarization/parseJson';
import { chunkProse } from '../import/chunkProse';
import { buildConsistencyPrompt } from '../prompts/consistency';
import { validateIssues } from './validateIssues';

interface ScanChapterOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

/** 指示文＋JSONスキーマ分の概算文字数（本文予算から差し引く） */
const PROMPT_OVERHEAD_CHARS = 1500;
/** チャンク境界の指摘漏れを防ぐためのオーバーラップ */
const CHUNK_OVERLAP_CHARS = 200;
/** 本文予算の下限（極端に小さいと文脈が足りず誤検知が増えるため） */
const MIN_TEXT_BUDGET = 800;

/** 分析タスクのため低温度で実行する（創作的な揺らぎを抑える） */
const SCAN_TEMPERATURE = 0.2;

export async function scanChapter(
    chapter: Chapter,
    factSheet: string,
    categories: ConsistencyCategory[],
    options: ScanChapterOptions
): Promise<ScannedIssue[]> {
    const { settings, run, signal } = options;
    const text = (chapter.draft ?? '').trim();
    if (!text || categories.length === 0) return [];

    const textBudget = Math.max(
        MIN_TEXT_BUDGET,
        getInputCharBudget(settings) - factSheet.length - PROMPT_OVERHEAD_CHARS
    );
    const chunks = chunkProse(text, textBudget, CHUNK_OVERLAP_CHARS);

    const seen = new Set<string>();
    const issues: ScannedIssue[] = [];

    for (const chunk of chunks) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const prompt = buildConsistencyPrompt({
            chapterTitle: chapter.title,
            chapterText: chunk.text,
            factSheet,
            categories,
        });
        const responseText = await run(prompt, { signal, temperature: SCAN_TEMPERATURE });
        const parsed = parseJsonLoose(responseText);

        // quote の実在照合は章全文に対して行う（チャンクは全文の部分文字列なので包含関係が保たれる）
        for (const issue of validateIssues(parsed, text)) {
            const dedupeKey = `${issue.quote} ${issue.description}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            issues.push(issue);
        }
    }

    return issues;
}
