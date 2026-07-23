/**
 * RAG サブシステムの定数
 */

/** チャンク化ロジックの版数。上げると全プロジェクトが再インデックスされる */
export const CHUNKER_VERSION = 1;

/** 章草案チャンクの最大文字数（chunkProse に渡す budget） */
export const DRAFT_CHUNK_BUDGET = 700;
/** 連続チャンク間のオーバーラップ文字数 */
export const DRAFT_CHUNK_OVERLAP = 100;
/** 単一チャンク想定のソース（キャラ・設定等）がこれを超えたら chunkProse で分割 */
export const SINGLE_CHUNK_MAX = 800;

/** BM25 パラメータ（Okapi 標準値） */
export const BM25_K1 = 1.2;
export const BM25_B = 0.75;

/** Reciprocal Rank Fusion の定数 k */
export const RRF_K = 60;

/** 各ランカーが返す最大件数 */
export const RANKER_TOP_K = 50;
/** 融合後に選抜するチャンクの最大数（文字数予算での切り詰めは後段） */
export const MAX_SELECTED_CHUNKS = 24;

/** インデックス処理で協調 yield するソース数の間隔（Android のジャンク防止） */
export const INDEX_YIELD_EVERY = 20;

/** sourceType 別の最低確保数（融合ランキングから優先的に引き上げる） */
export const TYPE_MIN_QUOTAS: Partial<Record<string, number>> = {
    worldSetting: 1,
    glossary: 1,
    chapterDraft: 2,
    chapterSummary: 1,
    foreshadowing: 1,
};

/** 文字数予算のカテゴリ配分（未使用分は過去章プールへ繰り越す） */
export const POOL_RATIO_PAST = 0.4;
export const POOL_RATIO_CHARACTER = 0.3;
export const POOL_RATIO_WORLD = 0.2;
export const POOL_RATIO_FORESHADOWING = 0.1;

/** 予算計算時の固定オーバーヘッド見込み（章詳細・見出し等。テンプレート分は tokenBudget 側で控除済み） */
export const CONTEXT_FIXED_OVERHEAD = 500;
