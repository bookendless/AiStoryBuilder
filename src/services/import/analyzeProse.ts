/**
 * インポート解析パイプラインのオーケストレーター
 *
 * 1. 概要: 本文要約（map）→ 全体集約（reduce）→ 概要フィールド抽出
 * 2. 列挙: 本文全体からキャラクター抽出（map）→ 名寄せ統合（merge）
 * 3. 文体: 機械計測 + AI分類1回で文体設定を推測（失敗しても致命ではない）
 * 4. 原文は AI を通さず逐語保存する（「再構成」であって「書き換え」ではない）
 */

import { AISettings } from '../../types/ai';
import { AIRunner, SequelProgress } from '../../types/sequel';
import { ImportResult } from '../../types/import';
import { buildStoryDigest, extractOverview } from './extractOverview';
import { extractCharacters } from './extractCharacters';
import { analyzeWritingStyle, extractStyleSample } from './classifyStyle';
import { normalizeLineEndings } from '../../utils/textEncoding';

interface AnalyzeOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

/**
 * プローズ（連結済みの小説本文）を解析し、プロジェクト化前の ImportResult を返す。
 */
export async function analyzeProse(prose: string, options: AnalyzeOptions): Promise<ImportResult> {
    const { settings, run, signal, onProgress } = options;
    const clean = normalizeLineEndings(prose).trim();

    // 1. 概要（要約 → 集約 → 抽出）
    const storyDigest = await buildStoryDigest(clean, { settings, run, signal, onProgress });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onProgress?.({ phase: '概要の抽出', current: 1, total: 1 });
    const overview = await extractOverview(storyDigest, { settings, run, signal, onProgress });

    // 2. 列挙（本文全体からキャラ抽出 → 名寄せ）
    const characters = await extractCharacters(clean, { settings, run, signal, onProgress });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // 3. 文体（機械計測 + AI分類1回。失敗時は計測のみに格下げされる）
    onProgress?.({ phase: '文体の解析', current: 1, total: 1 });
    const style = await analyzeWritingStyle(clean, { settings, run, signal });

    // 4. 原文は逐語保存
    return {
        overview,
        characters,
        writingStyle: style.writingStyle,
        styleNote: style.styleNote,
        // 文体見本は原文の逐語抜粋（決定的・AI不使用）
        styleSample: extractStyleSample(clean),
        originalProse: clean,
    };
}
