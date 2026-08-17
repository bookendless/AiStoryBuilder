/**
 * ローカル品質メトリクス（定型表現・反復・章順の傾き）
 *
 * すべてAI不要の決定的な計算なので、期待値を素の入力で固定できる。
 * 「計測できない」を 0 と区別することを重点的に確認する。0 を返すと
 * 短い章・空の章が「反復のない優秀な章」として上位に見えてしまうため。
 */

import { describe, it, expect } from 'vitest';
import { computeSlop, SLOP_DENSITY_BASE_CHARS } from '../../services/metrics/slop';
import {
    computeRepetitionRate,
    computeCarryOverRate,
    MIN_TOKENS_FOR_REPETITION,
} from '../../services/metrics/repetition';
import { computeTrend, toTrendDirection, MIN_POINTS_FOR_TREND } from '../../services/metrics/degradation';
import { computeProjectQualityMetrics } from '../../services/metrics/projectMetrics';
import { buildSlopPromptExamples } from '../../services/metrics/slopDictionary';
import { SYSTEM_PROMPT } from '../../services/prompts/common';
import { Chapter } from '../../types/project/chapter';

/** 反復率の下限を超える長さの本文を作る */
const longBody = (unit: string): string => unit.repeat(80);

describe('computeSlop', () => {
    it('定型表現を数え、1000字あたりの密度にする', () => {
        // 100字ちょうどの本文に2件 → 密度 20
        const base = 'まるで夢を見ているかのようだった。言葉を失った。';
        const text = base + 'あ'.repeat(100 - base.length);
        const result = computeSlop(text);

        expect(result.totalCount).toBe(2);
        expect(result.density).toBeCloseTo((2 * SLOP_DENSITY_BASE_CHARS) / 100, 5);
    });

    it('当たった表現を件数の多い順に返す（書き手が現物を確認できるように）', () => {
        const result = computeSlop('息を呑む。息を呑んだ。言葉を失った。');
        expect(result.hits[0]).toEqual({ label: '息を呑む', count: 2 });
        expect(result.hits[1]).toEqual({ label: '言葉を失う', count: 1 });
    });

    it('文をまたぐ組み合わせは拾わない', () => {
        // 「まるで」と「のよう」が別の文にある場合はマッチさせない
        expect(computeSlop('まるで違う。それは彼のようだ。').totalCount).toBe(0);
    });

    it('「か」の有無どちらの直喩も拾う（実際に多いのは か なしの形）', () => {
        expect(computeSlop('まるで夢を見ているかのようだった。').totalCount).toBe(1);
        expect(computeSlop('まるで夢のようだった。').totalCount).toBe(1);
    });

    it('同じ辞書を続けて使っても結果が変わらない（正規表現の状態を持ち越さない）', () => {
        const text = 'まるで夢のようだった。';
        const first = computeSlop(text).totalCount;
        const second = computeSlop(text).totalCount;
        expect(second).toBe(first);
        expect(first).toBe(1);
    });

    it('空文字では密度0（ゼロ除算しない）', () => {
        const result = computeSlop('');
        expect(result.density).toBe(0);
        expect(result.totalCount).toBe(0);
    });
});

describe('SYSTEM_PROMPT との共通化', () => {
    it('辞書から組み立てた例示が、従来のプロンプト文言と一字一句同じ', () => {
        // 辞書を触ったつもりでプロンプトの文言を変えてしまうと、生成物の傾向が黙って変わる
        expect(buildSlopPromptExamples()).toBe(
            '「まるで〜かのようだった」「〜と言っても過言ではない」「それは…の始まりだった」'
        );
    });

    it('SYSTEM_PROMPT に従来の禁止例がそのまま含まれている', () => {
        expect(SYSTEM_PROMPT).toContain(
            '定型的な締めや翻訳調の常套句（「まるで〜かのようだった」「〜と言っても過言ではない」「それは…の始まりだった」など）を避ける'
        );
    });
});

describe('computeRepetitionRate', () => {
    it('短すぎる本文は null（0を返すと「反復のない章」に見えてしまう）', () => {
        expect(computeRepetitionRate('短い文章。')).toBeNull();
        expect(computeRepetitionRate('')).toBeNull();
    });

    it('同じ一文の繰り返しは反復率が高い', () => {
        const rate = computeRepetitionRate(longBody('彼は静かに扉を開けた。'));
        expect(rate).not.toBeNull();
        expect(rate as number).toBeGreaterThan(0.9);
    });

    it('内容が変化する本文のほうが反復率は低い', () => {
        const repeated = computeRepetitionRate(longBody('彼は静かに扉を開けた。')) as number;
        let varied = '';
        for (let i = 0; i < 80; i++) {
            varied += `${i}番目の朝、彼女は違う道を選び、知らない街の匂いを覚えた。`;
        }
        const variedRate = computeRepetitionRate(varied) as number;
        expect(variedRate).toBeLessThan(repeated);
    });

    it('計測の下限がトークン数で効いている', () => {
        // 下限に満たない長さでは、内容にかかわらず null
        const short = 'あ'.repeat(Math.floor(MIN_TOKENS_FOR_REPETITION / 4));
        expect(computeRepetitionRate(short)).toBeNull();
    });
});

