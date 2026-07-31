import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    encryptApiKeyAsync,
    decryptApiKeyAsync,
    isEncryptedApiKey,
} from '../../utils/securityUtils';

/**
 * APIキー復号の fail-closed 検証。
 *
 * 以前は復号に失敗すると暗号文をそのまま戻り値にしていたため、`v3:AbCd...` という
 * 文字列が「復号済みの鍵」として設定画面に入り、Authorization ヘッダーで外部APIへ
 * 送信されていた（Gemini 400 / OpenAI 401 の原因）。さらにその状態で保存すると
 * 暗号文が再暗号化され、元の鍵が失われていた。
 */
describe('decryptApiKeyAsync の fail-closed 挙動', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('暗号化した鍵を復号できる（正常系）', async () => {
        const original = 'sk-test1234567890abcdefghij';
        const encrypted = await encryptApiKeyAsync(original);

        expect(encrypted).not.toBe(original);
        expect(isEncryptedApiKey(encrypted)).toBe(true);
        expect(await decryptApiKeyAsync(encrypted)).toBe(original);
    });

    it('鍵導出の種が変わって復号できない場合、暗号文を返さず空文字を返す', async () => {
        const encrypted = await encryptApiKeyAsync('sk-test1234567890abcdefghij');

        // localStorage の種を破棄＝別端末／localStorageクリア相当。復号は OperationError になる。
        localStorage.clear();

        const result = await decryptApiKeyAsync(encrypted);

        expect(result).toBe('');
        expect(result).not.toContain('v3:');
    });

    it('壊れた暗号文でも暗号文自身を返さない', async () => {
        const result = await decryptApiKeyAsync('v3:aW52YWxpZC1kYXRhLXRoYXQtY2Fubm90LWRlY3J5cHQ=');

        expect(result).toBe('');
    });

    it('v2形式が復号できない場合も空文字を返す', async () => {
        const result = await decryptApiKeyAsync('v2:aW52YWxpZC1kYXRhLXRoYXQtY2Fubm90LWRlY3J5cHQ=');

        expect(result).toBe('');
    });

    it('平文で保存された鍵はそのまま返す（暗号化前の設定との後方互換）', async () => {
        // v2:/v3: の接頭辞が無く base64 として解釈できない値 = 平文の鍵
        const plain = 'AIzaSyA1234567890abcdefghijklmnopqrs';

        expect(await decryptApiKeyAsync(plain)).toBe(plain);
    });

    it('空文字は空文字を返す', async () => {
        expect(await decryptApiKeyAsync('')).toBe('');
    });
});

describe('isEncryptedApiKey', () => {
    it('暗号文の接頭辞を検出する', () => {
        expect(isEncryptedApiKey('v3:abcdef')).toBe(true);
        expect(isEncryptedApiKey('v2:abcdef')).toBe(true);
    });

    it('平文の鍵は暗号文と判定しない', () => {
        expect(isEncryptedApiKey('sk-abcdef1234567890')).toBe(false);
        expect(isEncryptedApiKey('AIzaSyA1234567890abcdefghijklmnopqrs')).toBe(false);
        expect(isEncryptedApiKey('')).toBe(false);
        expect(isEncryptedApiKey(null as unknown as string)).toBe(false);
    });
});
