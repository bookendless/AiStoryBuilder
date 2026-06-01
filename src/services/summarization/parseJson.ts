/**
 * LLM応答から寛容にJSONを取り出すヘルパー
 *
 * モデルはコードフェンスや前置き・後置きのテキストを付けることがあるため、
 * 最初に現れる JSON オブジェクト/配列を抽出してパースする。
 */

/**
 * テキスト中の最初の JSON オブジェクト or 配列を抽出してパースする。
 * 失敗した場合は null を返す（呼び出し側でフォールバック処理）。
 */
export function parseJsonLoose<T = unknown>(text: string): T | null {
    if (!text) return null;

    // コードフェンス除去
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();

    // そのままパースを試行
    try {
        return JSON.parse(cleaned) as T;
    } catch {
        // 続行：部分抽出を試みる
    }

    // 最初の { ... } または [ ... ] を抽出（ネスト対応の簡易スキャン）
    const start = cleaned.search(/[[{]/);
    if (start === -1) return null;

    const openChar = cleaned[start];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
        } else if (ch === openChar) {
            depth++;
        } else if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                const candidate = cleaned.substring(start, i + 1);
                try {
                    return JSON.parse(candidate) as T;
                } catch {
                    return null;
                }
            }
        }
    }

    return null;
}
