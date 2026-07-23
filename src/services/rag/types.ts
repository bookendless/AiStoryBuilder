/**
 * RAG（関連情報検索）サブシステムの型定義
 *
 * チャンクのみを永続化し、BM25 転置インデックスはメモリ上で構築する。
 * 埋め込みベクトル（Phase 2）は RagChunk.embedding に後付けされる。
 */

export type RagSourceType =
    | 'chapterDraft'
    | 'chapterSummary'
    | 'character'
    | 'worldSetting'
    | 'glossary'
    | 'foreshadowing'
    | 'plot';

/**
 * 検索・プロンプト注入の最小単位。
 * id は `${projectId}:${sourceType}:${sourceId}:${chunkIndex}` で決定的（再チャンクで上書きされる）。
 */
export interface RagChunk {
    id: string;
    projectId: string;
    sourceType: RagSourceType;
    /** 元エンティティのID（章ID・キャラIDなど）。章の除外判定に使う */
    sourceId: string;
    /** 差分削除用のキー。`${sourceType}:${sourceId}`（章は draft と summary で別ソース扱い） */
    sourceKey: string;
    chunkIndex: number;
    /** プロンプト表示用ラベル（例: 第3章「…」(草案抜粋)） */
    label: string;
    text: string;
    /** ソース全文のハッシュ（同一ソースの全チャンクで同値。差分判定用） */
    contentHash: string;
    /** L2正規化済み Float32Array の buffer（Phase 2） */
    embedding?: ArrayBuffer;
    /** `provider:model:dim`（Phase 2）。現行モデルと不一致のベクトルは検索時に無視する */
    embeddingModel?: string;
    updatedAt: number;
}

/** プロジェクト単位のインデックスメタ情報 */
export interface RagMeta {
    projectId: string;
    chunkCount: number;
    lastIndexedAt: number;
    chunkerVersion: number;
    /** 差分判定用: sourceKey -> contentHash */
    sourceHashes: Record<string, string>;
    embeddingModel?: string;
    embeddingAvailable?: boolean;
}

/** チャンク化前のソース文書（Project から抽出した1エンティティ分） */
export interface SourceDoc {
    sourceType: RagSourceType;
    sourceId: string;
    sourceKey: string;
    label: string;
    text: string;
}

/** 検索結果（融合スコア付き） */
export interface RetrievedChunk {
    chunk: RagChunk;
    score: number;
}

/** buildDraftContext の出力。null の場合は従来の全量ダンプにフォールバックする */
export interface DraftRagContext {
    /** 前章までのあらすじ枠（強制包含の直前章summary + 検索抜粋 + 関連伏線） */
    previousStory: string;
    /** キャラクター情報枠（割当キャラ全文 + 検索されたその他キャラ） */
    projectCharacters: string;
    /** 世界観設定枠（検索された設定の全文。従来の100字切り詰めより詳細） */
    worldSettings: string;
    /** 用語集枠（検索された用語） */
    glossary: string;
}
