/**
 * ランキング融合・選抜
 *
 * Reciprocal Rank Fusion で複数ランカー（Phase 1 は語彙のみ、Phase 2 でベクトル追加）を
 * 統合し、sourceType 別の最低確保数を満たすよう選抜する。
 * 同一ソースの隣接チャンクはオーバーラップを吸収して1スニペットにマージする。
 */

import { RagChunk, RetrievedChunk } from './types';
import { RRF_K, MAX_SELECTED_CHUNKS, TYPE_MIN_QUOTAS } from './constants';

/** 各ランキング（チャンクID配列、ランク順）を RRF で統合し、スコア降順で返す */
export const reciprocalRankFusion = (
    rankings: string[][],
    chunksById: Map<string, RagChunk>,
    k: number = RRF_K
): RetrievedChunk[] => {
    const scores = new Map<string, number>();
    for (const ranking of rankings) {
        ranking.forEach((id, rank) => {
            scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1));
        });
    }

    const fused: RetrievedChunk[] = [];
    for (const [id, score] of scores) {
        const chunk = chunksById.get(id);
        if (chunk) fused.push({ chunk, score });
    }
    fused.sort((a, b) => b.score - a.score);
    return fused;
};

/**
 * sourceType 別の最低確保数を満たすように選抜する。
 * まず各タイプの最上位を quota 分確保し、残り枠を融合ランク順で埋める。
 */
export const selectWithQuotas = (
    fused: RetrievedChunk[],
    maxSelected: number = MAX_SELECTED_CHUNKS
): RetrievedChunk[] => {
    const selected: RetrievedChunk[] = [];
    const selectedIds = new Set<string>();

    for (const [sourceType, quota] of Object.entries(TYPE_MIN_QUOTAS)) {
        let taken = 0;
        for (const item of fused) {
            if (taken >= (quota || 0) || selected.length >= maxSelected) break;
            if (item.chunk.sourceType === sourceType && !selectedIds.has(item.chunk.id)) {
                selected.push(item);
                selectedIds.add(item.chunk.id);
                taken++;
            }
        }
    }

    for (const item of fused) {
        if (selected.length >= maxSelected) break;
        if (!selectedIds.has(item.chunk.id)) {
            selected.push(item);
            selectedIds.add(item.chunk.id);
        }
    }

    // 提示順は融合スコア順に戻す（quota 確保による順序の乱れを解消）
    selected.sort((a, b) => b.score - a.score);
    return selected;
};

/** a の末尾と b の先頭の重複（chunkProse のオーバーラップ由来）を吸収して結合する */
export const joinWithOverlap = (a: string, b: string, maxOverlap: number = 150): string => {
    const window = Math.min(maxOverlap, a.length, b.length);
    for (let size = window; size >= 10; size--) {
        if (a.endsWith(b.slice(0, size))) {
            return a + b.slice(size);
        }
    }
    return a + '\n' + b;
};

/** 同一ソースで chunkIndex が連続するチャンクを1スニペットへマージする */
export const mergeAdjacent = (selected: RetrievedChunk[]): RetrievedChunk[] => {
    const bySource = new Map<string, RetrievedChunk[]>();
    for (const item of selected) {
        const key = item.chunk.sourceKey;
        const list = bySource.get(key);
        if (list) list.push(item);
        else bySource.set(key, [item]);
    }

    const mergedById = new Map<string, RetrievedChunk>();
    for (const list of bySource.values()) {
        list.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);
        let current = list[0];
        for (let i = 1; i < list.length; i++) {
            const next = list[i];
            if (next.chunk.chunkIndex === current.chunk.chunkIndex + 1) {
                current = {
                    score: Math.max(current.score, next.score),
                    chunk: {
                        ...current.chunk,
                        text: joinWithOverlap(current.chunk.text, next.chunk.text),
                        chunkIndex: next.chunk.chunkIndex,
                    },
                };
            } else {
                mergedById.set(current.chunk.id, current);
                current = next;
            }
        }
        mergedById.set(current.chunk.id, current);
    }

    // 元の提示順（スコア順）を維持
    return Array.from(mergedById.values()).sort((a, b) => b.score - a.score);
};
