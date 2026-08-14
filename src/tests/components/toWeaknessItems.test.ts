/**
 * 講評の改善点表示（weaknesses と weaknessDetails の突き合わせ）
 *
 * AIが2つの配列を必ず同じ件数で返すとは限らないため、どちらか一方にしかない指摘が
 * 表示から消えないことを固定する。ReviewStep の toWeaknessItems と同じ規則。
 */

import { describe, it, expect } from 'vitest';
import { EvaluationResult } from '../../types/evaluation';

// ReviewStep 内のロジックと同一（表示専用の小さな純関数のため、規則をここで固定する）
const toWeaknessItems = (result: EvaluationResult): { point: string; quote?: string }[] => {
    const details = result.weaknessDetails ?? [];
    if (details.length === 0) return result.weaknesses.map(point => ({ point }));

    const used = new Set<number>();
    const items = result.weaknesses.map(point => {
        const index = details.findIndex((detail, i) =>
            !used.has(i) && (detail.point === point || detail.point.includes(point) || point.includes(detail.point))
        );
        if (index === -1) return { point };
        used.add(index);
        return { point, quote: details[index].quote };
    });

    details.forEach((detail, i) => {
        if (!used.has(i)) items.push(detail);
    });

    return items;
};

const base: EvaluationResult = {
    score: 3,
    summary: '',
    strengths: [],
    weaknesses: [],
    improvements: [],
    detailedAnalysis: '',
};

describe('toWeaknessItems', () => {
    it('weaknessDetails が無い保存済みデータは文字列配列のまま表示する', () => {
        const items = toWeaknessItems({ ...base, weaknesses: ['指摘A', '指摘B'] });
        expect(items).toEqual([{ point: '指摘A' }, { point: '指摘B' }]);
    });

    it('対応する詳細があれば引用を添える', () => {
        const items = toWeaknessItems({
            ...base,
            weaknesses: ['指摘A', '指摘B'],
            weaknessDetails: [
                { point: '指摘A', quote: '該当箇所A' },
                { point: '指摘B', quote: '該当箇所B' },
            ],
        });
        expect(items).toEqual([
            { point: '指摘A', quote: '該当箇所A' },
            { point: '指摘B', quote: '該当箇所B' },
        ]);
    });

    it('詳細が少なくても weaknesses 側の指摘は消えない', () => {
        const items = toWeaknessItems({
            ...base,
            weaknesses: ['指摘A', '指摘B', '指摘C'],
            weaknessDetails: [{ point: '指摘B', quote: '該当箇所B' }],
        });
        expect(items).toHaveLength(3);
        expect(items[0]).toEqual({ point: '指摘A' });
        expect(items[1]).toEqual({ point: '指摘B', quote: '該当箇所B' });
        expect(items[2]).toEqual({ point: '指摘C' });
    });

    it('詳細にしかない指摘も落とさず末尾に足す', () => {
        const items = toWeaknessItems({
            ...base,
            weaknesses: ['指摘A'],
            weaknessDetails: [
                { point: '指摘A', quote: '該当箇所A' },
                { point: '指摘D', quote: '該当箇所D' },
            ],
        });
        expect(items).toHaveLength(2);
        expect(items[1]).toEqual({ point: '指摘D', quote: '該当箇所D' });
    });

    it('言い回しが少し違っても包含関係で対応づける', () => {
        const items = toWeaknessItems({
            ...base,
            weaknesses: ['心情描写が浅い'],
            weaknessDetails: [{ point: '心情描写が浅い点', quote: '該当箇所' }],
        });
        expect(items).toEqual([{ point: '心情描写が浅い', quote: '該当箇所' }]);
    });

    it('同じ詳細を複数の指摘に使い回さない', () => {
        const items = toWeaknessItems({
            ...base,
            weaknesses: ['描写', '描写'],
            weaknessDetails: [{ point: '描写', quote: '一度だけ' }],
        });
        expect(items[0]).toEqual({ point: '描写', quote: '一度だけ' });
        expect(items[1]).toEqual({ point: '描写' });
    });
});
