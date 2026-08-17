/**
 * 作品全体の品質メトリクス集計
 *
 * 章ごとに決定的な指標を出し、章順の傾きを添える。AI呼び出しは一切しない。
 * 保存もしない（都度計算）。履歴が必要になった時点で専用DBへ切り出す。
 */

import { Chapter } from '../../types/project/chapter';
import { computeStyleMetrics } from '../import/analyzeStyleMetrics';
import { computeSlop, SlopHit } from './slop';
import { computeRepetitionRate, computeCarryOverRate } from './repetition';
import { computeTrend, TrendResult } from './degradation';

export interface ChapterQualityMetrics {
    chapterId: string;
    title: string;
    /** 章番号（1始まり。本文の無い章を除外しても元の番号を保つ） */
    number: number;
    totalChars: number;
    /** 定型表現の1000字あたり出現数 */
    slopDensity: number;
    slopHits: SlopHit[];
    /** 章内の n-gram 反復率（0〜1）。短すぎる章は null */
    repetitionRate: number | null;
    /** 直前の（本文を持つ）章からの言い回し再利用率（0〜1）。測れない場合は null */
    carryOverRate: number | null;
    dialogueRatio: number;
    avgSentenceLength: number;
    sentenceLengthCV: number;
}

export interface ProjectQualityMetrics {
    chapters: ChapterQualityMetrics[];
    /** 本文があった章の数 */
    measuredChapters: number;
    /** 本文が無く計測から外れた章の数（表から消えた理由を説明するため） */
    skippedChapters: number;
    trends: {
        slopDensity: TrendResult;
        repetitionRate: TrendResult;
        avgSentenceLength: TrendResult;
        dialogueRatio: TrendResult;
    };
    /** 全計測章の平均（しきい値ハイライトの基準） */
    averages: {
        slopDensity: number;
        repetitionRate: number | null;
    };
}

/**
 * 平均の何倍を超えたら注意表示にするか。
 * 絶対的な良し悪しの基準は無いので、作品内での相対比較でしか出さない。
 */
export const HIGHLIGHT_RATIO = 1.5;

/** 計測対象にするだけの本文があるか（空白のみの草案を1章として数えない） */
const hasBody = (chapter: Chapter): boolean => (chapter.draft ?? '').trim().length > 0;

export function computeProjectQualityMetrics(chapters: Chapter[]): ProjectQualityMetrics {
    const results: ChapterQualityMetrics[] = [];
    // 直前の「本文を持つ」章。空章を挟んでも接続の比較が途切れないようにする
    let previousBody: string | null = null;
    let skippedChapters = 0;

    chapters.forEach((chapter, index) => {
        if (!hasBody(chapter)) {
            skippedChapters++;
            return;
        }
        const body = (chapter.draft ?? '').trim();
        const style = computeStyleMetrics(body);
        const slop = computeSlop(body);

        results.push({
            chapterId: chapter.id,
            title: chapter.title,
            number: index + 1,
            totalChars: style.totalChars,
            slopDensity: slop.density,
            slopHits: slop.hits,
            repetitionRate: computeRepetitionRate(body),
            carryOverRate: previousBody === null ? null : computeCarryOverRate(body, previousBody),
            dialogueRatio: style.dialogueRatio,
            avgSentenceLength: style.avgSentenceLength,
            sentenceLengthCV: style.sentenceLengthCV,
        });

        previousBody = body;
    });

    const average = (values: (number | null)[]): number | null => {
        const numbers = values.filter((v): v is number => typeof v === 'number');
        if (numbers.length === 0) return null;
        return numbers.reduce((sum, v) => sum + v, 0) / numbers.length;
    };

    // computeTrend は「添字＝章番号」として傾きを出す。計測できた章だけを詰めて渡すと、
    // 本文の無い章を挟んだ区間が縮み、傾きが実際より急になる。
    // 元の章番号の位置に値を置いた疎な系列にして、間隔を保つ
    const byChapterNumber = (pick: (r: ChapterQualityMetrics) => number | null): (number | null)[] => {
        const series: (number | null)[] = new Array<number | null>(chapters.length).fill(null);
        for (const result of results) {
            series[result.number - 1] = pick(result);
        }
        return series;
    };

    return {
        chapters: results,
        measuredChapters: results.length,
        skippedChapters,
        trends: {
            slopDensity: computeTrend(byChapterNumber(r => r.slopDensity)),
            repetitionRate: computeTrend(byChapterNumber(r => r.repetitionRate)),
            avgSentenceLength: computeTrend(byChapterNumber(r => r.avgSentenceLength)),
            dialogueRatio: computeTrend(byChapterNumber(r => r.dialogueRatio)),
        },
        averages: {
            slopDensity: average(results.map(r => r.slopDensity)) ?? 0,
            repetitionRate: average(results.map(r => r.repetitionRate)),
        },
    };
}
