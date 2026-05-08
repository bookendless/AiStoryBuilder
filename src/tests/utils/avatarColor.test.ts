import { describe, it, expect } from 'vitest';
import { getAvatarColor, getAvatarInitial } from '../../utils/avatarColor';

describe('avatarColor', () => {
    describe('getAvatarColor', () => {
        it('同じ名前は常に同じ色を返す', () => {
            expect(getAvatarColor('太郎')).toBe(getAvatarColor('太郎'));
            expect(getAvatarColor('Alice')).toBe(getAvatarColor('Alice'));
        });

        it('空文字・undefined・null はフォールバック色を返す', () => {
            const fallback = getAvatarColor('');
            expect(getAvatarColor(undefined)).toBe(fallback);
            expect(getAvatarColor(null)).toBe(fallback);
        });

        it('返り値は #RRGGBB 形式のカラーコード', () => {
            expect(getAvatarColor('花子')).toMatch(/^#[0-9a-f]{6}$/i);
        });

        it('十分な多様性がある（3人以上で2色以上が登場する想定）', () => {
            const names = ['太郎', '花子', '次郎', '三郎', '四郎', '五郎'];
            const colors = new Set(names.map(getAvatarColor));
            expect(colors.size).toBeGreaterThan(1);
        });
    });

    describe('getAvatarInitial', () => {
        it('先頭1文字を返す', () => {
            expect(getAvatarInitial('太郎')).toBe('太');
            expect(getAvatarInitial('Alice')).toBe('A');
        });

        it('空・undefined・null は「？」を返す', () => {
            expect(getAvatarInitial('')).toBe('？');
            expect(getAvatarInitial('   ')).toBe('？');
            expect(getAvatarInitial(undefined)).toBe('？');
            expect(getAvatarInitial(null)).toBe('？');
        });
    });
});
