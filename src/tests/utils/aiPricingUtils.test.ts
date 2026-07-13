import { describe, it, expect } from 'vitest';
import { getModelPrice, estimateCost, formatUsd } from '../../utils/aiPricingUtils';

describe('getModelPrice', () => {
  it('Claude Opusは高単価', () => {
    expect(getModelPrice('claude', 'claude-opus-4-8')).toEqual({ input: 5, output: 25 });
  });
  it('Claude Fable 5はOpusより高単価', () => {
    expect(getModelPrice('claude', 'claude-fable-5')).toEqual({ input: 10, output: 50 });
  });
  it('Claude Haikuは低単価', () => {
    expect(getModelPrice('claude', 'claude-haiku-4-5-20251001')).toEqual({ input: 1, output: 5 });
  });
  it('OpenAI nanoはminiより先にマッチする', () => {
    expect(getModelPrice('openai', 'gpt-5.4-nano')).toEqual({ input: 0.05, output: 0.4 });
  });
  it('OpenAI miniはgpt-5系の一般単価より優先', () => {
    expect(getModelPrice('openai', 'gpt-5.4-mini')).toEqual({ input: 0.25, output: 2 });
  });
  it('Geminiのflash-liteはflashより先にマッチ', () => {
    expect(getModelPrice('gemini', 'gemini-3.1-flash-lite')).toEqual({ input: 0.1, output: 0.4 });
  });
  it('ローカルは無料', () => {
    expect(getModelPrice('local', 'local-model')).toEqual({ input: 0, output: 0 });
  });
  it('モデルIDの大文字表記も同じ単価にマッチする', () => {
    expect(getModelPrice('claude', 'Claude-3-OPUS')).toEqual({ input: 5, output: 25 });
  });
  it('未知プロバイダーはOpenAI既定単価にフォールバックする', () => {
    expect(getModelPrice('unknown', 'whatever')).toEqual({ input: 1, output: 8 });
  });
});

describe('estimateCost', () => {
  it('入出力トークンから概算コストを計算する', () => {
    // opus: input 5/1M, output 25/1M
    // 1M input + 1M output = 5 + 25 = 30
    expect(estimateCost('claude', 'claude-opus-4-8', 1_000_000, 1_000_000)).toBeCloseTo(30);
  });
  it('ローカルは常に0', () => {
    expect(estimateCost('local', 'local-model', 1_000_000, 1_000_000)).toBe(0);
  });
});

describe('formatUsd', () => {
  it('0は$0.00', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });
  it('極小額は < $0.001', () => {
    expect(formatUsd(0.0005)).toBe('< $0.001');
  });
  it('1未満は小数3桁', () => {
    expect(formatUsd(0.123)).toBe('$0.123');
  });
  it('1以上は小数2桁', () => {
    expect(formatUsd(12.345)).toBe('$12.35');
  });
});
