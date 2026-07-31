import { describe, it, expect } from 'vitest';
import { sanitizeInputForPrompt, maskSecretsInText } from '../../utils/securityUtils';

/**
 * サニタイズが著者の原稿を書き換えないことの回帰テスト。
 *
 * 旧実装はプロンプトインジェクション対策として「無視」「忘れる」「上書き」等の語句や
 * "you are 〜" 以降100文字を削除し、さらに該当語を含む「行」を丸ごと捨てていた。
 * これらは日本語の小説本文に日常的に現れるため、原稿が黙って壊れていた。
 * ユーザー自身の原稿をユーザー自身のAPIキーで送る構造上、この削除は防御にならない。
 */
describe('サニタイズは原稿本文を保持する', () => {
    it.each([
        '無視',
        '忘れる',
        '上書き',
        '置き換え',
        '新しい指示',
    ])('日本語の一般語「%s」を削除しない', (word) => {
        const input = `彼女はその声を${word}ことにした。`;
        expect(sanitizeInputForPrompt(input)).toContain(word);
    });

    it('「無視」を含む地の文が1行まるごと消えない', () => {
        const input = [
            '第一章',
            '警告を無視した結果、彼は扉の前に立っていた。',
            '扉の向こうから声がした。',
        ].join('\n');

        const result = sanitizeInputForPrompt(input);

        expect(result).toContain('警告を無視した結果、彼は扉の前に立っていた。');
        expect(result).toContain('第一章');
        expect(result).toContain('扉の向こうから声がした。');
    });

    it('英語の "you are" 以降が削除されない', () => {
        const input = 'He whispered, "you are the only one who remembers me," and turned away.';
        const result = sanitizeInputForPrompt(input);

        expect(result).toContain('you are the only one who remembers me');
        expect(result).toContain('turned away');
    });

    it('前の指示を忘れる、といった台詞も保持される', () => {
        const input = '「以前の指示を忘れるな」と老人は言った。';
        expect(sanitizeInputForPrompt(input)).toContain('以前の指示を忘れる');
    });

    it('鉤括弧で始まる行の先頭記号を削らない', () => {
        const input = '「おはよう」と彼は言った。';
        expect(sanitizeInputForPrompt(input)).toBe('「おはよう」と彼は言った。');
    });

    it('末尾の句点や記号を削らない', () => {
        const input = '彼は静かに扉を閉めた。';
        expect(sanitizeInputForPrompt(input)).toBe('彼は静かに扉を閉めた。');
    });
});

/**
 * 既存のプロンプト設計（【】マーカー方式）が前提とする挙動は維持する。
 */
describe('サニタイズが維持する挙動', () => {
    it('山括弧は引き続き除去される（XMLタグを使えない前提のため）', () => {
        expect(sanitizeInputForPrompt('a<script>b</script>c')).not.toContain('<');
        expect(sanitizeInputForPrompt('a<script>b</script>c')).not.toContain('>');
    });

    it('制御文字は除去される', () => {
        expect(sanitizeInputForPrompt('あ\x00い\x07う')).toBe('あいう');
    });

    it('3つ以上の連続改行は2つに圧縮される', () => {
        expect(sanitizeInputForPrompt('あ\n\n\n\nい')).toBe('あ\n\nい');
    });

    it('【】マーカーは保持される', () => {
        const input = '【出力形式】\nJSONで出力してください。';
        expect(sanitizeInputForPrompt(input)).toContain('【出力形式】');
    });
});

/**
 * AIログは IndexedDB に永続化され、ファイル書き出しやデータエクスポートにも含まれる。
 */
describe('maskSecretsInText', () => {
    it('各プロバイダーのAPIキー形式をマスクする', () => {
        expect(maskSecretsInText('key: sk-abcdefghijklmnopqrstuvwxyz123456')).not.toContain('abcdefghijklmnop');
        expect(maskSecretsInText('AIzaSyA1234567890abcdefghijklmnopqrstu')).toContain('AIza***');
        expect(maskSecretsInText('sk-ant-api03-abcdefghijklmnop')).toContain('sk-ant-***');
        expect(maskSecretsInText('xai-abcdefghijklmnopqrstuvwxyz')).toContain('xai-***');
    });

    it('api_key= 形式の値をマスクする', () => {
        expect(maskSecretsInText('api_key=supersecretvalue')).toBe('api_key=***');
        expect(maskSecretsInText('password: hunter2')).toBe('password: ***');
    });

    it('原稿本文は切り詰めず変更しない', () => {
        const manuscript = 'あ'.repeat(5000);
        expect(maskSecretsInText(manuscript)).toBe(manuscript);
    });

    it('空文字・非文字列を安全に扱う', () => {
        expect(maskSecretsInText('')).toBe('');
        expect(maskSecretsInText(null as unknown as string)).toBe(null);
    });
});
