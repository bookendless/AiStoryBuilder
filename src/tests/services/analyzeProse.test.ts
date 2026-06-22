import { describe, it, expect } from 'vitest';
import { analyzeProse } from '../../services/import/analyzeProse';
import { AIRunner } from '../../types/sequel';
import { AISettings } from '../../types/ai';

/**
 * analyzeProse のオーケストレーション（map→reduce→抽出 ＋ キャラ名寄せ）を、
 * 実APIを使わず注入したフェイク AIRunner で検証する。
 * - 原文の逐語保存（C7）の不変条件を固定
 * - 複数チャンクを跨いだキャラの収集と重複排除（NARRATOR は1人に統合）
 * - 既知の登場人物リストが2チャンク目以降のプロンプトに注入される
 * - 各フェーズの呼び出し回数（要約map / 概要抽出 / キャラmap / 仕上げ統合）
 * - 仕上げ統合が失敗しても未統合のまま解析が完了する
 */

// ローカル設定で予算を小さくし、複数チャンクを強制する
const settings: AISettings = {
    provider: 'local',
    model: 'test-model',
    temperature: 0.5,
    maxTokens: 1000,
    localContextLength: 1000,
};

function makeFakeRunner(opts: { failConsolidate?: boolean } = {}) {
    const calls = { summary: 0, aggregate: 0, overview: 0, character: 0, consolidate: 0, style: 0 };
    const characterPrompts: string[] = [];

    const run: AIRunner = async (prompt) => {
        if (prompt.includes('登場する人物を')) {
            calls.character++;
            characterPrompts.push(prompt);
            // 既知人物リストにも名前が含まれるため、判定は本文ブロックに限定する
            const body = prompt.split('【抽出方針】')[0];
            const chars: Array<Record<string, string>> = [{ name: 'NARRATOR', role: '語り手' }];
            if (body.includes('ALICEは森を歩いた')) chars.push({ name: 'ALICE', role: '主人公', personality: '好奇心旺盛' });
            if (body.includes('BOBが現れた')) chars.push({ name: 'BOB', role: '相棒' });
            return JSON.stringify({ characters: chars });
        }
        if (prompt.includes('同一人物を指している項目')) {
            calls.consolidate++;
            if (opts.failConsolidate) throw new Error('consolidate failed');
            return JSON.stringify({ groups: [] });
        }
        if (prompt.includes('構造化情報を抽出')) {
            calls.overview++;
            return JSON.stringify({
                title: 'テスト作品',
                mainGenre: 'ファンタジー',
                subGenre: '',
                targetReader: '全年齢',
                synopsis: 'あらすじ本文',
                plot: { theme: '友情', setting: '森', hook: '冒頭の謎', protagonistGoal: '帰還', mainObstacle: '森の主' },
            });
        }
        if (prompt.includes('文体の特徴を分析')) {
            calls.style++;
            return JSON.stringify({
                style: '現代小説風',
                perspective: '三人称（彼/彼女）',
                formality: '硬め',
                rhythm: '長短混合',
                metaphor: '控えめ',
                dialogue: '描写重視',
                emotion: '行動で示す',
                tone: '謎めいた',
                styleNote: '簡潔で写実的な三人称の語り。',
            });
        }
        if (prompt.includes('統合')) {
            calls.aggregate++;
            return '全体要約テキスト';
        }
        calls.summary++;
        return '部分要約テキスト';
    };

    return { run, calls, characterPrompts };
}

