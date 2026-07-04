import { describe, it, expect } from 'vitest';
import { convertForSite } from '../../utils/webNovelUtils';

describe('convertForSite', () => {
  it('カクヨムはそのまま返す', () => {
    const text = '｜東京《とうきょう》で《《決意》》した。';
    expect(convertForSite(text, 'kakuyomu')).toBe(text);
  });

  it('なろうはルビを維持する', () => {
    expect(convertForSite('｜東京《とうきょう》へ', 'narou')).toBe('｜東京《とうきょう》へ');
  });

  it('なろうは傍点を1文字ずつ「・」ルビへ変換する', () => {
    expect(convertForSite('《《決意》》', 'narou')).toBe('｜決《・》｜意《・》');
  });

  it('記法なしのテキストはそのまま', () => {
    expect(convertForSite('普通の文章。', 'narou')).toBe('普通の文章。');
  });

  it('空文字列は空文字列', () => {
    expect(convertForSite('', 'narou')).toBe('');
  });
});
