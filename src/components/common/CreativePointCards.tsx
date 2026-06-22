/**
 * CreativePointCards（Phase C）- 創造ポイントの独立カード一覧
 *
 * 確認モーダル内で本文プレビューの下に表示する。各ポイントは「現在の推奨案」と
 * 「別案（帰結1行付き）」を持つ。各カードでは別案を1つだけラジオ選択でき
 * （既定＝現在の推奨案のまま）、複数カードの選択をためてから末尾の
 * 「別案で生成し直す」ボタンで一括して1回だけ再生成する。
 */

import React, { useMemo, useState } from 'react';
import { Lightbulb, RefreshCw, Check } from 'lucide-react';
import { CreativePoint, CreativePointSelection } from '../../types/creativePoint';

interface CreativePointCardsProps {
    points: CreativePoint[];
    /** 別案で再生成。選択した複数別案をまとめて1回実行する（呼び出し側でモーダルを閉じる想定） */
    onRegenerate: (selections: CreativePointSelection[]) => void;
    disabled?: boolean;
}

export const CreativePointCards: React.FC<CreativePointCardsProps> = ({ points, onRegenerate, disabled }) => {
    // pointId -> 選択中の alternativeId（未選択＝現在の推奨案のまま）
    const [selected, setSelected] = useState<Record<string, string | null>>({});

    // 同一カード内は1つだけ。再選択でトグル解除（現在の推奨案のままに戻る）
    const choose = (pointId: string, altId: string) => {
        setSelected((prev) => ({
            ...prev,
            [pointId]: prev[pointId] === altId ? null : altId,
        }));
    };

    const selections = useMemo<CreativePointSelection[]>(() => {
        const result: CreativePointSelection[] = [];
        points.forEach((point) => {
            const altId = selected[point.id];
            if (!altId) return;
            const alternative = point.alternatives.find((a) => a.id === altId);
            if (alternative) result.push({ point, alternative });
        });
        return result;
    }, [points, selected]);

    if (points.length === 0) return null;

    const hasSelection = selections.length > 0;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                    創造ポイント（作者の判断で物語が分かれる箇所）
                </h4>
            </div>
            <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                変えたい箇所だけ別案を選び、最後に「別案で生成し直す」を押してください。各カードで選べるのは1つです。選ばなければ現在の推奨案のままになります。
            </p>

            <div className="space-y-3">
                {points.map((point) => (
                    <div
                        key={point.id}
                        className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 p-3"
                    >
                        <p className="text-sm font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                            💡 {point.label}
                        </p>
                        {point.current && (
                            <p className="mt-1 text-xs text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
                                <span className="font-medium">現在:</span> {point.current}
                            </p>
                        )}

                        <div className="mt-2 space-y-1.5">
                            {point.alternatives.map((alt) => {
                                const isSelected = selected[point.id] === alt.id;
                                return (
                                    <button
                                        key={alt.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        disabled={disabled}
                                        onClick={() => choose(point.id, alt.id)}
                                        className={`w-full text-left rounded-md border px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group ${
                                            isSelected
                                                ? 'border-amber-400 dark:border-amber-500 bg-amber-100/70 dark:bg-amber-900/30 ring-1 ring-amber-300 dark:ring-amber-700'
                                                : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                        }`}
                                    >
                                        <span className="flex items-start gap-2">
                                            {isSelected ? (
                                                <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <RefreshCw className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5 group-hover:rotate-90 transition-transform" />
                                            )}
                                            <span className="min-w-0">
                                                <span className="block text-xs font-medium text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                                                    別案: {alt.summary}
                                                </span>
                                                {alt.consequence && (
                                                    <span className="block text-[11px] text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] mt-0.5">
                                                        → {alt.consequence}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP']">
                    {hasSelection ? `${selections.length}件の別案を選択中` : '別案は未選択'}
                </span>
                <button
                    type="button"
                    onClick={() => onRegenerate(selections)}
                    disabled={disabled || !hasSelection}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors font-['Noto_Sans_JP'] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className="h-4 w-4" />
                    <span>別案で生成し直す</span>
                </button>
            </div>
        </div>
    );
};
