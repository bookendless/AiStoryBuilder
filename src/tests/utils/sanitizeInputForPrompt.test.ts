import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeInputForPrompt, sanitizeInputForPromptWithMeta, DEFAULT_PROMPT_MAX_LENGTH } from '../../utils/securityUtils';
import { DRAFT_PROMPTS, DRAFT_PROMPT_CAP } from '../../services/prompts/draft';

/**
 * sanitizeInputForPrompt の切り詰めは「末尾切り」ではなく「中抜き」であることを検証する。
 * プロンプトは末尾に【出力形式】等の指示ブロックを置く構造のため、上限超過時でも
 * 末尾の指示が失われないことが最重要要件。
 */
describe('sanitizeInputForPrompt の中抜き切り詰め', () => {
    const TAIL_MARKER = '末尾の出力形式指示ブロック';
    const HEAD_MARKER = '冒頭の役割説明';

    beforeEach(() => {
        // 切り詰め時の console.warn を抑制（テスト出力を汚さない）
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('上限以下の入力はそのまま返す（トリム済み）', () => {
        const input = `${HEAD_MARKER}\n本文\n${TAIL_MARKER}`;
        expect(sanitizeInputForPrompt(input, 10000)).toContain(TAIL_MARKER);
        expect(sanitizeInputForPrompt(input, 10000)).toContain(HEAD_MARKER);
    });

    it('上限超過時でも末尾の指示ブロックを保持する（中抜き）', () => {
        const filler = 'あ'.repeat(20000);
        const input = `${HEAD_MARKER}\n${filler}\n${TAIL_MARKER}`;
        const result = sanitizeInputForPrompt(input, 5000);

        // 末尾の指示が死守される（従来の末尾切りでは消えていた）
        expect(result).toContain(TAIL_MARKER);
        // 冒頭も残る
        expect(result).toContain(HEAD_MARKER);
        // 中抜きマーカーが挿入される
        expect(result).toContain('【中略');
        // 上限内に収まる
        expect(result.length).toBeLessThanOrEqual(5000);
    });

    it('マーカーには <> を使わない（sanitize が <> を除去するため）', () => {
        const filler = 'い'.repeat(20000);
        const result = sanitizeInputForPrompt(`頭\n${filler}\n尾`, 3000);
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).toContain('【中略');
    });

    it('maxLength 未指定時は既定値が適用される', () => {
        const filler = 'う'.repeat(DEFAULT_PROMPT_MAX_LENGTH + 5000);
        const result = sanitizeInputForPrompt(`頭\n${filler}\n${TAIL_MARKER}`);
        expect(result.length).toBeLessThanOrEqual(DEFAULT_PROMPT_MAX_LENGTH);
        expect(result).toContain(TAIL_MARKER);
    });

    it('切り詰め発生時に console.warn を出す', () => {
        const warnSpy = vi.spyOn(console, 'warn');
        const filler = 'え'.repeat(20000);
        sanitizeInputForPrompt(`頭\n${filler}\n尾`, 4000);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('非文字列入力は空文字を返す', () => {
        // @ts-expect-error 意図的に不正な型を渡す
        expect(sanitizeInputForPrompt(null)).toBe('');
    });
});

/**
 * truncated メタ情報の正確性（トースト誤検知の防止）。
 * サニタイズで文字が縮んでも、上限を超えていなければ truncated=false であること。
 */
describe('sanitizeInputForPromptWithMeta の truncated 判定', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('上限内なら truncated=false（サニタイズで縮んでも誤検知しない）', () => {
        // <> を多数含み、サニタイズで縮むが上限は超えない入力
        const input = '<'.repeat(500) + 'あ'.repeat(500) + '>'.repeat(500);
        const meta = sanitizeInputForPromptWithMeta(input, 10000);
        expect(meta.truncated).toBe(false);
        expect(meta.contentLength).toBeLessThanOrEqual(10000);
    });

    it('上限超過なら truncated=true かつ contentLength は生の入力長ではなくサニタイズ後の長さ', () => {
        const input = 'あ'.repeat(20000);
        const meta = sanitizeInputForPromptWithMeta(input, 5000);
        expect(meta.truncated).toBe(true);
        expect(meta.contentLength).toBe(20000); // このケースはサニタイズで縮まない
        expect(meta.text.length).toBeLessThanOrEqual(5000);
    });

    it('非文字列は truncated=false / contentLength=0', () => {
        // @ts-expect-error 意図的に不正な型を渡す
        expect(sanitizeInputForPromptWithMeta(undefined)).toEqual({ text: '', truncated: false, contentLength: 0 });
    });
});

/**
 * 実テンプレート（critique）での回帰検証。
 * 巨大な草案本文を埋め込んだ実プロンプトを実際のcap（DRAFT_PROMPT_CAP）で通し、
 * 末尾のJSON出力形式ブロック（【出力形式】/【出力ルール（厳守）】/最終行）が生き残ることを確認する。
 * これがバグの本丸（草案が育つと末尾のJSON指示が黙って消えパース失敗）に対する直接の検証。
 */
describe('実テンプレートでの末尾JSON指示の保持（critique）', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // critique テンプレートに巨大な currentText を埋め込んで実プロンプトを組み立てる
    const buildOversizedCritiquePrompt = (): string => {
        const hugeDraft = 'この章の本文。'.repeat(6000); // 約 48000 文字
        return DRAFT_PROMPTS.critique
            .replace('{projectTitle}', 'テスト作品')
            .replace('{chapterTitle}', '第1章')
            .replace('{chapterSummary}', '概要')
            .replace(/\{style\}/g, '純文学')
            .replace('{styleDetails}', '文体詳細')
            .replace('{currentText}', hugeDraft);
    };

    it('DRAFT_PROMPT_CAP で通すと末尾のJSON出力形式ブロックが残る', () => {
        const assembled = buildOversizedCritiquePrompt();
        expect(assembled.length).toBeGreaterThan(DRAFT_PROMPT_CAP); // 前提: capを超える巨大プロンプト

        const result = sanitizeInputForPrompt(assembled, DRAFT_PROMPT_CAP);

        // 末尾のJSON指示（これが消えるとAIが自由文で応答しパース失敗する）
        expect(result).toContain('【出力形式】');
        expect(result).toContain('【出力ルール（厳守）】');
        expect(result).toContain('weaknesses');
        // critique テンプレートの最終行
        expect(result).toContain('7点以下の評価項目は必ずweaknessesに含める');
    });

    it('従来の末尾切り（slice）では同じ末尾ブロックが失われる（中抜きの効果の対照）', () => {
        const assembled = buildOversizedCritiquePrompt();
        const naiveTailCut = assembled.slice(0, DRAFT_PROMPT_CAP);
        // バグの再現: 末尾切りだと出力形式指示が消える
        expect(naiveTailCut).not.toContain('【出力ルール（厳守）】');
    });
});
