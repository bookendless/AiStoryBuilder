/**
 * Verbalized Sampling（確率つき複数案）の正規化・バッジ規則・プロンプト規律
 *
 * 確率はモデルが文字列で返すことも多く、そこで落とすとバッジが一切出ず
 * 「実装したのに何も起きない」状態になるため、入力の揺れを重点的に固定する。
 */

import { describe, it, expect } from 'vitest';
import { normalizeCreativePointsList } from '../../services/creativePoints/parseCreativePoints';
import { assignProbabilityBadges, toProbability } from '../../utils/probabilityBadge';
import { parseWhatIfReport } from '../../services/whatIf/parseWhatIfReport';
import { parseAISuggestions } from '../../components/steps/draft/utils';
import { DRAFT_PROMPTS, buildQuickRewritePrompt, buildQuickTonePrompt, buildQuickSummaryPrompt } from '../../services/prompts/draft';
import { buildCreativePointsInstruction, buildCreativePointsJsonKeyInstruction } from '../../services/prompts/creativePoints';

describe('toProbability', () => {
    it('数値はそのまま受け取る', () => {
        expect(toProbability(0.4)).toBe(0.4);
        expect(toProbability(0)).toBe(0);
        expect(toProbability(1)).toBe(1);
    });

    it('文字列の確率も受け取る（モデルは "0.3" のように返すことがある）', () => {
        expect(toProbability('0.3')).toBe(0.3);
        expect(toProbability(' 0.75 ')).toBe(0.75);
    });

    it('範囲外は 0〜1 に丸める', () => {
        expect(toProbability(1.5)).toBe(1);
        expect(toProbability(-0.2)).toBe(0);
        expect(toProbability('120')).toBe(1);
    });

    it('数値として解釈できないものは undefined', () => {
        expect(toProbability('高い')).toBeUndefined();
        expect(toProbability('')).toBeUndefined();
        expect(toProbability('   ')).toBeUndefined();
        expect(toProbability(undefined)).toBeUndefined();
        expect(toProbability(null)).toBeUndefined();
        expect(toProbability(true)).toBeUndefined();
        expect(toProbability(NaN)).toBeUndefined();
        expect(toProbability(Infinity)).toBeUndefined();
    });
});

describe('assignProbabilityBadges', () => {
    it('最も高い案に本命、最も低い案に意外を付ける', () => {
        const badges = assignProbabilityBadges([
            { id: 'a', probability: 0.5 },
            { id: 'b', probability: 0.35 },
            { id: 'c', probability: 0.1 },
        ]);
        expect(badges).toEqual({ a: '本命', c: '意外' });
    });

    it('確率つきが1件以下ならバッジを付けない', () => {
        expect(assignProbabilityBadges([{ id: 'a', probability: 0.5 }])).toEqual({});
        expect(assignProbabilityBadges([{ id: 'a' }, { id: 'b' }])).toEqual({});
    });

    it('全部同じ確率なら比較に意味がないのでバッジを付けない', () => {
        const badges = assignProbabilityBadges([
            { id: 'a', probability: 0.33 },
            { id: 'b', probability: 0.33 },
        ]);
        expect(badges).toEqual({});
    });

    it('確率のない案が混ざっていても、ある案同士で比較する', () => {
        const badges = assignProbabilityBadges([
            { id: 'a', probability: 0.6 },
            { id: 'b' },
            { id: 'c', probability: 0.2 },
        ]);
        expect(badges).toEqual({ a: '本命', c: '意外' });
    });
});

describe('normalizeCreativePointsList の probability', () => {
    const build = (probability: unknown) => [
        {
            label: '主人公の動機',
            current: '復讐',
            alternatives: [{ summary: '和解', consequence: '対立が薄まる', probability }],
        },
    ];

    it('確率を保持する（文字列でも数値化する）', () => {
        expect(normalizeCreativePointsList(build(0.2))[0].alternatives[0].probability).toBe(0.2);
        expect(normalizeCreativePointsList(build('0.2'))[0].alternatives[0].probability).toBe(0.2);
    });

    it('確率が無くても別案は有効なまま（旧出力との互換）', () => {
        const points = normalizeCreativePointsList(build(undefined));
        expect(points).toHaveLength(1);
        expect(points[0].alternatives[0].probability).toBeUndefined();
        expect(points[0].alternatives[0].summary).toBe('和解');
    });
});

