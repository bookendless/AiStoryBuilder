/**
 * テキストファイルのエンコーディングを判定してUnicode文字列にデコードする。
 *
 * ブラウザ/WebView の File.text() は常に UTF-8 としてデコードするため、
 * Shift-JIS(CP932) や UTF-16 で保存された日本語テキストファイルが文字化けする。
 * 小説の取り込みでは、UTF-8 以外のファイルが投入されることが多く、
 * 文字化けした本文をAIに渡すと分析が破綻する（創作・捏造の温床になる）。
 *
 * ここでは追加依存なしで、以下のヒューリスティックにより日本語テキストファイルの
 * 大半（UTF-8 / UTF-16 / Shift-JIS）を正しく読む:
 *  1. BOM があれば UTF-8 / UTF-16(LE/BE) を確定
 *  2. BOM がなければ UTF-8 として厳密(fatal)にデコードを試み、不正バイトがあれば
 *     Shift-JIS(CP932) とみなしてデコードする
 *
 * 注: EUC-JP や JIS(ISO-2022-JP) は対象外（Windows 環境の小説ファイルは UTF-8 か
 * Shift-JIS が大半のため）。判定に失敗した場合は最終的にロスあり UTF-8 で返す。
 */

/** 指定ラベルでデコードを試みる。ラベル未対応や fatal 失敗時は null を返す。 */
function tryDecode(bytes: Uint8Array, label: string, fatal: boolean): string | null {
    try {
        return new TextDecoder(label, { fatal }).decode(bytes);
    } catch {
        return null;
    }
}

/**
 * 行末コードを LF に正規化する。
 *
 * \r\n（CRLF）だけでなく単独の \r（旧Mac/一部エディタ・本アプリ旧版の書き出し）、
 * U+2028（行区切り）・U+2029（段落区切り）も対象。lone \r を残すと全文が
 * 「1行」扱いになり、段落分割・見出し検出・章分割がすべて破綻する。
 */
export function normalizeLineEndings(text: string): string {
    return (text || '').replace(/\r\n|\r|\u2028|\u2029/g, '\n');
}

/**
 * バイト列を判定してデコードする。
 */
function decodeBytes(bytes: Uint8Array): string {
    // --- BOM 判定 ---
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        // UTF-8 BOM（TextDecoder('utf-8') は先頭の BOM を自動的に取り除く）
        return new TextDecoder('utf-8').decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return new TextDecoder('utf-16le').decode(bytes);
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return new TextDecoder('utf-16be').decode(bytes);
    }

    // --- BOMなし: UTF-8 を厳密に試し、不正なら Shift-JIS にフォールバック ---
    const asUtf8 = tryDecode(bytes, 'utf-8', true);
    if (asUtf8 !== null) return asUtf8;

    const asSjis = tryDecode(bytes, 'shift_jis', false);
    if (asSjis !== null) return asSjis;

    // 最終フォールバック（ロスありでも文字列を返す）
    return new TextDecoder('utf-8').decode(bytes);
}

/**
 * バイト列を判定してデコードし、行末を LF に正規化して返す。
 */
export function decodeTextSmart(buffer: ArrayBuffer): string {
    return normalizeLineEndings(decodeBytes(new Uint8Array(buffer)));
}

/**
 * File をエンコーディング判定つきで読み込み、Unicode文字列を返す。
 */
export async function readTextFileSmart(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return decodeTextSmart(buffer);
}
