import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeInputForPrompt, DEFAULT_PROMPT_MAX_LENGTH } from '../../utils/securityUtils';
import { buildRecapPrompt, RECAP_PROMPT_CAP } from '../../services/prompts/recap';
import { buildConsistencyPrompt, CONSISTENCY_PROMPT_CAP } from '../../services/prompts/consistency';
import { PROOFREAD_PROMPTS, PROOFREAD_PROMPT_CAP } from '../../services/prompts/proofread';
import { DRAFT_PROMPTS } from '../../services/prompts/draft';
import { EVALUATION_PROMPTS, EVALUATION_PROMPT_CAP } from '../../services/prompts/evaluation';
import { buildWhatIfPrompt, WHATIF_PROMPT_CAP } from '../../services/prompts/whatIf';

/**
 * CAP（maxPromptLength）を渡す各プロンプトについて、実CAPで巨大入力を通しても
 * 末尾のJSON出力形式指示が中抜きで生き残ることを検証する。
 * sanitizeInputForPrompt.test.ts の「実テンプレートでの末尾JSON指示の保持」と同じ観点を
 * recap / consistency / proofread に展開したもの。
 */
describe('CAP適用プロンプトの末尾JSON指示の保持', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('recap: RECAP_PROMPT_CAP で通すと末尾のJSON出力形式が残る', () => {
        const prompt = buildRecapPrompt({
            title: 'テスト作品',
            genre: 'ファンタジー',
            digest: '第1章の出来事。'.repeat(4000), // 約32000文字
            resumeInfo: '最後に本文を書いた章: 第10章',
            openForeshadowings: '- 謎の手紙: 差出人が不明のまま',
        });
        expect(prompt.length).toBeGreaterThan(RECAP_PROMPT_CAP);

        const result = sanitizeInputForPrompt(prompt, RECAP_PROMPT_CAP);
        expect(result).toContain('【出力形式】');
        expect(result).toContain('narrative');
        expect(result).toContain('suggestions');
    });

    it('consistency: CONSISTENCY_PROMPT_CAP で通すと末尾のJSONスキーマが残る', () => {
        const prompt = buildConsistencyPrompt({
            chapterTitle: '第1章',
            chapterText: '彼は静かに扉を開けた。'.repeat(2000), // 約22000文字
            factSheet: '主人公: 蒼真\n瞳の色: 黒\n一人称: 僕\n'.repeat(50),
            categories: ['appearance', 'narration'],
        });
        expect(prompt.length).toBeGreaterThan(CONSISTENCY_PROMPT_CAP);

        const result = sanitizeInputForPrompt(prompt, CONSISTENCY_PROMPT_CAP);
        expect(result).toContain('【出力形式】');
        expect(result).toContain('issues');
        expect(result).toContain('severity');
    });

    it('proofread: PROOFREAD_PROMPT_CAP で通すと末尾のJSONスキーマが残る', () => {
        const prompt = PROOFREAD_PROMPTS.proofread
            .split('{text}')
            .join('校正対象の本文。'.repeat(5000)); // 約40000文字
        expect(prompt.length).toBeGreaterThan(PROOFREAD_PROMPT_CAP);

        const result = sanitizeInputForPrompt(prompt, PROOFREAD_PROMPT_CAP);
        expect(result).toContain('【出力形式】');
        expect(result).toContain('corrections');
    });

    it('proofread: 本文の境界マーカーが dataBlock 形式である', () => {
        expect(PROOFREAD_PROMPTS.proofread).toContain('【本文（ここから）】');
        expect(PROOFREAD_PROMPTS.proofread).toContain('【本文（ここまで）】');
    });

    it('evaluation: EVALUATION_PROMPT_CAP で通すと末尾のJSON出力形式が残る', () => {
        const prompt = EVALUATION_PROMPTS.structure
            .split('{content}')
            .join('評価対象の本文。'.repeat(5000)); // 約40000文字
        expect(prompt.length).toBeGreaterThan(EVALUATION_PROMPT_CAP);

        const result = sanitizeInputForPrompt(prompt, EVALUATION_PROMPT_CAP);
        expect(result).toContain('【出力形式】');
        expect(result).toContain('weaknessDetails');
        expect(result).toContain('detailedAnalysis');
    });

    it('whatIf: WHATIF_PROMPT_CAP で通すと末尾のJSON出力形式が残る', () => {
        const prompt = buildWhatIfPrompt({
            title: 'テスト作品',
            genre: 'ファンタジー',
            factSheet: '主人公: 蒼真\n瞳の色: 黒\n'.repeat(500),
            digestBefore: '第1章の出来事。'.repeat(1500),
            digestAfter: '第9章の出来事。'.repeat(1500),
            branchDescription: '第5章「決別」',
            premise: 'もし主人公が仲間を裏切らなかったら',
            openForeshadowings: '- 謎の手紙: 差出人が不明のまま',
            relationships: '- 蒼真 と 灯: 友人',
        });
        expect(prompt.length).toBeGreaterThan(WHATIF_PROMPT_CAP);

        const result = sanitizeInputForPrompt(prompt, WHATIF_PROMPT_CAP);
        expect(result).toContain('【出力形式】');
        expect(result).toContain('chapterImpacts');
        expect(result).toContain('newPossibilities');
        expect(result).toContain('verdict');
    });

    /**
     * 実運用の上限（設定台帳2000＋ダイジェスト5000）を積んだプロンプトが、
     * 中抜きされずに丸ごと通ること。中抜きが起きると削られるのは中間、すなわち
     * 【分岐点より後の章（波及の対象）】＝この機能の分析対象そのもので、
     * しかも末尾のJSON形式は残るためエラーにならず気付けない。
     */
    it('whatIf: 実運用の最大入力なら中抜きが起きない', () => {
        const prompt = buildWhatIfPrompt({
            title: 'テスト作品',
            genre: 'ファンタジー',
            factSheet: 'あ'.repeat(2000), // FACT_SHEET_BUDGET
            digestBefore: 'い'.repeat(2000), // DIGEST_MAX_CHARS の内訳（前40%）
            digestAfter: 'う'.repeat(3000), // 同（後60%）
            branchDescription: '第5章「決別」',
            premise: 'え'.repeat(500),
            openForeshadowings: '- 伏線: 説明文'.repeat(60), // 8件相当の上限
            relationships: '- A と B: 友人（説明）'.repeat(60), // 12件相当の上限
        });

        // CAPを渡さない（＝修正前の）経路では中抜きが起きていたことを固定する。
        // これが落ちるようになったら、この CAP はもう不要になっている
        const withoutCap = sanitizeInputForPrompt(prompt, DEFAULT_PROMPT_MAX_LENGTH);
        expect(withoutCap).toContain('【中略：プロンプトが長すぎるため中間部分を省略しました】');
        expect(withoutCap).toContain('【出力形式】'); // 末尾は生き残るのでエラーにはならない＝気付けない

        const result = sanitizeInputForPrompt(prompt, WHATIF_PROMPT_CAP);
        expect(result).not.toContain('【中略：プロンプトが長すぎるため中間部分を省略しました】');
        expect(result).toContain('分岐点より後の章（波及の対象）（ここまで）');
    });
});

