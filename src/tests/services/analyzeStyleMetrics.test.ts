import { describe, it, expect } from 'vitest';
import { computeStyleMetrics, formatStyleMetrics } from '../../services/import/analyzeStyleMetrics';

/**
 * 文体の機械計測（Phase A）の決定的判定を固定する。
 * - 会話比率・人称・硬軟・リズムの各しきい値判定
 * - 人称・硬軟は会話文（「」内）を除いた地の文だけで判定する不変条件
 * - 判定材料が不足する軸はラベルを空にする
 */

describe('computeStyleMetrics', () => {
    it('一人称・敬体・短文の本文を正しく判定する', () => {
        const prose = '私は森をゆっくり歩きました。'.repeat(10);
        const m = computeStyleMetrics(prose);
        expect(m.labels.perspective).toBe('一人称（私/僕/俺）');
        expect(m.labels.formality).toBe('柔らかめ');
        expect(m.labels.rhythm).toBe('短文中心');
        expect(m.labels.dialogue).toBe('描写重視');
    });

    it('三人称・常体（である調）の本文を正しく判定する', () => {
        const prose = '彼は静かな男である。彼が剣を取ったのは必然だった。'.repeat(5);
        const m = computeStyleMetrics(prose);
        expect(m.labels.perspective).toBe('三人称（彼/彼女）');
        expect(m.labels.formality).toBe('硬め');
    });

    it('会話文の中の一人称代名詞は人称判定に使わない', () => {
        // 地の文は三人称、セリフ内にだけ「俺は」が出る
        const prose = '「俺は行くぞ。俺は負けない」と彼は言った。彼が走り出すと、彼の影が伸びた。'.repeat(4);
        const m = computeStyleMetrics(prose);
        expect(m.labels.perspective).toBe('三人称（彼/彼女）');
        expect(m.firstPersonCount).toBe(0);
    });

    it('会話比率が高い本文は「会話多め」と判定する', () => {
        const prose = '「こんにちは、今日はいい天気ですね、散歩しましょう」と声がした。'.repeat(8);
        const m = computeStyleMetrics(prose);
        expect(m.dialogueRatio).toBeGreaterThanOrEqual(0.35);
        expect(m.labels.dialogue).toBe('会話多め');
    });

    it('長い文が続く本文は「流れるような長文」と判定する', () => {
        const longSentence =
            '夕暮れの光が窓辺に差し込み、埃の粒子がゆっくりと舞い上がる様子を眺めながら、遠い日の記憶と過ぎ去った季節の匂いが胸の奥で静かに混ざり合っていくのを感じていた。';
        const prose = longSentence.repeat(6);
        const m = computeStyleMetrics(prose);
        expect(m.avgSentenceLength).toBeGreaterThanOrEqual(60);
        expect(m.labels.rhythm).toBe('流れるような長文');
    });

    it('文長のばらつきが大きい本文は「長短混合」と判定する', () => {
        const short = '雨が降る。';
        const long =
            '窓の外では絶え間なく雨粒が落ち続け、街路樹の葉を打つ音だけがこの部屋の沈黙をかろうじて埋めていた。';
        const prose = (short + long).repeat(5);
        const m = computeStyleMetrics(prose);
        expect(m.labels.rhythm).toBe('長短混合');
    });

    it('判定材料が不足する本文はラベルを空にする', () => {
        const m = computeStyleMetrics('こんにちは。');
        expect(m.labels.perspective).toBe('');
        expect(m.labels.formality).toBe('');
        expect(m.labels.rhythm).toBe('');
    });

    it('空文字でも例外を投げず、ゼロ値を返す', () => {
        const m = computeStyleMetrics('');
        expect(m.totalChars).toBe(0);
        expect(m.dialogueRatio).toBe(0);
        expect(m.avgSentenceLength).toBe(0);
        expect(m.labels.dialogue).toBe('');
    });
});

describe('formatStyleMetrics', () => {
    it('計測値と機械判定ラベルを人間可読のサマリーに整形する', () => {
        const prose = '私は森をゆっくり歩きました。'.repeat(10);
        const summary = formatStyleMetrics(computeStyleMetrics(prose));
        expect(summary).toContain('会話比率');
        expect(summary).toContain('平均文長');
        expect(summary).toContain('一人称（私/僕/俺）');
    });
});
