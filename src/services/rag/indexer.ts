/**
 * インデックス更新（ハッシュ差分によるインクリメンタル）
 *
 * メモリ上の Project を正としてハッシュ比較するため、未保存の編集も反映される。
 * 生成直前に ensureIndexFresh を呼ぶことでインデックスの鮮度を構造的に保証する。
 */

import { Project } from '../../contexts/ProjectContext';
import { RagStore, ragStore } from './ragStore';
import { extractSourceDocs, hashSourceDoc, chunkSourceDoc } from './chunkSources';
import { RagMeta } from './types';
import { CHUNKER_VERSION, INDEX_YIELD_EVERY } from './constants';
import { clearBm25Cache } from './bm25';

const yieldToMain = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export interface IndexResult {
    changed: boolean;
    chunkCount: number;
}

/**
 * インデックスを最新化する。変更が無ければ即座に返る（ハッシュ比較のみ）。
 * @param signal 生成キャンセルと連動した中断シグナル。中断時は途中状態で終了する
 *   （次回呼び出しでハッシュ差分により残りが処理されるため整合性は保たれる）
 */
export const ensureIndexFresh = async (
    project: Project,
    store: RagStore = ragStore,
    signal?: AbortSignal
): Promise<IndexResult> => {
    const projectId = project.id;
    const docs = extractSourceDocs(project);

    const meta = await store.getMeta(projectId);
    const chunkerChanged = meta !== undefined && meta.chunkerVersion !== CHUNKER_VERSION;
    const oldHashes = chunkerChanged ? {} : meta?.sourceHashes ?? {};
    if (chunkerChanged) {
        await store.deleteChunksByProject(projectId);
    }

    const newHashes: Record<string, string> = {};
    const changedDocs: Array<{ doc: (typeof docs)[number]; hash: string }> = [];
    for (const doc of docs) {
        const hash = hashSourceDoc(doc);
        newHashes[doc.sourceKey] = hash;
        if (oldHashes[doc.sourceKey] !== hash) {
            changedDocs.push({ doc, hash });
        }
    }
    const deletedKeys = Object.keys(oldHashes).filter((key) => !(key in newHashes));

    if (changedDocs.length === 0 && deletedKeys.length === 0 && !chunkerChanged) {
        return { changed: false, chunkCount: meta?.chunkCount ?? 0 };
    }

    let processed = 0;
    for (const key of deletedKeys) {
        if (signal?.aborted) return { changed: true, chunkCount: meta?.chunkCount ?? 0 };
        await store.deleteChunksBySourceKey(projectId, key);
        if (++processed % INDEX_YIELD_EVERY === 0) await yieldToMain();
    }

    for (const { doc } of changedDocs) {
        if (signal?.aborted) return { changed: true, chunkCount: meta?.chunkCount ?? 0 };
        await store.deleteChunksBySourceKey(projectId, doc.sourceKey);
        await store.bulkPutChunks(chunkSourceDoc(projectId, doc));
        if (++processed % INDEX_YIELD_EVERY === 0) await yieldToMain();
    }

    const chunkCount = (await store.getChunksByProject(projectId)).length;
    const newMeta: RagMeta = {
        projectId,
        chunkCount,
        lastIndexedAt: Date.now(),
        chunkerVersion: CHUNKER_VERSION,
        sourceHashes: newHashes,
        embeddingModel: meta?.embeddingModel,
        embeddingAvailable: meta?.embeddingAvailable,
    };
    await store.putMeta(newMeta);
    clearBm25Cache();

    return { changed: true, chunkCount };
};

/** 全削除からの完全再構築（設定画面の「再構築」ボタン・復元後のリカバリ用） */
export const reindexProject = async (
    project: Project,
    store: RagStore = ragStore
): Promise<IndexResult> => {
    await store.deleteChunksByProject(project.id);
    await store.deleteMeta(project.id);
    clearBm25Cache();
    return ensureIndexFresh(project, store);
};

/** プロジェクト削除時のインデックス破棄 */
export const deleteProjectIndex = async (
    projectId: string,
    store: RagStore = ragStore
): Promise<void> => {
    await store.deleteChunksByProject(projectId);
    await store.deleteMeta(projectId);
    clearBm25Cache();
};
