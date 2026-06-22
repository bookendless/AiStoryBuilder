/**
 * 骨組み生成結果の確認モーダル用プレビュー（Phase B）
 *
 * PendingResultModal に渡す ReactNode。plot1 6項目の要約・推奨構成・キャラ名一覧を簡潔に表示する。
 */

import React from 'react';
import { SkeletonResult } from '../../types/skeleton';
import { PLOT_STRUCTURE_CONFIGS } from '../steps/plot2/constants';

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) =>
    value ? (
        <div className="text-sm">
            <span className="font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                {label}:
            </span>{' '}
            <span className="text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">{value}</span>
        </div>
    ) : null;

export function buildSkeletonPreview(result: SkeletonResult): React.ReactNode {
    const { plot, characters, structure } = result;
    const structureLabel = structure
        ? PLOT_STRUCTURE_CONFIGS[structure.structure]?.label ?? structure.structure
        : null;

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Row label="メインテーマ" value={plot.theme} />
                <Row label="舞台設定" value={plot.setting} />
                <Row label="フック要素" value={plot.hook} />
                <Row label="主人公の目標" value={plot.protagonistGoal} />
                <Row label="主要な障害" value={plot.mainObstacle} />
                <Row label="物語の結末" value={plot.ending} />
            </div>

            {structureLabel && (
                <div className="text-sm">
                    <span className="font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                        推奨構成:
                    </span>{' '}
                    <span className="text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
                        {structureLabel}
                        {structure?.reason ? `（${structure.reason}）` : ''}
                    </span>
                </div>
            )}

            {characters.length > 0 && (
                <div className="text-sm">
                    <span className="font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                        登場人物（{characters.length}人）:
                    </span>{' '}
                    <span className="text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
                        {characters.map((c) => c.name).join('、')}
                    </span>
                </div>
            )}

            <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] pt-1">
                「反映する」で plot1 の基本設定・推奨構成・登場人物に反映されます。
            </p>
        </div>
    );
}
