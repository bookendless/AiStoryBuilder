import { describe, it, expect } from 'vitest';
import { getCountColor, getCountBarWidth } from '../../utils/charCount';

describe('charCount', () => {
    describe('getCountColor', () => {
        it('80%以下は若草色（通常）', () => {
            expect(getCountColor(0, 500).bar).toBe('bg-wakagusa-500');
            expect(getCountColor(400, 500).bar).toBe('bg-wakagusa-500'); // 80% 境界
        });

        it('80%超100%以下は山吹色（警告）', () => {
            expect(getCountColor(401, 500).bar).toBe('bg-yamabuki-500');
            expect(getCountColor(500, 500).bar).toBe('bg-yamabuki-500');
        });

        it('100%超は赤（危険）', () => {
            expect(getCountColor(501, 500).bar).toBe('bg-red-500');
            expect(getCountColor(604, 500).bar).toBe('bg-red-500');
        });

        it('max が 0 以下なら通常色を返す（ゼロ除算回避）', () => {
            expect(getCountColor(10, 0).bar).toBe('bg-wakagusa-500');
            expect(getCountColor(10, -1).bar).toBe('bg-wakagusa-500');
        });
    });

    describe('getCountBarWidth', () => {
        it('比率を%で返す', () => {
            expect(getCountBarWidth(250, 500)).toBe(50);
            expect(getCountBarWidth(0, 500)).toBe(0);
        });

        it('100%を超えても100でクランプ', () => {
            expect(getCountBarWidth(800, 500)).toBe(100);
        });

        it('負の値・max 0 はゼロ', () => {
            expect(getCountBarWidth(-10, 500)).toBe(0);
            expect(getCountBarWidth(10, 0)).toBe(0);
        });
    });
});
