import React, { useMemo, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useProject } from '../../contexts/useProject';
import {
    computeProjectQualityMetrics,
    ChapterQualityMetrics,
    HIGHLIGHT_RATIO,
} from '../../services/metrics/projectMetrics';
import { toTrendDirection, TrendResult, TrendDirection } from '../../services/metrics/degradation';
import { SLOP_DENSITY_BASE_CHARS } from '../../services/metrics/slop';

/**
 * QualityMetricsPanel - 品質メトリクス
 *
 * 章ごとの定型表現の密度・言い回しの反復率・文体の数値を、AIを使わず決定的に計測して並べる。
 * 絶対的な良し悪しの基準は持たない（日本語の常套句は正当な表現でもある）。
 * 用途は作品内での比較と、プロンプトや書き方を変えた前後の比較。
 */

interface QualityMetricsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const percent = (value: number | null): string =>
    value === null ? '—' : `${(value * 100).toFixed(1)}%`;

const TREND_ICONS: Record<TrendDirection, React.ReactNode> = {
    up: <TrendingUp className="h-4 w-4" />,
    down: <TrendingDown className="h-4 w-4" />,
    flat: <Minus className="h-4 w-4" />,
    unknown: <Minus className="h-4 w-4 opacity-40" />,
};

const TrendCell: React.FC<{ label: string; trend: TrendResult; higherIsWorse: boolean }> = ({
    label,
    trend,
    higherIsWorse,
}) => {
    const direction = toTrendDirection(trend);
    // 「増えているのが悪い指標」かどうかで色を変える。文長のように
    // どちらが良いとも言えない指標は higherIsWorse=false で中立色にする
    const tone =
        direction === 'unknown' || direction === 'flat'
            ? 'text-gray-500 dark:text-gray-400'
            : higherIsWorse && direction === 'up'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-300';

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">{label}</div>
            <div className={`flex items-center gap-1.5 mt-1 ${tone}`}>
                {TREND_ICONS[direction]}
                <span className="text-sm font-['Noto_Sans_JP']">
                    {direction === 'unknown'
                        ? `判定不能（${trend.points}章）`
                        : direction === 'flat'
                            ? '横ばい'
                            : `1章あたり ${trend.relativeSlope !== null ? (trend.relativeSlope * 100).toFixed(1) : '—'}%`}
                </span>
            </div>
        </div>
    );
};

