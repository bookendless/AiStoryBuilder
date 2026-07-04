import { describe, it, expect } from 'vitest';
import { proofreadText, applyCorrections } from '../../utils/proofreadUtils';

describe('proofreadText', () => {
  it('かぎ括弧の閉じ忘れを検出する', () => {
    const issues = proofreadText('「こんにちは、と彼は言った。');
    expect(issues.some(i => i.type === 'unclosed-bracket')).toBe(true);
  });

  it('対応の取れた括弧は指摘しない', () => {
    const issues = proofreadText('「こんにちは」と彼は言った。');
    expect(issues.filter(i => i.type === 'unclosed-bracket')).toEqual([]);
  });

  it('「。。。」を検出する', () => {
    const issues = proofreadText('　そうか。。。わかった。');
    expect(issues.some(i => i.type === 'ellipsis-style')).toBe(true);
  });

  it('三点リーダの奇数個使用を検出する', () => {
    const issues = proofreadText('　それは…そうだが。');
    expect(issues.some(i => i.type === 'ellipsis-style')).toBe(true);
  });

  it('偶数個の三点リーダは指摘しない', () => {
    const issues = proofreadText('　それは……そうだが。');
    expect(issues.filter(i => i.type === 'ellipsis-style')).toEqual([]);
  });

  it('ダッシュの奇数個使用を検出する', () => {
    const issues = proofreadText('　彼は―そう思った。');
    expect(issues.some(i => i.type === 'dash-style')).toBe(true);
  });

  it('感嘆符の直後にスペースがない場合を検出する', () => {
    const issues = proofreadText('　なんだって！そんなはずは。');
    expect(issues.some(i => i.type === 'punctuation-space')).toBe(true);
  });

  it('感嘆符の後の全角スペースや閉じ括弧は指摘しない', () => {
    const issues = proofreadText('　「なんだって！」なんだって！　そうか！？');
    expect(issues.filter(i => i.type === 'punctuation-space')).toEqual([]);
  });

  it('字下げがない段落が多い場合に指摘する', () => {
    const text = '彼は歩いた。\n空は青かった。\n風が吹いた。\n遠くで鳥が鳴いた。';
    const issues = proofreadText(text);
    expect(issues.some(i => i.type === 'indentation')).toBe(true);
  });

  it('字下げ済みや会話文は指摘しない', () => {
    const text = '　彼は歩いた。\n「いい天気だ」\n　空は青かった。';
    const issues = proofreadText(text);
    expect(issues.filter(i => i.type === 'indentation')).toEqual([]);
  });

  it('括弧不整合は最初に発生した行を報告する', () => {
    const text = '「開いたまま\n二行目\n三行目\n四行目';
    const issue = proofreadText(text).find(i => i.type === 'unclosed-bracket');
    expect(issue?.line).toBe(1);
  });

  it('空文字列は空配列を返す', () => {
    expect(proofreadText('')).toEqual([]);
  });
});

describe('applyCorrections', () => {
  it('同じ語が複数回出てもすべて置換する（最初の1件だけではない）', () => {
    const { newText, applied } = applyCorrections('猫と猫と猫', [
      { before: '猫', after: '犬' },
    ]);
    expect(newText).toBe('犬と犬と犬');
    // applied は出現回数ではなく修正候補の件数
    expect(applied).toBe(1);
  });

  it('置換後テキストの $ 記号は特殊置換されずそのまま挿入される', () => {
    const { newText } = applyCorrections('価格はここ', [
      { before: 'ここ', after: '$100（$&や$1を含む）' },
    ]);
    expect(newText).toBe('価格は$100（$&や$1を含む）');
  });

  it('本文に存在しない before はスキップされ applied に数えない', () => {
    const { newText, applied } = applyCorrections('あいうえお', [
      { before: 'かき', after: 'X' },
      { before: 'あい', after: 'AB' },
    ]);
    expect(newText).toBe('ABうえお');
    expect(applied).toBe(1);
  });
});
