import { describe, it, expect } from 'vitest';
import { composeRecapDigest } from '../../../services/recap/generateRecap';

const lines = [
    '第1章「始まり」: 主人公が村を出る',
    '第2章「出会い」: 賢者と出会い弟子入りする',
    '第3章「修行」: 山での修行の日々',
    '第4章「事件」: 王都で盗難事件が起きる',
    '第5章「追跡」: 犯人を追って港町へ',
    '第6章「対決」: 犯人との対決',
];

describe('composeRecapDigest', () => {
    it('全章が予算内なら中略なしで全行を返す', () => {
        const result = composeRecapDigest(lines, new Map(), 10000);
        expect(result).toBe(lines.join('\n'));
        expect(result).not.toContain('（中略）');
    });

    it('予算が足りない場合は直近章を優先確保する', () => {
        // 直近3章分＋α程度の予算
        const budget = lines[3].length + lines[4].length + lines[5].length + 10;
        const result = composeRecapDigest(lines, new Map(), budget);
        expect(result).toContain('第6章');
        expect(result).toContain('第5章');
        expect(result).not.toContain('第1章');
        expect(result).toContain('（中略）');
    });

    it('スコアの高い過去章が予算内で追加される', () => {
        const budget = lines.reduce((s, l) => s + l.length + 1, 0) - lines[2].length - lines[0].length;
        // 第2章（index 1）に高スコア、他の過去章はスコアなし
        const scores = new Map<number, number>([[1, 0.9]]);
        const result = composeRecapDigest(lines, scores, budget);
        expect(result).toContain('第2章');
        expect(result).toContain('第6章');
    });

    it('出力は章順を維持し、飛んだ箇所に中略が入る', () => {
        const scores = new Map<number, number>([[0, 0.9]]);
        const budget = lines[0].length + lines[3].length + lines[4].length + lines[5].length + 20;
        const result = composeRecapDigest(lines, scores, budget);
        const pos1 = result.indexOf('第1章');
        const posSkip = result.indexOf('（中略）');
        const pos4 = result.indexOf('第4章');
        expect(pos1).toBeGreaterThanOrEqual(0);
        expect(posSkip).toBeGreaterThan(pos1);
        expect(pos4).toBeGreaterThan(posSkip);
    });

    it('空の行配列は空文字列を返す', () => {
        expect(composeRecapDigest([], new Map(), 1000)).toBe('');
    });
});
