/**
 * テキストフォーマット処理ユーティリティ
 * AI応答から抽出した文章の改行やフォーマットを正規化する
 */

/**
 * JSONエスケープ文字をデコード
 * @param text エスケープされたテキスト
 * @returns デコードされたテキスト
 */
export function decodeJsonEscapes(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  return text
    .replace(/\\n/g, '\n')           // 改行
    .replace(/\\r/g, '\r')             // キャリッジリターン
    .replace(/\\t/g, '\t')             // タブ
    .replace(/\\"/g, '"')               // ダブルクォート
    .replace(/\\'/g, "'")               // シングルクォート
    .replace(/\\\\/g, '\\')            // バックスラッシュ
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      // Unicodeエスケープシーケンス
      return String.fromCharCode(parseInt(hex, 16));
    });
}

/**
 * 改行を正規化
 * - 連続する3つ以上の改行を2つの改行に統一（段落分け）
 * - 行末の空白を除去
 * - 空行の前後を整理
 * @param text 正規化するテキスト
 * @returns 正規化されたテキスト
 */
export function normalizeLineBreaks(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let normalized = text;

  // 行末の空白を除去
  normalized = normalized.replace(/[ \t]+$/gm, '');

  // 連続する改行（3つ以上）を2つの改行に統一
  // ただし、意図的な空行（段落分け）は保持
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // 先頭と末尾の不要な改行を除去
  normalized = normalized.replace(/^\n+/, '').replace(/\n+$/, '');

  // 行頭の空白を除去（インデントを保持したい場合は削除）
  // normalized = normalized.replace(/^[ \t]+/gm, '');

  return normalized;
}

/**
 * 文章全体をフォーマット
 * - JSONエスケープのデコード
 * - 改行の正規化
 * - 段落分けの整理
 * @param text フォーマットするテキスト
 * @returns フォーマットされたテキスト
 */
export function formatText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // まずJSONエスケープをデコード
  let formatted = decodeJsonEscapes(text);

  // 改行を正規化
  formatted = normalizeLineBreaks(formatted);

  return formatted;
}

/**
 * JSON文字列から文章を抽出してフォーマット
 * JSON内のエスケープされた改行を適切に処理
 * @param jsonString JSON文字列
 * @param key 抽出するキー（デフォルト: 'revisedText'）
 * @returns フォーマットされた文章
 */
export function extractAndFormatTextFromJson(
  jsonString: string,
  key: string = 'revisedText'
): string {
  if (!jsonString || typeof jsonString !== 'string') {
    return '';
  }

  try {
    // JSONをパース
    const parsed = JSON.parse(jsonString);
    
    // 指定されたキーからテキストを取得
    const text = parsed[key] || parsed[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || '';
    
    if (!text || typeof text !== 'string') {
      return '';
    }

    // フォーマットを適用
    return formatText(text);
  } catch (error) {
    console.warn('JSONからのテキスト抽出に失敗:', error);
    return '';
  }
}

















































