/**
 * 小説投稿サイト向け出力ユーティリティ
 *
 * アプリ内のルビ・傍点記法（カクヨム互換）を、投稿サイトごとの記法へ変換する。
 * - カクヨム: ｜親文字《るび》 と 《《傍点》》 をそのまま利用可能
 * - 小説家になろう: ルビは同記法だが《《傍点》》非対応のため、1文字ずつ「・」ルビへ変換
 */

import { parseRubySegments } from './rubyUtils';

export type WebNovelSite = 'narou' | 'kakuyomu';

export const WEB_NOVEL_SITE_LABELS: Record<WebNovelSite, string> = {
  narou: '小説家になろう',
  kakuyomu: 'カクヨム',
};

/**
 * 傍点を「なろう」互換（1文字ずつ｜字《・》）へ変換する
 */
function emphasisToNarou(content: string): string {
  return Array.from(content)
    .map(char => (/\s/.test(char) ? char : `｜${char}《・》`))
    .join('');
}

/**
 * 投稿サイト向けにテキストを変換する
 */
export function convertForSite(text: string, site: WebNovelSite): string {
  if (!text) return '';

  if (site === 'kakuyomu') {
    // アプリ内記法はカクヨム互換なのでそのまま
    return text;
  }

  // なろう: 傍点のみ変換、ルビ・地の文はそのまま
  return parseRubySegments(text)
    .map(segment => {
      switch (segment.type) {
        case 'ruby':
          return `｜${segment.base}《${segment.ruby}》`;
        case 'emphasis':
          return emphasisToNarou(segment.content);
        default:
          return segment.content;
      }
    })
    .join('');
}
