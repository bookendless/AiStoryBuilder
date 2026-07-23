/**
 * 草案生成向けの関連チャンク検索
 *
 * クエリ = 章メタ情報（タイトル・あらすじ・キーイベント等）の連結。
 * 生成対象章自身と、章順で後ろ（未来）の章はネタバレ防止のため除外する。
 */

import { Project } from '../../contexts/ProjectContext';
import { Chapter } from '../../types/project/chapter';
import { RagStore, ragStore } from './ragStore';
import { getBm25Index } from './bm25';
import { reciprocalRankFusion, selectWithQuotas, mergeAdjacent } from './fusion';
import { RagChunk, RetrievedChunk } from './types';
import { RANKER_TOP_K } from './constants';

/** 章メタ情報から検索クエリ文字列を組み立てる */
export const buildDraftQuery = (project: Project, chapter: Chapter): string => {
    const assignedNames = (chapter.characters || [])
        .map((id) => project.characters.find((c) => c.id === id)?.name)
        .filter(Boolean) as string[];

    return [
        chapter.title,
        chapter.summary,
        ...(chapter.keyEvents || []),
        chapter.setting || '',
        chapter.mood || '',
        ...assignedNames,
    ]
        .filter(Boolean)
        .join('\n');
};

/**
 * 章検索の共通処理：生成対象章・未来章を除外した候補に対して
 * BM25 → RRF融合 → quota選抜 → 隣接マージを行う。
 * Phase 1 は語彙（BM25）ランカーのみ。Phase 2 でベクトルランカーが rankings に加わる。
 */
const retrieveWithQuery = async (
    project: Project,
    currentChapter: Chapter,
    query: string,
    store: RagStore
): Promise<RetrievedChunk[]> => {
    const allChunks = await store.getChunksByProject(project.id);
    if (allChunks.length === 0) return [];

    // 生成対象章と未来章の除外（章draft/summaryのみ対象。他タイプは常に候補）
    const currentIndex = project.chapters.findIndex((c) => c.id === currentChapter.id);
    const excludedChapterIds = new Set<string>(
        currentIndex >= 0
            ? project.chapters.slice(currentIndex).map((c) => c.id)
            : [currentChapter.id]
    );
    const candidates = allChunks.filter(
        (chunk) =>
            !(
                (chunk.sourceType === 'chapterDraft' || chunk.sourceType === 'chapterSummary') &&
                excludedChapterIds.has(chunk.sourceId)
            )
    );
    if (candidates.length === 0) return [];

    const meta = await store.getMeta(project.id);
    const fingerprint = `${meta?.lastIndexedAt ?? 0}:${candidates.length}:${currentChapter.id}`;
    const bm25 = getBm25Index(project.id, fingerprint, candidates);

    const lexicalRanking = bm25.search(query, RANKER_TOP_K).map((r) => r.id);

    const chunksById = new Map<string, RagChunk>(candidates.map((c) => [c.id, c]));
    const fused = reciprocalRankFusion([lexicalRanking], chunksById);
    return mergeAdjacent(selectWithQuotas(fused));
};

/** 草案生成用の関連チャンクを検索する */
export const retrieveForDraft = async (
    project: Project,
    currentChapter: Chapter,
    store: RagStore = ragStore
): Promise<RetrievedChunk[]> =>
    retrieveWithQuery(project, currentChapter, buildDraftQuery(project, currentChapter), store);

/** 続き生成でクエリに含める草案末尾の文字数 */
const CONTINUE_QUERY_TAIL_CHARS = 800;

/**
 * 続き生成用の関連チャンクを検索する。
 * 直近の展開（草案末尾）をクエリに加えることで「今書いている場面」に関連する情報を優先する。
 */
export const retrieveForContinue = async (
    project: Project,
    currentChapter: Chapter,
    currentDraft: string,
    store: RagStore = ragStore
): Promise<RetrievedChunk[]> => {
    const tail = currentDraft.trim().slice(-CONTINUE_QUERY_TAIL_CHARS);
    const query = [buildDraftQuery(project, currentChapter), tail].filter(Boolean).join('\n');
    return retrieveWithQuery(project, currentChapter, query, store);
};

/**
 * リキャップ用に章あらすじチャンクをクエリ関連度順で返す。
 * 除外・quota・マージは行わない（呼び出し側が章順に再構成して予算内へ詰める）。
 */
export const retrieveRecapSummaries = async (
    project: Project,
    query: string,
    store: RagStore = ragStore
): Promise<RetrievedChunk[]> => {
    const allChunks = await store.getChunksByProject(project.id);
    const candidates = allChunks.filter((chunk) => chunk.sourceType === 'chapterSummary');
    if (candidates.length === 0) return [];

    const meta = await store.getMeta(project.id);
    const fingerprint = `${meta?.lastIndexedAt ?? 0}:${candidates.length}:recap`;
    const bm25 = getBm25Index(project.id, fingerprint, candidates);

    const chunksById = new Map<string, RagChunk>(candidates.map((c) => [c.id, c]));
    return bm25
        .search(query, RANKER_TOP_K)
        .map(({ id, score }) => {
            const chunk = chunksById.get(id);
            return chunk ? { chunk, score } : null;
        })
        .filter((r): r is RetrievedChunk => r !== null);
};
