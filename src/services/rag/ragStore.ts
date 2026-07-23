/**
 * RAG チャンク/メタの永続化層
 *
 * ユニットテストで IndexedDB を使わずに indexer/retrieval を検証できるよう、
 * インターフェース（RagStore）と Dexie 実装を分離している。
 */

import { db } from '../databaseService';
import { RagChunk, RagMeta } from './types';

export interface RagStore {
    getChunksByProject(projectId: string): Promise<RagChunk[]>;
    bulkPutChunks(chunks: RagChunk[]): Promise<void>;
    deleteChunksBySourceKey(projectId: string, sourceKey: string): Promise<void>;
    deleteChunksByProject(projectId: string): Promise<void>;
    getMeta(projectId: string): Promise<RagMeta | undefined>;
    putMeta(meta: RagMeta): Promise<void>;
    deleteMeta(projectId: string): Promise<void>;
}

class DexieRagStore implements RagStore {
    async getChunksByProject(projectId: string): Promise<RagChunk[]> {
        return db.ragChunks.where('projectId').equals(projectId).toArray();
    }

    async bulkPutChunks(chunks: RagChunk[]): Promise<void> {
        if (chunks.length === 0) return;
        await db.ragChunks.bulkPut(chunks);
    }

    async deleteChunksBySourceKey(projectId: string, sourceKey: string): Promise<void> {
        await db.ragChunks.where('[projectId+sourceKey]').equals([projectId, sourceKey]).delete();
    }

    async deleteChunksByProject(projectId: string): Promise<void> {
        await db.ragChunks.where('projectId').equals(projectId).delete();
    }

    async getMeta(projectId: string): Promise<RagMeta | undefined> {
        return db.ragMeta.get(projectId);
    }

    async putMeta(meta: RagMeta): Promise<void> {
        await db.ragMeta.put(meta);
    }

    async deleteMeta(projectId: string): Promise<void> {
        await db.ragMeta.delete(projectId);
    }
}

export const ragStore: RagStore = new DexieRagStore();

/** テスト用のメモリ実装 */
export class MemoryRagStore implements RagStore {
    private chunks = new Map<string, RagChunk>();
    private metas = new Map<string, RagMeta>();

    async getChunksByProject(projectId: string): Promise<RagChunk[]> {
        return Array.from(this.chunks.values()).filter((c) => c.projectId === projectId);
    }

    async bulkPutChunks(chunks: RagChunk[]): Promise<void> {
        for (const chunk of chunks) this.chunks.set(chunk.id, chunk);
    }

    async deleteChunksBySourceKey(projectId: string, sourceKey: string): Promise<void> {
        for (const [id, chunk] of this.chunks) {
            if (chunk.projectId === projectId && chunk.sourceKey === sourceKey) {
                this.chunks.delete(id);
            }
        }
    }

    async deleteChunksByProject(projectId: string): Promise<void> {
        for (const [id, chunk] of this.chunks) {
            if (chunk.projectId === projectId) this.chunks.delete(id);
        }
    }

    async getMeta(projectId: string): Promise<RagMeta | undefined> {
        return this.metas.get(projectId);
    }

    async putMeta(meta: RagMeta): Promise<void> {
        this.metas.set(meta.projectId, meta);
    }

    async deleteMeta(projectId: string): Promise<void> {
        this.metas.delete(projectId);
    }
}
