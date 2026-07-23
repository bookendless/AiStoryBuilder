/**
 * Okapi BM25 検索（メモリ内転置インデックス）
 *
 * チャンクのみを永続化する設計のため、転置インデックスは都度構築して
 * プロジェクト単位でキャッシュする。長編でも千チャンク規模のため構築は数十 ms。
 */

import { RagChunk } from './types';
import { tokenize } from './tokenize';
import { BM25_K1, BM25_B } from './constants';

interface Posting {
    docIndex: number;
    tf: number;
}

export interface Bm25Index {
    /** クエリ文字列で検索し、スコア降順で最大 topK 件のチャンクIDを返す */
    search(query: string, topK: number): Array<{ id: string; score: number }>;
}

export const buildBm25Index = (chunks: RagChunk[]): Bm25Index => {
    const postings = new Map<string, Posting[]>();
    const docLengths = new Array<number>(chunks.length);
    let totalLength = 0;

    chunks.forEach((chunk, docIndex) => {
        const tokens = tokenize(chunk.text + '\n' + chunk.label);
        docLengths[docIndex] = tokens.length;
        totalLength += tokens.length;

        const tfMap = new Map<string, number>();
        for (const token of tokens) {
            tfMap.set(token, (tfMap.get(token) || 0) + 1);
        }
        for (const [token, tf] of tfMap) {
            let list = postings.get(token);
            if (!list) {
                list = [];
                postings.set(token, list);
            }
            list.push({ docIndex, tf });
        }
    });

    const docCount = chunks.length;
    const avgLength = docCount > 0 ? totalLength / docCount : 0;

    return {
        search(query: string, topK: number): Array<{ id: string; score: number }> {
            if (docCount === 0) return [];
            const queryTokens = Array.from(new Set(tokenize(query)));
            const scores = new Float64Array(docCount);

            for (const token of queryTokens) {
                const list = postings.get(token);
                if (!list) continue;
                const df = list.length;
                const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
                for (const { docIndex, tf } of list) {
                    const norm = 1 - BM25_B + BM25_B * (docLengths[docIndex] / (avgLength || 1));
                    scores[docIndex] += idf * ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * norm));
                }
            }

            const ranked: Array<{ id: string; score: number }> = [];
            for (let i = 0; i < docCount; i++) {
                if (scores[i] > 0) {
                    ranked.push({ id: chunks[i].id, score: scores[i] });
                }
            }
            ranked.sort((a, b) => b.score - a.score);
            return ranked.slice(0, topK);
        },
    };
};

// プロジェクト単位のインデックスキャッシュ（fingerprint = lastIndexedAt:chunkCount）
let cachedProjectId: string | null = null;
let cachedFingerprint: string | null = null;
let cachedIndex: Bm25Index | null = null;

export const getBm25Index = (projectId: string, fingerprint: string, chunks: RagChunk[]): Bm25Index => {
    if (cachedIndex && cachedProjectId === projectId && cachedFingerprint === fingerprint) {
        return cachedIndex;
    }
    cachedIndex = buildBm25Index(chunks);
    cachedProjectId = projectId;
    cachedFingerprint = fingerprint;
    return cachedIndex;
};

export const clearBm25Cache = (): void => {
    cachedProjectId = null;
    cachedFingerprint = null;
    cachedIndex = null;
};