/**
 * 講評プロンプトの引用義務とリワードハッキング対策。
 * 4観点すべてに同じ規律が入っていること（1つだけ抜けると観点によって精度が変わる）。
 */
describe('講評プロンプトの引用義務', () => {
    const modes = ['structure', 'character', 'style', 'persona'] as const;

    it.each(modes)('%s: 引用つき改善点と実在性の指示が含まれる', (mode) => {
        const prompt = EVALUATION_PROMPTS[mode];
        expect(prompt).toContain('"weaknessDetails"');
        expect(prompt).toContain('存在しない引用を作らない');
    });

    it.each(modes)('%s: 修辞過多への加点を禁じる指示が含まれる', (mode) => {
        expect(EVALUATION_PROMPTS[mode]).toContain('修辞・美文の多さを加点しない');
    });

    it.each(modes)('%s: 旧キー weaknesses も残している（保存済み講評との互換）', (mode) => {
        expect(EVALUATION_PROMPTS[mode]).toContain('"weaknesses"');
    });
});

/**
 * critique プロンプトの引用義務（quote キー）の存在検証。
 * 引用に基づかない指摘（幻覚指摘）を抑制するための指示がテンプレートに含まれること。
 */
describe('critique プロンプトの引用義務', () => {
    it('weaknesses スキーマに quote キーと引用指示が含まれる', () => {
        expect(DRAFT_PROMPTS.critique).toContain('"quote"');
        expect(DRAFT_PROMPTS.critique).toContain('本文から引用できない指摘は書かない');
        expect(DRAFT_PROMPTS.critique).toContain('存在しない引用を作らない');
    });

    it('修辞過多への加点を禁じる指示が含まれる（リワードハッキング対策）', () => {
        expect(DRAFT_PROMPTS.critique).toContain('修辞・美文の多さを加点しない');
    });
});
