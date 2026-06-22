import { describe, it, expect } from 'vitest';
import { analyzeWritingStyle, sampleExcerpts, extractStyleSample } from '../../services/import/classifyStyle';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

/**
 * 文体フェーズ（Phase B: AI分類）のオーケストレーションを、
 * 実APIを使わず注入したフェイク AIRunner で検証する。
 * - 正常なJSON応答の採用と styleNote の上限切り詰め
 * - 選択肢外の値のフォールバック（客観軸→機械計測、主観軸→空）
 * - 省略表記（「一人称」）の正規化
 * - AI失敗時の計測のみへの格下げ / 中断（AbortError）の再送出
 * - 短い本文ではAIを呼ばない
 */

const settings: AISettings = {
    provider: 'local',
    model: 'test-model',
    temperature: 0.5,
    maxTokens: 1000,
    localContextLength: 1000,
};

// 一人称・敬体・短文・会話なし（500字以上）→ 計測ラベルが確実に立つ本文
const firstPersonProse = '私は森をゆっくり歩きました。'.repeat(40);

function makeRunner(response: string | (() => string)) {
    let callCount = 0;
    const prompts: string[] = [];
    const run: AIRunner = async (prompt) => {
        callCount++;
        prompts.push(prompt);
        return typeof response === 'function' ? response() : response;
    };
    return { run, prompts, get callCount() { return callCount; } };
}

describe('analyzeWritingStyle', () => {
    it('選択肢に一致するAI応答を全軸採用する', async () => {
        const { run } = makeRunner(JSON.stringify({
            style: 'ライトノベル風',
            perspective: '三人称（彼/彼女）',
            formality: '口語的',
            rhythm: 'テンポよく',
            metaphor: '控えめ',
            dialogue: '会話多め',
            emotion: '行動で示す',
            tone: '明るい',
            styleNote: '軽快な口語文体。',
        }));
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        expect(result.writingStyle).toEqual({
            style: 'ライトノベル風',
            perspective: '三人称（彼/彼女）',
            formality: '口語的',
            rhythm: 'テンポよく',
            metaphor: '控えめ',
            dialogue: '会話多め',
            emotion: '行動で示す',
            tone: '明るい',
        });
        expect(result.styleNote).toBe('軽快な口語文体。');
    });

    it('選択肢外の値は客観軸を機械計測へ、主観軸を空へフォールバックする', async () => {
        const { run } = makeRunner(JSON.stringify({
            style: 'サイバーパンク風',
            perspective: '二人称',
            formality: '普通',
            rhythm: '変則',
            metaphor: '大量',
            dialogue: '会話だけ',
            emotion: '激しい',
            tone: '超暗い',
            styleNote: 'メモ',
        }));
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        // 客観軸: 機械計測（一人称・敬体・短文・会話なし）の値が入る
        expect(result.writingStyle.perspective).toBe('一人称（私/僕/俺）');
        expect(result.writingStyle.formality).toBe('柔らかめ');
        expect(result.writingStyle.rhythm).toBe('短文中心');
        expect(result.writingStyle.dialogue).toBe('描写重視');
        // 主観軸: 空（無理に埋めない）
        expect(result.writingStyle.style).toBe('');
        expect(result.writingStyle.metaphor).toBe('');
        expect(result.writingStyle.emotion).toBe('');
        expect(result.writingStyle.tone).toBe('');
    });

    it('省略表記（「一人称」）を正規の選択肢に寄せる', async () => {
        const { run } = makeRunner(JSON.stringify({ perspective: '一人称' }));
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        expect(result.writingStyle.perspective).toBe('一人称（私/僕/俺）');
    });

    it('JSONとして解釈できない応答は計測のみの結果に格下げする', async () => {
        const { run } = makeRunner('分類できませんでした。');
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        expect(result.writingStyle.perspective).toBe('一人称（私/僕/俺）');
        expect(result.writingStyle.style).toBe('');
        expect(result.styleNote).toBe('');
    });

    it('AI呼び出しの失敗（API障害）では例外を投げず計測のみで返す', async () => {
        const { run } = makeRunner(() => { throw new Error('network error'); });
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        expect(result.writingStyle.perspective).toBe('一人称（私/僕/俺）');
        expect(result.writingStyle.dialogue).toBe('描写重視');
    });

    it('中断（AbortError）はパイプラインを止めるため再送出する', async () => {
        const { run } = makeRunner(() => { throw new DOMException('Aborted', 'AbortError'); });
        await expect(analyzeWritingStyle(firstPersonProse, { settings, run }))
            .rejects.toMatchObject({ name: 'AbortError' });
    });

    it('短い本文（500字未満）ではAIを呼ばず計測のみで返す', async () => {
        const runner = makeRunner('{}');
        const result = await analyzeWritingStyle('「俺は行く」と彼は言った。', { settings, run: runner.run });
        expect(runner.callCount).toBe(0);
        expect(result.styleNote).toBe('');
    });

    it('styleNote は上限200文字に切り詰める', async () => {
        const { run } = makeRunner(JSON.stringify({ styleNote: 'あ'.repeat(300) }));
        const result = await analyzeWritingStyle(firstPersonProse, { settings, run });
        expect(result.styleNote.length).toBe(200);
    });

    it('プロンプトに抜粋と機械計測サマリーが含まれる', async () => {
        const runner = makeRunner('{}');
        await analyzeWritingStyle(firstPersonProse, { settings, run: runner.run });
        expect(runner.prompts[0]).toContain('【抜粋1】');
        expect(runner.prompts[0]).toContain('機械計測の結果');
        expect(runner.prompts[0]).toContain('選択肢');
    });
});

describe('extractStyleSample', () => {
    it('短い本文は全文をそのまま返す', () => {
        expect(extractStyleSample('短い本文。', 800)).toBe('短い本文。');
    });

    it('空文字は空のまま返す', () => {
        expect(extractStyleSample('', 800)).toBe('');
    });

    it('長い本文は中間部から逐語抜粋し、上限以内に収める', () => {
        const sentence = '彼は窓の外の雨をじっと眺めていた。';
        const prose = sentence.repeat(200); // 3400字
        const sample = extractStyleSample(prose, 800);
        expect(sample.length).toBeGreaterThan(0);
        expect(sample.length).toBeLessThanOrEqual(800);
        // 逐語性: 原文の連続部分文字列である
        expect(prose.includes(sample)).toBe(true);
    });

    it('末尾は文の途中で切れない（文末記号で終わる）', () => {
        const sentence = '彼は窓の外の雨をじっと眺めていた。';
        const prose = sentence.repeat(200);
        const sample = extractStyleSample(prose, 800);
        expect(/[。！？」]$/.test(sample)).toBe(true);
    });
});

describe('sampleExcerpts', () => {
    it('短い本文は全文を1抜粋として返す', () => {
        const excerpts = sampleExcerpts('短い本文。', 1000);
        expect(excerpts).toEqual(['短い本文。']);
    });

    it('長い本文は冒頭・中間・終盤の3抜粋を返す', () => {
        const prose = 'あ'.repeat(2000) + '\n' + 'い'.repeat(2000) + '\n' + 'う'.repeat(2000);
        const excerpts = sampleExcerpts(prose, 1000);
        expect(excerpts).toHaveLength(3);
        expect(excerpts[0].startsWith('あ')).toBe(true);
        expect(excerpts[2].endsWith('う')).toBe(true);
        for (const e of excerpts) {
            expect(e.length).toBeLessThanOrEqual(1000);
        }
    });
});
