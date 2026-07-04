import { describe, it, expect } from 'vitest';
import {
  parseRubySegments,
  rubyNotationToHtml,
  stripRubyNotation,
  hasRubyNotation,
} from '../../utils/rubyUtils';

const identity = (s: string) => s;

describe('parseRubySegments', () => {
  it('明示ルビ（全角縦棒）を解析する', () => {
    expect(parseRubySegments('｜東京《とうきょう》へ行く')).toEqual([
      { type: 'ruby', base: '東京', ruby: 'とうきょう' },
      { type: 'text', content: 'へ行く' },
    ]);
  });

  it('明示ルビ（半角パイプ）を解析する', () => {
    expect(parseRubySegments('|運命《さだめ》')).toEqual([
      { type: 'ruby', base: '運命', ruby: 'さだめ' },
    ]);
  });

  it('漢字自動判定ルビを解析する', () => {
    expect(parseRubySegments('彼は東京《とうきょう》に住む')).toEqual([
      { type: 'text', content: '彼は' },
      { type: 'ruby', base: '東京', ruby: 'とうきょう' },
      { type: 'text', content: 'に住む' },
    ]);
  });

  it('カタカナには自動ルビを付けない', () => {
    expect(parseRubySegments('カフェ《かふぇ》')).toEqual([
      { type: 'text', content: 'カフェ《かふぇ》' },
    ]);
  });

  it('傍点を解析する', () => {
    expect(parseRubySegments('それは《《本物》》だった')).toEqual([
      { type: 'text', content: 'それは' },
      { type: 'emphasis', content: '本物' },
      { type: 'text', content: 'だった' },
    ]);
  });

  it('エスケープ（｜《テキスト》）はそのまま表示する', () => {
    expect(parseRubySegments('｜《注釈》')).toEqual([
      { type: 'text', content: '《注釈》' },
    ]);
  });

  it('記法なしのテキストはそのまま返す', () => {
    expect(parseRubySegments('普通の文章です。')).toEqual([
      { type: 'text', content: '普通の文章です。' },
    ]);
  });

  it('空文字列は空配列を返す', () => {
    expect(parseRubySegments('')).toEqual([]);
  });

  it('複数の記法が混在しても解析できる', () => {
    const segments = parseRubySegments('｜彼《かれ》は《《決意》》し、宿命《しゅくめい》に挑む');
    expect(segments).toEqual([
      { type: 'ruby', base: '彼', ruby: 'かれ' },
      { type: 'text', content: 'は' },
      { type: 'emphasis', content: '決意' },
      { type: 'text', content: 'し、' },
      { type: 'ruby', base: '宿命', ruby: 'しゅくめい' },
      { type: 'text', content: 'に挑む' },
    ]);
  });

  it('改行をまたぐ記法は無効', () => {
    expect(parseRubySegments('東京《とう\nきょう》')).toEqual([
      { type: 'text', content: '東京《とう\nきょう》' },
    ]);
  });
});

describe('rubyNotationToHtml', () => {
  it('ルビをrubyタグへ変換する', () => {
    expect(rubyNotationToHtml('｜東京《とうきょう》', identity)).toBe(
      '<ruby>東京<rt>とうきょう</rt></ruby>'
    );
  });

  it('傍点をemphasis-dotsスパンへ変換する', () => {
    expect(rubyNotationToHtml('《《重要》》', identity)).toBe(
      '<span class="emphasis-dots">重要</span>'
    );
  });

  it('エスケープ関数がテキスト部分に適用される', () => {
    const escape = (s: string) => s.replace(/</g, '&lt;');
    expect(rubyNotationToHtml('<b>太字</b>', escape)).toBe('&lt;b>太字&lt;/b>');
  });
});

describe('stripRubyNotation', () => {
  it('ルビ記法を除去し親文字のみを返す', () => {
    expect(stripRubyNotation('｜東京《とうきょう》へ行く')).toBe('東京へ行く');
  });

  it('傍点記法を除去する', () => {
    expect(stripRubyNotation('《《本物》》だ')).toBe('本物だ');
  });
});

describe('hasRubyNotation', () => {
  it('ルビ記法があればtrue', () => {
    expect(hasRubyNotation('東京《とうきょう》')).toBe(true);
  });

  it('記法がなければfalse', () => {
    expect(hasRubyNotation('普通の文章《』')).toBe(false);
  });
});
