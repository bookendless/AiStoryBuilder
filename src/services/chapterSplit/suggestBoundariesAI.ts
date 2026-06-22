/**
 * 章境界のAI提案（任意・オンデマンド）
 *
 * AIは境界の「ロケータ」（章冒頭行の逐語コピー）だけを返し、オフセット解決と
 * スライスはコードが行う（splitDraft.ts）。長文は chunkProse でオーバーラップ0の
 * チャンクに分け、各チャンクのロケータを全文に対して順次解決する
 * （fromOffset を前進させることで同名見出しの重複にも対応）。
 *
 * ランナーは注入式（createImportRunner を渡す想定）。IMPORT_SYSTEM_PROMPT と
 * maxPromptLength はランナー側で付与される。
 */

import { AISettings } from '../../types/ai';
import { AIRunner } from '../../types/sequel';
import { parseJsonLoose } from '../summarization/parseJson';
import { getInputCharBudget } from '../summarization/tokenBudget';
import { chunkProse } from '../import/chunkProse';
import { IMPORT_PROMPT_HARD_CAP } from '../import/constants';
import { buildBoundaryLocatorPrompt } from '../prompts/chapterSplit';
import { findLocatorOffset, snapToLineStart, SplitBoundary } from './splitDraft';

/** 章境界提案に使う低温度（忠実なロケータ抽出を優先し創作を抑える） */
const LOCATOR_TEMPERATURE = 0.1;

interface RawBoundarySuggestion {
    title?: unknown;
    locator?: unknown;
}

export interface SuggestBoundariesOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
}

export interface SuggestBoundariesResult {
    /** 全文中のオフセットに解決済みの境界候補（行頭スナップ済み・昇順） */
    boundaries: SplitBoundary[];
    /** 本文中に見つからずスキップしたロケータ数（UIで警告表示に使う） */
    skipped: number;
}

/**
 * 本文から章境界候補をAIに提案させ、全文オフセットに解決して返す。
 * 入力は行末正規化済み（LFのみ）であること。
 */
export async function suggestBoundariesAI(
    text: string,
    options: SuggestBoundariesOptions
): Promise<SuggestBoundariesResult> {
    const { settings, run, signal } = options;

    const budget = getInputCharBudget(settings, IMPORT_PROMPT_HARD_CAP);
    // オーバーラップ0: 同じ境界が複数チャンクに重複出現しないようにする
    const chunks = chunkProse(text, budget, 0);

    const suggestions: Array<{ title: string; locator: string }> = [];
    for (const chunk of chunks) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const prompt = buildBoundaryLocatorPrompt(chunk.text, chunk.index + 1, chunks.length);
        const response = await run(prompt, {
            signal,
            temperature: LOCATOR_TEMPERATURE,
            maxPromptLength: IMPORT_PROMPT_HARD_CAP,
        });

        const parsed = parseJsonLoose<{ boundaries?: RawBoundarySuggestion[] }>(response);
        if (!parsed?.boundaries || !Array.isArray(parsed.boundaries)) continue;

        for (const raw of parsed.boundaries) {
            const locator = typeof raw.locator === 'string' ? raw.locator.trim() : '';
            if (!locator) continue;
            const title = typeof raw.title === 'string' ? raw.title.trim() : '';
            suggestions.push({ title, locator });
        }
    }

    // 全文に対して出現順に解決（fromOffset 前進で同名見出しにも対応）
    const boundaries: SplitBoundary[] = [];
    let skipped = 0;
    let lastOffset = -1;

    for (const s of suggestions) {
        const found = findLocatorOffset(text, s.locator, lastOffset + 1);
        if (found === -1) {
            skipped++;
            continue;
        }
        const offset = snapToLineStart(text, found);
        if (offset <= lastOffset) {
            skipped++;
            continue;
        }
        boundaries.push({ offset, title: s.title || s.locator.slice(0, 20) });
        lastOffset = offset;
    }

    return { boundaries, skipped };
}
