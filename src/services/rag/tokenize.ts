/**
 * 日本語対応トークナイザ（BM25 用）
 *
 * 分かち書きが無い日本語テキストを形態素解析なしで検索可能にするため、
 * CJK 文字列は文字バイグラムに分解する。英数字は連続をひとつの語トークンとして扱う。
 * NFKC 正規化により全角英数・半角カナは統一される。
 */

const isCjk = (code: number): boolean =>
    (code >= 0x3040 && code <= 0x30ff) || // ひらがな・カタカナ（長音符含む）
    (code >= 0x3400 && code <= 0x4dbf) || // CJK拡張A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK統合漢字
    (code >= 0xf900 && code <= 0xfaff);   // CJK互換漢字

const isWordChar = (code: number): boolean =>
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x61 && code <= 0x7a);   // a-z（lowercase 済み前提）

export const tokenize = (text: string): string[] => {
    const normalized = text.normalize('NFKC').toLowerCase();
    const tokens: string[] = [];

    let i = 0;
    const len = normalized.length;
    while (i < len) {
        const code = normalized.charCodeAt(i);

        if (isWordChar(code)) {
            let end = i + 1;
            while (end < len && isWordChar(normalized.charCodeAt(end))) end++;
            tokens.push(normalized.slice(i, end));
            i = end;
        } else if (isCjk(code)) {
            let end = i + 1;
            while (end < len && isCjk(normalized.charCodeAt(end))) end++;
            const run = normalized.slice(i, end);
            if (run.length === 1) {
                tokens.push(run);
            } else {
                for (let j = 0; j < run.length - 1; j++) {
                    tokens.push(run.slice(j, j + 2));
                }
            }
            i = end;
        } else {
            i++;
        }
    }

    return tokens;
};
