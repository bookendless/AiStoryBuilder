/**
 * 骨組みプレビューの1行表示コンポーネント
 *
 * skeletonPreview.tsx は非コンポーネント（buildSkeletonPreview）をexportするため、
 * Fast Refresh を有効に保つ目的でコンポーネントを本ファイルへ分離している。
 */

import React from 'react';

export const SkeletonPreviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) =>
    value ? (
        <div className="text-sm">
            <span className="font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
                {label}:
            </span>{' '}
            <span className="text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">{value}</span>
        </div>
    ) : null;
