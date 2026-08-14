import { describe, it, expect } from 'vitest';
import { MAX_QUOTE_LENGTH, normalizeForQuoteMatch, quoteExists } from '../../services/quotes/verifyQuote';
import { normalizeWeaknessDetails } from '../../services/evaluation/normalizeWeaknessDetails';
import { validateIssues } from '../../services/consistency/validateIssues';

describe('quoteExists / normalizeForQuoteMatch', () => {
    it('本文に一字一句あれば true、なければ false', () => {
        const text = normalizeForQuoteMatch('彼は静かに扉を開けた。外は雨だった。');
        expect(quoteExists('静かに扉を開けた', text)).toBe(true);
        expect(quoteExists('乱暴に扉を開けた', text)).toBe(false);
    });

    it('空の引用・長すぎる引用は検証できないものとして false', () => {
        const text = normalizeForQuoteMatch('あ'.repeat(500));
        expect(quoteExists('', text)).toBe(false);
        expect(quoteExists('あ'.repeat(MAX_QUOTE_LENGTH + 1), text)).toBe(false);
        expect(quoteExists('あ'.repeat(MAX_QUOTE_LENGTH), text)).toBe(true);
    });

    it('サニタイズで <> が消えるため、生本文ではなく正規化後と照合する', () => {
        // AIが読むのはサニタイズ後（<> が除去された）の本文
        const raw = '彼は<強く>頷いた。';
        const normalized = normalizeForQuoteMatch(raw);

        expect(normalized).toBe('彼は強く頷いた。');
        // AIは <> のない形で引用してくる。生本文と比べると一致しないが、正規化後なら一致する
        expect(raw.includes('彼は強く頷いた')).toBe(false);
        expect(quoteExists('彼は強く頷いた', normalized)).toBe(true);
    });

    it('サニタイズで連続改行が圧縮されても照合できる', () => {
        const normalized = normalizeForQuoteMatch('一行目。\n\n\n\n二行目。');
        expect(quoteExists('一行目。\n\n二行目。', normalized)).toBe(true);
    });
});

describe('normalizeWeaknessDetails（講評: 引用のみ落とす方針）', () => {
    const content = '彼女は窓の外をぼんやりと眺めていた。';

    it('実在する引用は保持する', () => {
        const result = normalizeWeaknessDetails(
            [{ point: '心情描写が浅い', quote: '窓の外をぼんやりと眺めていた' }],
            content
        );
        expect(result).toEqual([{ point: '心情描写が浅い', quote: '窓の外をぼんやりと眺めていた' }]);
    });

    it('実在しない引用は落とすが、指摘自体は残す（整合性ガードの破棄方針とは異なる）', () => {
        const result = normalizeWeaknessDetails(
            [{ point: '心情描写が浅い', quote: '本文に存在しない文章' }],
            content
        );
        expect(result).toEqual([{ point: '心情描写が浅い' }]);
    });

    it('quote が無くても指摘は残す', () => {
        const result = normalizeWeaknessDetails([{ point: '全体的に説明が多い' }], content);
        expect(result).toEqual([{ point: '全体的に説明が多い' }]);
    });

    it('point が無い要素と配列以外は無視する', () => {
        expect(normalizeWeaknessDetails([{ quote: '窓の外を' }, null, 'x'], content)).toEqual([]);
        expect(normalizeWeaknessDetails(undefined, content)).toEqual([]);
        expect(normalizeWeaknessDetails('weaknessDetails', content)).toEqual([]);
    });
});

describe('validateIssues（整合性ガード: 実在しない指摘は破棄）', () => {
    const chapterText = '蒼真の瞳は黒く、静かな光をたたえていた。';

    it('実在する引用の指摘だけを残す', () => {
        const issues = validateIssues(
            {
                issues: [
                    { quote: '蒼真の瞳は黒く', category: 'appearance', description: '設定では青', severity: 'high' },
                    { quote: '存在しない記述', category: 'appearance', description: '幻覚の指摘', severity: 'high' },
                ],
            },
            chapterText
        );

        expect(issues).toHaveLength(1);
        expect(issues[0].quote).toBe('蒼真の瞳は黒く');
    });

    it('サニタイズで変化する本文でも正当な指摘を落とさない', () => {
        const rawText = '蒼真の瞳は<とても>黒かった。';
        const issues = validateIssues(
            {
                issues: [
                    { quote: '蒼真の瞳はとても黒かった', category: 'appearance', description: '設定では青', severity: 'high' },
                ],
            },
            rawText
        );

        expect(issues).toHaveLength(1);
    });

    it('カテゴリが不正な指摘・説明のない指摘は破棄する', () => {
        const issues = validateIssues(
            {
                issues: [
                    { quote: '蒼真の瞳は黒く', category: 'unknown', description: '説明', severity: 'high' },
                    { quote: '蒼真の瞳は黒く', category: 'appearance', description: '', severity: 'high' },
                ],
            },
            chapterText
        );
        expect(issues).toHaveLength(0);
    });

    it('同一の引用と説明の組み合わせは重複除去する', () => {
        const issues = validateIssues(
            {
                issues: [
                    { quote: '蒼真の瞳は黒く', category: 'appearance', description: '設定では青', severity: 'high' },
                    { quote: '蒼真の瞳は黒く', category: 'appearance', description: '設定では青', severity: 'low' },
                ],
            },
            chapterText
        );
        expect(issues).toHaveLength(1);
    });
});
