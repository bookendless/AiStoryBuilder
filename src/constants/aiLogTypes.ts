/**
 * AIログの種別ラベルと、AI利用区分（工程）の定義
 *
 * ラベルは useAILog の copyLog / downloadLogs に同じ表が二重に書かれていたものを一本化した。
 * 種別（type）は経路をまたいで重複しており（'generate' はあらすじ生成とキャラクター生成の
 * 両方で使われる）、種別だけでは工程を特定できない。そのため投稿サイトへのAI利用区分は
 * 種別ではなく AIUsagePurpose（明示的に渡す工程）から導く。
 */

import { AIUsagePurpose } from '../types/ai';

/** AIログ種別の表示ラベル。未知の種別は種別文字列をそのまま表示する */
export const AI_LOG_TYPE_LABELS: Record<string, string> = {
    // 'generate' と 'basic' は複数の画面で使い回されているため、どちらの生成か分かる表記にする
    generate: 'あらすじ・キャラクター生成',
    readable: '読みやすく調整',
    summary: '要点抽出',
    engaging: '魅力的に演出',
    basic: 'プロット・章立ての基本生成',
    structure: '構造生成',
    generateStructure: '構成生成',
    inferStructure: '構成の推定',
    supplement: '設定の補完',
    consistency: '整合性チェック',
    applyConsistency: '整合性の反映',
    enhance: '強化',
    generateSingle: '単一生成',
    continue: '続き生成',
    suggestions: '提案',
    generateFull: '全章一括生成',
};

/** AIログ種別を表示用ラベルに変換する（未知の種別はそのまま返す） */
export const getAILogTypeLabel = (type: string): string => AI_LOG_TYPE_LABELS[type] ?? type;

/** 記録上の工程。purpose 未指定の呼び出しはこのキーで集計する */
export const UNCLASSIFIED_PURPOSE = 'unclassified' as const;

/** 集計キーとしての工程（明示された工程 ＋ 未分類） */
export type TalliedPurpose = AIUsagePurpose | typeof UNCLASSIFIED_PURPOSE;

/**
 * 工程の表示ラベル。Record で全工程の網羅をコンパイル時に強制する
 * （AIUsagePurpose に値を足したらここも埋めないとビルドが通らない）。
 */
export const AI_USAGE_PURPOSE_LABELS: Record<TalliedPurpose, string> = {
    prose: '本文の生成・書き換え',
    proofread: '校正（誤字脱字・表記ゆれ）',
    review: '講評・整合性チェック',
    plan: 'プロット・章立て・あらすじ',
    setting: 'キャラクター・世界観・用語',
    analysis: '要約・分析',
    chat: '相談・チャット',
    [UNCLASSIFIED_PURPOSE]: '未分類',
};

/**
 * その工程が「本文そのもの」に関与するか。
 *
 * 投稿サイトの区分はいずれも「本文にAIが関与したか」で分かれる。校正・アイデア出し・
 * 資料調査は本文執筆そのものには関与しない扱い（なろうの「AI補助的利用」の定義）なので
 * false になる。未分類は判断材料がないため false とし、サマリー側で別途可視化する。
 */
export const isProsePurpose = (purpose: TalliedPurpose): boolean => purpose === 'prose';

/** 工程の表示順（サマリーと一覧で共通に使う） */
export const PURPOSE_DISPLAY_ORDER: TalliedPurpose[] = [
    'prose',
    'proofread',
    'review',
    'plan',
    'setting',
    'analysis',
    'chat',
    UNCLASSIFIED_PURPOSE,
];
