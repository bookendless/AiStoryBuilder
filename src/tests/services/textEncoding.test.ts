import { describe, it, expect } from 'vitest';
import { decodeTextSmart, normalizeLineEndings } from '../../utils/textEncoding';

function buf(bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
}

describe('decodeTextSmart', () => {
    it('BOMなしUTF-8をそのままデコードする', () => {
        const bytes = Array.from(new TextEncoder().encode('日本語テスト'));
        expect(decodeTextSmart(buf(bytes))).toBe('日本語テスト');
    });

    it('UTF-8 BOM付きはBOMを除去してデコードする', () => {
        const bytes = [0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('あ')];
        expect(decodeTextSmart(buf(bytes))).toBe('あ');
    });

    it('Shift-JIS(CP932)を文字化けせずデコードする', () => {
        // 「こんにちは」の Shift-JIS バイト列
        const sjis = [0x82, 0xB1, 0x82, 0xF1, 0x82, 0xC9, 0x82, 0xBF, 0x82, 0xCD];
        expect(decodeTextSmart(buf(sjis))).toBe('こんにちは');
    });

    it('Shift-JISの本文をUTF-8と誤読しない（不正UTF-8→SJISフォールバック）', () => {
        // 「日本語」の Shift-JIS バイト列
        const sjis = [0x93, 0xFA, 0x96, 0x7B, 0x8C, 0xEA];
        expect(decodeTextSmart(buf(sjis))).toBe('日本語');
    });

    it('UTF-16LE BOM付きをデコードする', () => {
        // BOM(FF FE) + 「あ」(U+3042 → LE: 42 30)
        const bytes = [0xFF, 0xFE, 0x42, 0x30];
        expect(decodeTextSmart(buf(bytes))).toBe('あ');
    });

    it('UTF-16BE BOM付きをデコードする', () => {
        // BOM(FE FF) + 「あ」(U+3042 → BE: 30 42)
        const bytes = [0xFE, 0xFF, 0x30, 0x42];
        expect(decodeTextSmart(buf(bytes))).toBe('あ');
    });

    it('ASCIIはそのまま', () => {
        const bytes = Array.from(new TextEncoder().encode('Hello, world!'));
        expect(decodeTextSmart(buf(bytes))).toBe('Hello, world!');
    });

    it('CRのみ（lone \\r）の改行をLFに正規化する', () => {
        const bytes = Array.from(new TextEncoder().encode('一行目\r二行目\r三行目'));
        expect(decodeTextSmart(buf(bytes))).toBe('一行目\n二行目\n三行目');
    });

    it('CRLFをLFに正規化する', () => {
        const bytes = Array.from(new TextEncoder().encode('A\r\nB\r\nC'));
        expect(decodeTextSmart(buf(bytes))).toBe('A\nB\nC');
    });

    it('UTF-16LE + CRのみ改行も正規化する', () => {
        // BOM(FF FE) + 「あ」(U+3042) + CR(U+000D) + 「い」(U+3044)
        const bytes = [0xFF, 0xFE, 0x42, 0x30, 0x0D, 0x00, 0x44, 0x30];
        expect(decodeTextSmart(buf(bytes))).toBe('あ\nい');
    });
});

describe('normalizeLineEndings', () => {
    it('CRLF・lone CR・LF が混在しても全てLFに揃える', () => {
        expect(normalizeLineEndings('A\r\nB\rC\nD')).toBe('A\nB\nC\nD');
    });

    it('U+2028/U+2029 もLFに正規化する', () => {
        const ls = String.fromCharCode(0x2028);
        const ps = String.fromCharCode(0x2029);
        expect(normalizeLineEndings(`A${ls}B${ps}C`)).toBe('A\nB\nC');
    });

    it('冪等（正規化済みテキストを変えない）', () => {
        const once = normalizeLineEndings('A\r\nB\rC');
        expect(normalizeLineEndings(once)).toBe(once);
    });

    it('空・null系入力は空文字を返す', () => {
        expect(normalizeLineEndings('')).toBe('');
        expect(normalizeLineEndings(undefined as unknown as string)).toBe('');
    });
});
