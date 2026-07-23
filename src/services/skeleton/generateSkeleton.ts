/**
 * AIおまかせ骨組み生成のオーケストレーター（Phase B）
 *
 * analyzeProse（import パイプライン）を手本に、逐次AI呼び出し＋進捗通知＋中断対応を行う。
 * 1. plot1 6項目（厳密JSON → 日本語キーをマップ）
 * 2. 主要キャラクター2〜3人（厳密JSON配列）
 * 3. 推奨構成テンプレート（既存の構成推定パイプラインを流用）
 *
 * いずれの段も致命にしない（パース失敗・欠落は空にフォールバックして次へ進む）。
 * 構成推定（3段目）が失敗しても plot / characters は返す。
 */

import { AISettings } from '../../types/ai';
import { AIRunner, SequelProgress } from '../../types/sequel';
import { Character } from '../../types/project/character';
import { SkeletonSeed, SkeletonPlot, SkeletonResult } from '../../types/skeleton';
import { parseJsonLoose } from '../summarization/parseJson';
import { buildPlotSkeletonPrompt, buildCharacterSeedPrompt } from '../prompts/skeleton';
import {
    buildStructureInferencePrompt,
} from '../prompts/plotStructure';
import {
    buildStructureCatalog,
    parseStructureInference,
    INFER_STRUCTURE_PROMPT_CAP,
} from '../plotStructure/inferStructure';

interface GenerateSkeletonOptions {
    settings: AISettings;
    run: AIRunner;
    signal?: AbortSignal;
    onProgress?: (p: SequelProgress) => void;
}

const TOTAL_PHASES = 3;

/** 一意なキャラクターIDを生成 */
function genCharacterId(index: number): string {
    return `char-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

const throwIfAborted = (signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
};

/** plot1 6項目JSON（日本語キー）を SkeletonPlot にマップ */
function parsePlot(raw: string): SkeletonPlot {
    const parsed = parseJsonLoose<Record<string, unknown>>(raw) ?? {};
    const get = (key: string): string => {
        const v = parsed[key];
        return typeof v === 'string' ? v.trim() : '';
    };
    return {
        theme: get('メインテーマ'),
        setting: get('舞台設定'),
        hook: get('フック要素'),
        protagonistGoal: get('主人公の目標'),
        mainObstacle: get('主要な障害'),
        ending: get('物語の結末'),
    };
}

/** キャラクターJSON配列を Character[] にマップ（最大3人にクランプ） */
function parseCharacters(raw: string): Character[] {
    const parsed = parseJsonLoose<unknown>(raw);
    if (!Array.isArray(parsed)) return [];
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    return parsed
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map((c) => ({
            name: str(c.name),
            role: str(c.role),
            appearance: str(c.appearance),
            personality: str(c.personality),
            background: str(c.background),
            ...(str(c.speechStyle) ? { speechStyle: str(c.speechStyle) } : {}),
        }))
        // 名前が無いものは無効として除外
        .filter((c) => c.name.length > 0)
        .slice(0, 3)
        .map((c, i) => ({ id: genCharacterId(i), ...c }));
}

/** plot から構成推定用の擬似あらすじを組み立てる（章はまだ無い） */
function buildSynopsisFromPlot(plot: SkeletonPlot): string {
    return [
        plot.hook && `導入: ${plot.hook}`,
        plot.protagonistGoal && `主人公の目標: ${plot.protagonistGoal}`,
        plot.mainObstacle && `障害: ${plot.mainObstacle}`,
        plot.ending && `結末: ${plot.ending}`,
    ]
        .filter(Boolean)
        .join('\n');
}

/**
 * 骨組み（plot + characters + structure）を生成する。
 */
export async function generateSkeleton(
    seed: SkeletonSeed,
    options: GenerateSkeletonOptions
): Promise<SkeletonResult> {
    const { run, signal, onProgress } = options;

    // 1. plot1 6項目
    onProgress?.({ phase: '基本設定を生成中', current: 1, total: TOTAL_PHASES });
    throwIfAborted(signal);
    const plotRaw = await run(buildPlotSkeletonPrompt(seed), { signal });
    const plot = parsePlot(plotRaw);

    // 2. 主要キャラクター
    onProgress?.({ phase: 'キャラクターを生成中', current: 2, total: TOTAL_PHASES });
    throwIfAborted(signal);
    const charactersRaw = await run(buildCharacterSeedPrompt(seed, plot), { signal });
    const characters = parseCharacters(charactersRaw);

    // 3. 推奨構成テンプレート（失敗しても plot / characters は返す）
    onProgress?.({ phase: '構成を推定中', current: 3, total: TOTAL_PHASES });
    throwIfAborted(signal);
    let structure: SkeletonResult['structure'];
    try {
        const structureRaw = await run(
            buildStructureInferencePrompt({
                synopsis: buildSynopsisFromPlot(plot),
                theme: plot.theme,
                setting: plot.setting,
                chaptersDigest: '（章は未作成）',
                structureCatalog: buildStructureCatalog(),
            }),
            { signal, maxPromptLength: INFER_STRUCTURE_PROMPT_CAP }
        );
        structure = parseStructureInference(structureRaw) ?? undefined;
    } catch (err) {
        // 中断は伝播、それ以外は構成なしで続行
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        structure = undefined;
    }

    return { plot, characters, structure };
}
