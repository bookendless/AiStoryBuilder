/**
 * プロット構成のAI推定（忠実抽出系・PlotStep2のオンデマンドアクション用）
 *
 * 既存アシスタントパネルの「構成生成」（選択中の構成を創作的に生成・高温度）とは役割が異なり、
 * こちらは「あらすじ＋章一覧から、6種のどの構成に当てはまるかを判定し、書かれている内容だけで
 * 各段階を埋める」低温度の分析アクション。構成カタログは PLOT_STRUCTURE_CONFIGS から
 * 動的生成するため、UI（PlotStep2）と定義がずれることはない。
 */

import { PLOT_STRUCTURE_CONFIGS, CHARACTER_LIMIT } from '../../components/steps/plot2/constants';
import type { PlotStructureType } from '../../components/steps/plot2/types';
import type { Chapter } from '../../types/project/chapter';
import { parseJsonLoose } from '../summarization/parseJson';

/**
 * 構成推定プロンプトのサニタイズ上限（文字数）。
 * 既定の10000では章ダイジェスト＋構成カタログが収まらないことがあるため引き上げる。
 * generateContent の maxPromptLength と getInputCharBudget の両方に同じ値を渡して整合させる。
 */
export const INFER_STRUCTURE_PROMPT_CAP = 20000;

export interface StructureInference {
    structure: PlotStructureType;
    /** 選定理由（ユーザー確認用） */
    reason: string;
    /** 推定された各段階の内容（キーは PLOT_STRUCTURE_CONFIGS の field key） */
    fields: Record<string, string>;
}

/** プロンプト用の構成カタログ（key/label/description と各段階の key/label/description） */
export function buildStructureCatalog(): string {
    return Object.entries(PLOT_STRUCTURE_CONFIGS)
        .map(([key, config]) => {
            const fields = config.fields
                .map(f => `  - ${f.key}: ${f.label}（${f.description}）`)
                .join('\n');
            return `■ ${key}: ${config.label} — ${config.description}\n${fields}`;
        })
        .join('\n\n');
}

/**
 * 章一覧を予算内のダイジェスト文字列に整形する（タイトル＋概要）。
 */
export function buildChapterDigest(chapters: Chapter[], budget: number): string {
    const lines: string[] = [];
    let used = 0;
    for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const summary = (ch.summary || '').trim().slice(0, 200);
        const line = `${i + 1}. ${ch.title}${summary ? `：${summary}` : ''}`;
        if (used + line.length + 1 > budget) {
            lines.push(`…（以下${chapters.length - i}章を省略）`);
            break;
        }
        lines.push(line);
        used += line.length + 1;
    }
    return lines.join('\n');
}

/**
 * AI応答をパースして検証済みの StructureInference を返す。
 * - structure が6種のいずれでもなければ null（呼び出し側でエラー表示）
 * - fields は選定された構成に属するキーのみ採用（未知キーは破棄）
 * - 各値は CHARACTER_LIMIT で防御的に切り詰める
 */
export function parseStructureInference(raw: string): StructureInference | null {
    const parsed = parseJsonLoose<{
        structure?: unknown;
        reason?: unknown;
        fields?: Record<string, unknown>;
    }>(raw);
    if (!parsed) return null;

    const structure = typeof parsed.structure === 'string' ? parsed.structure : '';
    if (!(structure in PLOT_STRUCTURE_CONFIGS)) return null;
    const structureKey = structure as PlotStructureType;

    const allowedKeys = new Set(PLOT_STRUCTURE_CONFIGS[structureKey].fields.map(f => f.key as string));
    const fields: Record<string, string> = {};
    if (parsed.fields && typeof parsed.fields === 'object') {
        for (const [key, value] of Object.entries(parsed.fields)) {
            if (!allowedKeys.has(key)) continue;
            if (typeof value !== 'string') continue;
            fields[key] = value.trim().slice(0, CHARACTER_LIMIT);
        }
    }

    return {
        structure: structureKey,
        reason: typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 200) : '',
        fields,
    };
}
