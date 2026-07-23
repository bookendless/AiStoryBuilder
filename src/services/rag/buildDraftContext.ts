/**
 * 検索結果から草案生成プロンプト用のコンテキスト文字列を組み立てる
 *
 * 出力は既存の buildCustomPrompt が受け取る previousStory / projectCharacters /
 * contextInfo.worldSettings / contextInfo.glossary へそのまま差し替えられる形式。
 * 合計が予算内に収まるようカテゴリ別に配分し、文境界で切り詰める。
 * サニタイザが `<>` を除去するため、区切りは全て【】マーカーを使う。
 */

import { Project } from '../../contexts/ProjectContext';
import { Chapter } from '../../types/project/chapter';
import { formatCharacter } from './chunkSources';
import { DraftRagContext, RetrievedChunk } from './types';
import {
    POOL_RATIO_PAST,
    POOL_RATIO_CHARACTER,
    POOL_RATIO_WORLD,
    POOL_RATIO_FORESHADOWING,
    CONTEXT_FIXED_OVERHEAD,
} from './constants';

export interface BuildDraftContextParams {
    project: Project;
    currentChapter: Chapter;
    retrieved: RetrievedChunk[];
    /** getInputCharBudget(settings) の値 */
    budget: number;
    /** 直前章末尾の逐語引用の実文字数（そのまま維持されるため固定費として控除） */
    previousChapterEndLength: number;
}

/** 文境界（。！？改行）で maxLength 以内に切り詰める */
export const truncateAtSentence = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    const window = text.slice(0, maxLength);
    const cut = Math.max(
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
        window.lastIndexOf('\n')
    );
    // 文境界が前半すぎる場合はそのまま切る（情報量を優先）
    return cut >= maxLength * 0.5 ? window.slice(0, cut + 1) : window + '…';
};

/** プール予算内でスニペットを詰める。入りきらないものはスキップして次を試す */
const fillPool = (
    items: Array<{ label: string; text: string }>,
    poolBudget: number
): { text: string; used: number } => {
    const parts: string[] = [];
    let used = 0;
    for (const item of items) {
        const header = `【${item.label}】\n`;
        const remaining = poolBudget - used - header.length - 2;
        if (remaining < 100) break;
        const body = truncateAtSentence(item.text, remaining);
        parts.push(header + body);
        used += header.length + body.length + 2;
    }
    return { text: parts.join('\n\n'), used };
};

/**
 * 検索結果をプロンプト用コンテキストへ整形する。
 *
 * 全コーパス（強制包含含む）が予算に収まる場合は null を返し、呼び出し元は
 * 従来の全量ダンプを使う（小規模プロジェクトでは RAG は挙動を変えない）。
 */
export const buildDraftContext = (params: BuildDraftContextParams): DraftRagContext | null => {
    const { project, currentChapter, budget, previousChapterEndLength } = params;

    const styleSampleLength = project.styleSample?.length ?? 0;
    const available = budget - previousChapterEndLength - styleSampleLength - CONTEXT_FIXED_OVERHEAD;
    if (available < 800) {
        // 予算が極端に小さい場合も検索コンテキストを最低限確保する
        return assemble(params, 800);
    }

    // 小規模バイパス判定: 従来ダンプ相当の総量が収まるなら RAG は何もしない
    const currentIndex = project.chapters.findIndex((c) => c.id === currentChapter.id);
    const fullDumpSize =
        project.characters.reduce((sum, c) => sum + formatCharacter(c).length + 2, 0) +
        project.chapters
            .slice(0, Math.max(currentIndex, 0))
            .reduce((sum, c) => sum + (c.summary?.length ?? 0) + c.title.length + 20, 0) +
        (project.worldSettings || []).reduce((sum, w) => sum + Math.min(w.content.length, 120), 0) +
        (project.glossary || []).reduce((sum, g) => sum + g.term.length + g.definition.length, 0);
    if (fullDumpSize <= available) {
        return null;
    }

    return assemble(params, available);
};

const assemble = (params: BuildDraftContextParams, available: number): DraftRagContext => {
    const { project, currentChapter, retrieved } = params;
    const currentIndex = project.chapters.findIndex((c) => c.id === currentChapter.id);

    // --- 強制包含（検索バイパス） ---
    // 1) 割当キャラクターは全文
    const assignedIds = new Set(currentChapter.characters || []);
    const assignedCharacters = project.characters.filter((c) => assignedIds.has(c.id));
    const forcedCharacterText = assignedCharacters.map(formatCharacter).join('\n\n');

    // 2) 直前章のあらすじ
    let forcedPrevSummary = '';
    if (currentIndex > 0) {
        const prev = project.chapters[currentIndex - 1];
        if (prev.summary) {
            forcedPrevSummary = `第${currentIndex}章「${prev.title}」（直前の章）\nあらすじ: ${prev.summary}`;
        }
    }

    const forcedUsed = forcedCharacterText.length + forcedPrevSummary.length;
    const poolTotal = Math.max(400, available - forcedUsed);

    // --- カテゴリ別に検索結果を振り分け ---
    const past: Array<{ label: string; text: string }> = [];
    const characters: Array<{ label: string; text: string }> = [];
    const world: Array<{ label: string; text: string }> = [];
    const foreshadowing: Array<{ label: string; text: string }> = [];

    for (const { chunk } of retrieved) {
        const item = { label: chunk.label, text: chunk.text };
        switch (chunk.sourceType) {
            case 'chapterDraft':
            case 'chapterSummary':
                past.push(item);
                break;
            case 'character':
                // 割当キャラは強制包含済みのため重複させない
                if (!assignedIds.has(chunk.sourceId)) characters.push(item);
                break;
            case 'worldSetting':
            case 'glossary':
                world.push(item);
                break;
            case 'foreshadowing':
                foreshadowing.push(item);
                break;
            default:
                break;
        }
    }

    // --- プール配分（未使用分は過去章プールへ繰り越し） ---
    const charPool = fillPool(characters, Math.floor(poolTotal * POOL_RATIO_CHARACTER));
    const worldItems = world.filter((w) => !w.label.startsWith('用語'));
    const glossaryItems = world.filter((w) => w.label.startsWith('用語'));
    const worldBudget = Math.floor(poolTotal * POOL_RATIO_WORLD);
    const worldPool = fillPool(worldItems, Math.floor(worldBudget * 0.7));
    const glossaryPool = fillPool(glossaryItems, worldBudget - worldPool.used);
    const fsPool = fillPool(foreshadowing, Math.floor(poolTotal * POOL_RATIO_FORESHADOWING));

    const rollover =
        poolTotal -
        charPool.used -
        worldPool.used -
        glossaryPool.used -
        fsPool.used -
        Math.floor(poolTotal * POOL_RATIO_PAST);
    const pastPool = fillPool(past, Math.floor(poolTotal * POOL_RATIO_PAST) + Math.max(0, rollover));

    // --- 出力組み立て ---
    const previousStoryParts = [forcedPrevSummary, pastPool.text].filter(Boolean);
    if (fsPool.text) {
        previousStoryParts.push(`【この章に関連する伏線】\n${fsPool.text}`);
    }

    const projectCharactersParts = [forcedCharacterText, charPool.text].filter(Boolean);

    return {
        previousStory: previousStoryParts.join('\n\n'),
        projectCharacters: projectCharactersParts.join('\n\n'),
        worldSettings: worldPool.text,
        glossary: glossaryPool.text,
    };
};
