import { describe, it, expect } from 'vitest';
import { isAllowedLocalEndpoint } from '../../utils/securityUtils';

/**
 * ローカルLLM接続先の検証。
 *
 * 旧実装は url.hostname に対する前方一致の正規表現（/^(192\.168\.|10\.|...)/）で
 * 判定していたため、`10.evil.com` のような公開ホストが「プライベートIP」として
 * 通過していた。ここには原稿全文を含むプロンプトが送信されるため、
 * ホスト名がIPアドレスとして厳密に解析できることを必ず検証する。
 */
describe('isAllowedLocalEndpoint', () => {
    describe('許可されるエンドポイント', () => {
        it.each([
            ['http://localhost:1234/v1/chat/completions', 'localhost'],
            ['http://127.0.0.1:1234', 'ループバックIP'],
            ['http://127.1.2.3:8080', '127.0.0.0/8 全体'],
            ['http://[::1]:1234', 'IPv6ループバック'],
            ['http://10.0.2.2:1234', 'Androidエミュレータのホスト'],
            ['http://10.1.2.3:11434', '10.0.0.0/8'],
            ['http://192.168.1.10:1234', '192.168.0.0/16'],
            ['http://172.16.0.1:1234', '172.16.0.0/12 の下端'],
            ['http://172.31.255.254:1234', '172.16.0.0/12 の上端'],
            ['http://0.0.0.0:1234', '全インターフェースへのバインド表記'],
            ['https://192.168.1.10:8443', 'HTTPSの私的アドレス'],
            ['http://localhost', 'ポート省略'],
        ])('%s を許可する（%s）', (endpoint) => {
            expect(isAllowedLocalEndpoint(endpoint)).toBe(true);
        });
    });

    describe('前方一致バイパスの拒否（本修正の核心）', () => {
        it.each([
            'http://10.evil.com:1234',
            'http://192.168.attacker.tld:1234',
            'http://172.16.evil.com:1234',
            'http://127.0.0.1.evil.com:1234',
            'http://localhost.evil.com:1234',
        ])('プライベートIPに似せた公開ホスト %s を拒否する', (endpoint) => {
            expect(isAllowedLocalEndpoint(endpoint)).toBe(false);
        });
    });

    describe('その他の拒否ケース', () => {
        it.each([
            ['https://api.openai.com/v1/chat/completions', '外部API'],
            ['http://172.32.0.1:1234', '172.16.0.0/12 の範囲外'],
            ['http://172.15.0.1:1234', '172.16.0.0/12 の範囲外（下）'],
            ['http://11.0.0.1:1234', '10.0.0.0/8 の範囲外'],
            ['http://192.169.1.1:1234', '192.168.0.0/16 の範囲外'],
            ['http://8.8.8.8:1234', '公開DNS'],
            ['file:///etc/passwd', 'httpスキーム以外'],
            ['ftp://192.168.1.1', 'httpスキーム以外'],
            ['javascript:alert(1)', '危険なスキーム'],
            ['not a url', 'URLとして解析できない'],
            ['', '空文字'],
        ])('%s を拒否する（%s）', (endpoint) => {
            expect(isAllowedLocalEndpoint(endpoint)).toBe(false);
        });

        it('null / undefined を拒否する', () => {
            expect(isAllowedLocalEndpoint(null as unknown as string)).toBe(false);
            expect(isAllowedLocalEndpoint(undefined as unknown as string)).toBe(false);
        });
    });

    describe('URL正規化への追従', () => {
        it('8進数・整数表記のIPv4も正規化後の値で判定する', () => {
            // WHATWG URL は http://010.0.0.1 を 8.0.0.1 に正規化する（私的アドレスではない）
            expect(isAllowedLocalEndpoint('http://010.0.0.1:1234')).toBe(false);
            // 2130706433 は 127.0.0.1 に正規化される（ループバックなので許可）
            expect(isAllowedLocalEndpoint('http://2130706433:1234')).toBe(true);
        });
    });
});