describe('analyzeProse', () => {
    // ALICE/NARRATOR を含む前半 と BOB/NARRATOR を含む後半。予算800で複数チャンクに割れる。
    const prose =
        'ALICEは森を歩いた。語り手NARRATORが状況を説明する。' + 'あ'.repeat(700) +
        '\n\n' +
        'BOBが現れた。語り手NARRATORが物語を続ける。' + 'い'.repeat(700);

    it('原文を逐語保存する（行末正規化とtrimのみ）', async () => {
        const { run } = makeFakeRunner();
        const input = `  ${prose}\r\n`;
        const result = await analyzeProse(input, { settings, run });
        expect(result.originalProse).toBe(prose);
    });

    it('CRのみ（lone \\r）改行はLFに正規化され originalProse に \\r が残らない', async () => {
        const { run } = makeFakeRunner();
        const input = prose.replace(/\n/g, '\r');
        const result = await analyzeProse(input, { settings, run });
        expect(result.originalProse).not.toContain('\r');
        expect(result.originalProse).toBe(prose);
    });

    it('複数チャンクを跨いでキャラを収集し、同名(NARRATOR)は1人に統合する', async () => {
        const { run } = makeFakeRunner();
        const result = await analyzeProse(prose, { settings, run });
        const names = result.characters.map(c => c.name).sort();
        expect(names).toEqual(['ALICE', 'BOB', 'NARRATOR']);
    });

    it('概要フィールドをJSONから抽出する', async () => {
        const { run } = makeFakeRunner();
        const result = await analyzeProse(prose, { settings, run });
        expect(result.overview.title).toBe('テスト作品');
        expect(result.overview.mainGenre).toBe('ファンタジー');
        expect(result.overview.synopsis).toBe('あらすじ本文');
        expect(result.overview.plot.theme).toBe('友情');
        expect(result.overview.plot.mainObstacle).toBe('森の主');
    });

    it('要約map・概要抽出・キャラmap・仕上げ統合 が期待回数だけ呼ばれる', async () => {
        const { run, calls } = makeFakeRunner();
        await analyzeProse(prose, { settings, run });
        // 複数チャンクに割れている
        expect(calls.summary).toBeGreaterThanOrEqual(2);
        // キャラmap は既知人物リスト分の予算先取りで要約map以上のチャンク数になりうる
        expect(calls.character).toBeGreaterThanOrEqual(calls.summary);
        // 概要抽出は1回
        expect(calls.overview).toBe(1);
        // 複数チャンクなので集約も発生
        expect(calls.aggregate).toBeGreaterThanOrEqual(1);
        // 仕上げの同一人物判定は1回だけ
        expect(calls.consolidate).toBe(1);
        // 文体分類は1回だけ
        expect(calls.style).toBe(1);
    });

    it('文体設定と文体メモを推測して結果に含める', async () => {
        const { run } = makeFakeRunner();
        const result = await analyzeProse(prose, { settings, run });
        expect(result.writingStyle?.style).toBe('現代小説風');
        expect(result.writingStyle?.perspective).toBe('三人称（彼/彼女）');
        expect(result.writingStyle?.dialogue).toBe('描写重視');
        expect(result.styleNote).toBe('簡潔で写実的な三人称の語り。');
    });

    it('文体見本を原文からの逐語抜粋として結果に含める', async () => {
        const { run } = makeFakeRunner();
        const result = await analyzeProse(prose, { settings, run });
        expect(result.styleSample).toBeTruthy();
        // 逐語性: 原文（正規化済み）の連続部分文字列である
        expect(result.originalProse.includes(result.styleSample!)).toBe(true);
    });

    it('2チャンク目以降のキャラ抽出プロンプトに既知の登場人物リストを注入する', async () => {
        const { run, characterPrompts } = makeFakeRunner();
        await analyzeProse(prose, { settings, run });
        expect(characterPrompts.length).toBeGreaterThanOrEqual(2);
        // 1チャンク目は既知人物なし
        expect(characterPrompts[0]).not.toContain('既知の登場人物');
        // 2チャンク目には1チャンク目で判明した人物が載る
        expect(characterPrompts[1]).toContain('既知の登場人物');
        expect(characterPrompts[1]).toContain('NARRATOR');
    });

    it('仕上げ統合が失敗しても、名寄せ済みのキャラで解析が完了する', async () => {
        const { run, calls } = makeFakeRunner({ failConsolidate: true });
        const result = await analyzeProse(prose, { settings, run });
        expect(calls.consolidate).toBe(1);
        const names = result.characters.map(c => c.name).sort();
        expect(names).toEqual(['ALICE', 'BOB', 'NARRATOR']);
    });
});