describe('computeCarryOverRate', () => {
    it('同じ本文なら再利用率はほぼ1', () => {
        const body = longBody('彼は静かに扉を開けた。');
        const rate = computeCarryOverRate(body, body);
        expect(rate).not.toBeNull();
        expect(rate as number).toBeGreaterThan(0.99);
    });

    it('無関係な本文なら再利用率は低い', () => {
        const rate = computeCarryOverRate(
            longBody('潮風が甲板を洗い、帆綱が軋んだ。'),
            longBody('計算式の誤りを指摘され、彼は黒板を睨んだ。')
        ) as number;
        expect(rate).toBeLessThan(0.2);
    });

    it('どちらかが短すぎれば null', () => {
        expect(computeCarryOverRate('短い。', longBody('彼は歩いた。'))).toBeNull();
        expect(computeCarryOverRate(longBody('彼は歩いた。'), '短い。')).toBeNull();
    });
});

describe('computeTrend', () => {
    it('増加傾向は正の傾きになる', () => {
        const trend = computeTrend([1, 2, 3, 4, 5]);
        expect(trend.slope).toBeCloseTo(1, 5);
        expect(toTrendDirection(trend)).toBe('up');
    });

    it('減少傾向は負の傾きになる', () => {
        expect(toTrendDirection(computeTrend([5, 4, 3, 2, 1]))).toBe('down');
    });

    it('横ばいは flat', () => {
        expect(toTrendDirection(computeTrend([3, 3, 3, 3, 3]))).toBe('flat');
    });

    it('点が足りなければ判定不能（1章の外れ値で符号が反転するため）', () => {
        const trend = computeTrend(Array(MIN_POINTS_FOR_TREND - 1).fill(1));
        expect(trend.slope).toBeNull();
        expect(toTrendDirection(trend)).toBe('unknown');
    });

    it('計測不能な章は詰めずに読み飛ばす（詰めると傾きが実際より急になる）', () => {
        // x=0,2,4,6 に y=0,1,2,3 → 傾き 0.5。詰めて x=0,1,2,3 とすると 1 になってしまう
        const trend = computeTrend([0, null, 1, null, 2, null, 3]);
        expect(trend.slope).toBeCloseTo(0.5, 5);
        expect(trend.points).toBe(4);
    });

    it('平均が0付近なら相対傾きは出さない（発散を避ける）', () => {
        const trend = computeTrend([0, 0, 0, 0]);
        expect(trend.relativeSlope).toBeNull();
        expect(toTrendDirection(trend)).toBe('unknown');
    });
});

describe('computeProjectQualityMetrics', () => {
    const chapter = (id: string, draft?: string): Chapter => ({
        id,
        title: `章${id}`,
        summary: '',
        draft,
    });

    it('草案の無い章は計測から外し、外した数を返す', () => {
        const result = computeProjectQualityMetrics([
            chapter('1', longBody('彼は歩いた。')),
            chapter('2'),
            chapter('3', '   '),
        ]);
        expect(result.measuredChapters).toBe(1);
        expect(result.skippedChapters).toBe(2);
        expect(result.chapters).toHaveLength(1);
    });

    it('章番号は元の並び順を保つ（除外しても番号がずれない）', () => {
        const result = computeProjectQualityMetrics([
            chapter('1'),
            chapter('2', longBody('彼は歩いた。')),
        ]);
        expect(result.chapters[0].number).toBe(2);
    });

    it('最初の計測章には前章からの再利用率が無い', () => {
        const result = computeProjectQualityMetrics([
            chapter('1', longBody('彼は歩いた。')),
            chapter('2', longBody('彼女は走った。')),
        ]);
        expect(result.chapters[0].carryOverRate).toBeNull();
        expect(result.chapters[1].carryOverRate).not.toBeNull();
    });

    it('空章を挟んでも、直前の本文を持つ章と比較する', () => {
        const body = longBody('彼は静かに扉を開けた。');
        const result = computeProjectQualityMetrics([
            chapter('1', body),
            chapter('2'),
            chapter('3', body),
        ]);
        expect(result.chapters[1].carryOverRate as number).toBeGreaterThan(0.99);
    });

    it('章が無ければ空の結果を返す', () => {
        const result = computeProjectQualityMetrics([]);
        expect(result.measuredChapters).toBe(0);
        expect(result.averages.repetitionRate).toBeNull();
    });

    /** 定型表現をちょうど density 件含む1000字の本文（密度＝件数になる） */
    const bodyWithSlopDensity = (density: number): string => {
        const phrase = '言葉を失った。';
        return phrase.repeat(density) + 'あ'.repeat(1000 - phrase.length * density);
    };

    it('傾きは元の章番号を x に使う（本文の無い章の区間を詰めない）', () => {
        // 詰めて計算すると、間が空いている作品の劣化が実際より急に見える
        const densities = [1, 2, 3, 4];
        const contiguous = computeProjectQualityMetrics(
            densities.map((d, i) => chapter(String(i + 1), bodyWithSlopDensity(d)))
        );
        expect(contiguous.trends.slopDensity.slope).toBeCloseTo(1, 5);

        // 同じ4章を1章ずつ空けて配置（第1・3・5・7章）→ 1章あたりの変化は半分になる
        const spaced: Chapter[] = [];
        densities.forEach((d, i) => {
            spaced.push(chapter(`m${i}`, bodyWithSlopDensity(d)));
            spaced.push(chapter(`e${i}`));
        });
        const result = computeProjectQualityMetrics(spaced);
        expect(result.trends.slopDensity.slope).toBeCloseTo(0.5, 5);
    });
});
