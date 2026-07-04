/**
 * ルビ・傍点記法ユーティリティ
 *
 * 小説投稿サイト（小説家になろう・カクヨム）互換の記法を解析する。
 * - ルビ（親文字指定）: ｜親文字《るび》 または |親文字《るび》
 * - ルビ（漢字自動判定）: 漢字《かんじ》 ※直前の連続する漢字が親文字になる
 * - 傍点: 《《強調したい文字》》
 * - エスケープ: ｜《テキスト》 は ルビにせず《テキスト》をそのまま表示
 */

export type RubySegment =
  | { type: 'text'; content: string }
  | { type: 'ruby'; base: string; ruby: string }
  | { type: 'emphasis'; content: string };

/**
 * 漢字（CJK統合漢字・拡張A・互換漢字）と踊り字等
 */
const KANJI_CLASS = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF々〆ヶヵ〇';

/**
 * 複合パターン（先頭から順に優先）
 * 1. 傍点: 《《...》》
 * 2. 明示ルビ: ｜親《るび》（親文字は空でも可＝エスケープ）
 * 3. 自動ルビ: 漢字連続《るび》
 */
const RUBY_PATTERN = new RegExp(
  '《《([^《》\\n]+?)》》' +
  '|[｜|]([^《》｜|\\n]*?)《([^《》\\n]+?)》' +
  `|([${KANJI_CLASS}]+)《([^《》\\n]+?)》`,
  'g'
);

/**
 * テキストをルビ・傍点セグメントに分解する
 */
export function parseRubySegments(text: string): RubySegment[] {
  if (!text) return [];

  const segments: RubySegment[] = [];
  let lastIndex = 0;

  RUBY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RUBY_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const [, emphasis, explicitBase, explicitRuby, autoBase, autoRuby] = match;

    if (emphasis !== undefined) {
      segments.push({ type: 'emphasis', content: emphasis });
    } else if (explicitRuby !== undefined) {
      if (explicitBase) {
        segments.push({ type: 'ruby', base: explicitBase, ruby: explicitRuby });
      } else {
        // ｜《テキスト》 はエスケープ: 《テキスト》をそのまま表示
        segments.push({ type: 'text', content: `《${explicitRuby}》` });
      }
    } else if (autoBase !== undefined && autoRuby !== undefined) {
      segments.push({ type: 'ruby', base: autoBase, ruby: autoRuby });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * ルビ記法を含むかどうか
 */
export function hasRubyNotation(text: string): boolean {
  if (!text) return false;
  RUBY_PATTERN.lastIndex = 0;
  return RUBY_PATTERN.test(text);
}

/**
 * ルビ記法をHTMLへ変換する（エクスポート用）
 * @param text 変換するテキスト
 * @param escape HTMLエスケープ関数（プレーンテキスト部分に適用）
 */
export function rubyNotationToHtml(text: string, escape: (s: string) => string): string {
  return parseRubySegments(text)
    .map(segment => {
      switch (segment.type) {
        case 'ruby':
          return `<ruby>${escape(segment.base)}<rt>${escape(segment.ruby)}</rt></ruby>`;
        case 'emphasis':
          return `<span class="emphasis-dots">${escape(segment.content)}</span>`;
        default:
          return escape(segment.content);
      }
    })
    .join('');
}

/**
 * ルビ・傍点記法を除去し、親文字のみのプレーンテキストを返す
 * （文字数カウントや検索対象テキストの正規化に使用）
 */
export function stripRubyNotation(text: string): string {
  return parseRubySegments(text)
    .map(segment => (segment.type === 'ruby' ? segment.base : segment.content))
    .join('');
}