export const QualityMetricsPanel: React.FC<QualityMetricsPanelProps> = ({ isOpen, onClose }) => {
    const { currentProject } = useProject();
    const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

    // 全章の本文を走査するため、閉じている間は計算しない
    const metrics = useMemo(() => {
        if (!isOpen || !currentProject) return null;
        return computeProjectQualityMetrics(currentProject.chapters);
    }, [isOpen, currentProject]);

    if (!isOpen) return null;

    const isHighSlop = (chapter: ChapterQualityMetrics): boolean =>
        !!metrics &&
        metrics.averages.slopDensity > 0 &&
        chapter.slopDensity > metrics.averages.slopDensity * HIGHLIGHT_RATIO;

    const isHighRepetition = (chapter: ChapterQualityMetrics): boolean =>
        !!metrics &&
        metrics.averages.repetitionRate !== null &&
        chapter.repetitionRate !== null &&
        chapter.repetitionRate > metrics.averages.repetitionRate * HIGHLIGHT_RATIO;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="品質メトリクス" size="xl">
            <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP'] space-y-1">
                        <p>本文だけから機械的に計算した数値です。AIは使わないため、費用はかかりません。</p>
                        <p className="text-blue-700 dark:text-blue-300">
                            数値そのものに合格ラインはありません。定型表現も反復も、日本語として正当な表現です。
                            章どうしの比較や、書き方を変える前後の比較として読んでください。
                        </p>
                    </div>
                </div>

                {!metrics || metrics.measuredChapters === 0 ? (
                    <p className="text-center py-10 text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        草案のある章がまだありません。本文を書くと計測できます。
                    </p>
                ) : (
                    <>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                                章順の推移
                            </h4>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <TrendCell label="定型表現の密度" trend={metrics.trends.slopDensity} higherIsWorse />
                                <TrendCell label="反復率" trend={metrics.trends.repetitionRate} higherIsWorse />
                                <TrendCell
                                    label="平均文長"
                                    trend={metrics.trends.avgSentenceLength}
                                    higherIsWorse={false}
                                />
                                <TrendCell
                                    label="会話比率"
                                    trend={metrics.trends.dialogueRatio}
                                    higherIsWorse={false}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-['Noto_Sans_JP']">
                                後半の章ほど定型表現と反復が増えていく場合、まとめ書きによる劣化の兆候です。
                                章ごとの生成に切り替えると改善することがあります。
                            </p>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                                章別（{metrics.measuredChapters}章を計測
                                {metrics.skippedChapters > 0 && `・草案なしの${metrics.skippedChapters}章は除外`}）
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm font-['Noto_Sans_JP']">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                            <th className="py-2 pr-3 font-medium">章</th>
                                            <th className="py-2 px-3 font-medium text-right">文字数</th>
                                            <th className="py-2 px-3 font-medium text-right">
                                                定型表現<span className="font-normal">（/{SLOP_DENSITY_BASE_CHARS}字）</span>
                                            </th>
                                            <th className="py-2 px-3 font-medium text-right">反復率</th>
                                            <th className="py-2 px-3 font-medium text-right">前章からの再利用</th>
                                            <th className="py-2 px-3 font-medium text-right">会話比率</th>
                                            <th className="py-2 px-3 font-medium text-right">平均文長</th>
                                            <th className="py-2 pl-3 font-medium text-right">文長のばらつき</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.chapters.map(chapter => {
                                            const isExpanded = expandedChapterId === chapter.chapterId;
                                            return (
                                                <React.Fragment key={chapter.chapterId}>
                                                    <tr
                                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                                                        onClick={() =>
                                                            setExpandedChapterId(isExpanded ? null : chapter.chapterId)
                                                        }
                                                    >
                                                        <td className="py-2 pr-3">
                                                            <span className="flex items-center gap-1 text-gray-900 dark:text-white">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                                                                ) : (
                                                                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                                                                )}
                                                                <span className="truncate max-w-[14rem]">
                                                                    第{chapter.number}章 {chapter.title}
                                                                </span>
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">
                                                            {chapter.totalChars.toLocaleString()}
                                                        </td>
                                                        <td
                                                            className={`py-2 px-3 text-right ${isHighSlop(chapter)
                                                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                                                : 'text-gray-600 dark:text-gray-300'
                                                                }`}
                                                        >
                                                            {chapter.slopDensity.toFixed(2)}
                                                        </td>
                                                        <td
                                                            className={`py-2 px-3 text-right ${isHighRepetition(chapter)
                                                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                                                : 'text-gray-600 dark:text-gray-300'
                                                                }`}
                                                        >
                                                            {percent(chapter.repetitionRate)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">
                                                            {percent(chapter.carryOverRate)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">
                                                            {percent(chapter.dialogueRatio)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-300">
                                                            {Math.round(chapter.avgSentenceLength)}字
                                                        </td>
                                                        <td className="py-2 pl-3 text-right text-gray-600 dark:text-gray-300">
                                                            {chapter.sentenceLengthCV.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                                                            <td colSpan={8} className="py-3 px-3">
                                                                {chapter.slopHits.length === 0 ? (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                        辞書にある定型表現は見つかりませんでした。
                                                                    </p>
                                                                ) : (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {chapter.slopHits.map(hit => (
                                                                            <span
                                                                                key={hit.label}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                                                                            >
                                                                                {hit.label}
                                                                                <span className="text-gray-500 dark:text-gray-400">
                                                                                    ×{hit.count}
                                                                                </span>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-['Noto_Sans_JP']">
                                章名をクリックすると、その章で当たった定型表現の内訳が出ます。
                                色が付くのは作品内の平均の{HIGHLIGHT_RATIO}倍を超えた章です。
                                反復率は日本語を文字単位で分解して数えているため絶対値は高めに出ます。章どうしの比較に使ってください。
                            </p>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