describe('parseAISuggestions（parseJsonLoose への移行）', () => {
    const body = {
        suggestions: [
            { title: '案1', body: '本文1', probability: 0.5 },
            { title: '案2', body: '本文2', probability: '0.1' },
        ],
    };

    it('コードフェンス付きJSONを解析できる（以前は段落分割に落ちていた）', () => {
        const result = parseAISuggestions('```json\n' + JSON.stringify(body) + '\n```');
        expect(result).toHaveLength(2);
        expect(result[0].body).toBe('本文1');
        expect(result[0].probability).toBe(0.5);
        expect(result[1].probability).toBe(0.1);
    });

    it('素のJSONは従来どおり解析できる', () => {
        const result = parseAISuggestions(JSON.stringify(body));
        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('案1');
    });

    it('JSONでない散文は段落ごとの提案に分割する（フォールバック維持）', () => {
        const result = parseAISuggestions('最初の案です。\n\n次の案です。');
        expect(result).toHaveLength(2);
        expect(result[0].body).toBe('最初の案です。');
        expect(result[1].body).toBe('次の案です。');
        expect(result[0].probability).toBeUndefined();
    });

    it('JSONの形が合っていれば中身が空でも空配列を返す（生JSONを提案にしない）', () => {
        // 段落分割にフォールバックすると、JSON文字列そのものが提案本文になり
        // 適用ボタンで原稿に書き込まれてしまう。0件は呼び出し側がエラーとして扱う
        expect(parseAISuggestions('{"suggestions": []}')).toEqual([]);
        expect(parseAISuggestions('{"suggestions": [{"title": "案", "body": ""}]}')).toEqual([]);
    });

    it('提案IDの形式を変えない（適用処理と履歴がIDに依存するため）', () => {
        const parsed = parseAISuggestions(JSON.stringify(body));
        expect(parsed[0].id).toMatch(/^parsed-\d+-0$/);
        const fallback = parseAISuggestions('ひとつの案');
        expect(fallback[0].id).toMatch(/^fallback-\d+-0$/);
    });
});

describe('parseWhatIfReport の newPossibilities', () => {
    const baseReport = (newPossibilities: unknown) => ({
        immediate: '直後の展開',
        verdict: '総評',
        newPossibilities,
    });

    it('確率つきオブジェクト配列から文字列一覧と詳細の両方を作る', () => {
        const report = parseWhatIfReport(
            baseReport([
                { text: '可能性A', probability: 0.6 },
                { text: '可能性B', probability: '0.1' },
            ]),
            []
        );
        expect(report?.newPossibilities).toEqual(['可能性A', '可能性B']);
        expect(report?.newPossibilityDetails).toEqual([
            { text: '可能性A', probability: 0.6 },
            { text: '可能性B', probability: 0.1 },
        ]);
    });

    it('従来の文字列配列も受け取れる（保存済みシナリオとの互換）', () => {
        const report = parseWhatIfReport(baseReport(['可能性A', '可能性B']), []);
        expect(report?.newPossibilities).toEqual(['可能性A', '可能性B']);
        expect(report?.newPossibilityDetails).toBeUndefined();
    });

    it('文字列とオブジェクトが混在しても取りこぼさない', () => {
        const report = parseWhatIfReport(
            baseReport(['可能性A', { text: '可能性B', probability: 0.2 }]),
            []
        );
        expect(report?.newPossibilities).toEqual(['可能性A', '可能性B']);
        expect(report?.newPossibilityDetails).toHaveLength(2);
    });

    it('上限5件は維持する', () => {
        const report = parseWhatIfReport(
            baseReport(Array.from({ length: 8 }, (_, i) => `可能性${i}`)),
            []
        );
        expect(report?.newPossibilities).toHaveLength(5);
    });
});

describe('プロンプトへの Verbalized Sampling の適用', () => {
    const payload = { selectedText: '対象テキスト' };

    it('リライト案とトーン案には確率を求める', () => {
        expect(buildQuickRewritePrompt(payload)).toContain('probability');
        expect(buildQuickTonePrompt(payload)).toContain('probability');
    });

    it('要約プロンプトには適用しない（3枠が固定の役割で競合する案ではないため）', () => {
        expect(buildQuickSummaryPrompt(payload)).not.toContain('probability');
    });

    it('創造ポイントは散文版・JSONキー版の両方に確率を求める', () => {
        expect(buildCreativePointsInstruction('あらすじ')).toContain('probability');
        expect(buildCreativePointsJsonKeyInstruction()).toContain('probability');
    });

    it('創造ポイントは確率を別案に付けさせる（ポイント側に付くと受信側が読み落とす）', () => {
        expect(buildCreativePointsInstruction('あらすじ')).toContain('各別案には probability');
        expect(buildCreativePointsJsonKeyInstruction()).toContain('各別案には probability');
    });

    it('草案生成そのものには確率を持ち込まない（単一の本文を書かせる生成のため）', () => {
        expect(DRAFT_PROMPTS.generateSingle).not.toContain('probability');
    });
});
