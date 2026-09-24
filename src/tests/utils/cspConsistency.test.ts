import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCTION_CSP } from '../../utils/securityUtils';

/**
 * CSP の二重定義の食い違い防止。
 * アプリ本体では tauri.conf.json の CSP と実行時に注入する meta の CSP が両方適用され、
 * 厳しい方が勝つ。片方だけを変更すると、その変更は無効になるか意図せず効かなくなる。
 */
describe('CSP の定義', () => {
    const tauriConf = JSON.parse(
        readFileSync(resolve(__dirname, '../../../src-tauri/tauri.conf.json'), 'utf-8')
    ) as { app: { security: { csp: Record<string, string> } } };
    const tauriCsp = tauriConf.app.security.csp;

    it('tauri.conf.json と securityUtils の本番CSPが一致する', () => {
        expect(PRODUCTION_CSP).toEqual(tauriCsp);
    });

    it('ホスト中間にワイルドカードを含む無効なソースを書かない', () => {
        // 例: http://192.168.*:* は CSP の文法上無効で、黙って無視される
        const invalid = Object.values(tauriCsp)
            .flatMap((sources) => sources.split(/\s+/))
            .filter((source) => /^[a-z]+:\/\/[^/]*[^/*.]\.\*/.test(source) || /^[a-z]+:\/\/\d+\.\*/.test(source));
        expect(invalid).toEqual([]);
    });
});
