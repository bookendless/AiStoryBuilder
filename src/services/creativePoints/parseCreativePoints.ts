/**
 * 創造ポイント（Phase C）の出力分離・正規化
 *
 * 生成テキストを「マーカーより前の本文」と「マーカー以降の creativePoints JSON」に分割する。
 * - 本文は常にそのまま反映できる（マーカーが無くても全文を本文として返す）
 * - JSON は parseJsonLoose で寛容に解析し、2〜4件にクランプ、1〜3別案に制限、id を付与する
 * - 解析できない・空なら creativePoints は空配列（＝カードは表示されない）
 */

import { parseJsonLoose } from '../summarization/parseJson';
import { CREATIVE_POINTS_MARKER } from '../prompts/creativePoints';
import { CreativePoint, CreativePointAlternative } from '../../types/creativePoint';

export interface SplitCreativePointsResult {
    /** マーカーを除いた本文（反映対象） */
    content: string;
    /** 抽出・正規化済みの創造ポイント（0件なら無効） */
    creativePoints: CreativePoint[];
}

const genId = (prefix: string, i: number): string =>
    `${prefix}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * 既に解析済みの creativePoints 配列を正規化（最大4ポイント・各最大3別案、空は除外）。
 * 構成生成（plot2）のように creativePoints を同一JSONオブジェクトのキーとして
 * 受け取る経路から、マーカー分離を介さず直接利用するために公開する。
 */
export function normalizeCreativePointsList(list: unknown): CreativePoint[] {
    if (!Array.isArray(list)) return [];

    const points: CreativePoint[] = [];
    list.forEach((item, pi) => {
        if (typeof item !== 'object' || item === null) return;
        const obj = item as Record<string, unknown>;
        const label = str(obj.label);
        const current = str(obj.current);

        const rawAlts = Array.isArray(obj.alternatives) ? obj.alternatives : [];
        const alternatives: CreativePointAlternative[] = [];
        rawAlts.forEach((a, ai) => {
            if (typeof a !== 'object' || a === null) return;
            const ao = a as Record<string, unknown>;
            const summary = str(ao.summary);
            if (!summary) return;
            alternatives.push({
                id: genId('alt', pi * 10 + ai),
                summary,
                consequence: str(ao.consequence),
            });
        });

        // ラベルと別案が無いポイントは無効
        if (!label || alternatives.length === 0) return;
        points.push({
            id: genId('cp', pi),
            label,
            current,
            alternatives: alternatives.slice(0, 3),
        });
    });

    return points.slice(0, 4);
}

/** creativePoints JSON ブロック（文字列）を寛容に解析して正規化する */
function normalizeCreativePoints(raw: string): CreativePoint[] {
    const parsed = parseJsonLoose<{ creativePoints?: unknown }>(raw);
    return normalizeCreativePointsList(parsed?.creativePoints);
}

/**
 * マーカーが無い場合のフォールバック。
 * モデルがマーカーを付け損ねても末尾に creativePoints JSON を出力した場合、
 * 本文にJSONが混入しないよう末尾の該当オブジェクトを切り離す。
 * 検出できなければ全文を本文として返す（＝従来挙動）。
 */
function splitWithoutMarker(raw: string): SplitCreativePointsResult {
    // "creativePoints" を含む末尾近くのJSONオブジェクト（任意でコードフェンス付き）を探す
    const match = raw.match(/```(?:json)?\s*(\{[\s\S]*"creativePoints"[\s\S]*\})\s*```\s*$/)
        ?? raw.match(/(\{[\s\S]*"creativePoints"[\s\S]*\})\s*$/);
    if (!match) {
        return { content: raw.trim(), creativePoints: [] };
    }
    const creativePoints = normalizeCreativePoints(match[1]);
    if (creativePoints.length === 0) {
        // JSONらしきものはあったが有効なポイントが無い → 本文を汚さないため切り離すが空配列
        return { content: raw.slice(0, match.index).trim(), creativePoints: [] };
    }
    return { content: raw.slice(0, match.index).trim(), creativePoints };
}

/**
 * 生成テキストを本文と創造ポイントに分割する。
 */
export function splitCreativePoints(raw: string): SplitCreativePointsResult {
    const markerIndex = raw.indexOf(CREATIVE_POINTS_MARKER);
    if (markerIndex === -1) {
        return splitWithoutMarker(raw);
    }
    const content = raw.slice(0, markerIndex).trim();
    const jsonPart = raw.slice(markerIndex + CREATIVE_POINTS_MARKER.length);
    return { content, creativePoints: normalizeCreativePoints(jsonPart) };
}
