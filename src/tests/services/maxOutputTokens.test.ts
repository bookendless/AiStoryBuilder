import { describe, it, expect } from 'vitest';
import {
  AI_PROVIDERS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  findModel,
  getMaxOutputTokens,
  resolveMaxOutputTokens,
} from '../../services/providers';
import { AISettings } from '../../types/ai';

/**
 * AIModel.contextWindow（入力コンテキスト長）を出力上限として API に送っていた不具合の回帰テスト。
 *
 * 設定画面の入力上限・保存値のクランプ・API送信の3経路がすべて
 * getMaxOutputTokens / resolveMaxOutputTokens を通ることを前提にしているため、
 * ここが崩れると「画面は通すのにAPIが400を返す」状態に戻る。
 */

const settingsFor = (provider: string, model: string, maxTokens: number): AISettings => ({
  provider,
  model,
  temperature: 0.7,
  maxTokens,
});

describe('モデル定義の健全性', () => {
  it('全モデルが出力上限をコンテキスト長以下で持っている', () => {
    for (const provider of AI_PROVIDERS) {
      for (const model of provider.models) {
        expect(model.maxOutputTokens, `${provider.id}/${model.id}`).toBeGreaterThan(0);
        expect(model.contextWindow, `${provider.id}/${model.id}`).toBeGreaterThan(0);
        // 出力上限がコンテキスト長を超えるモデルは存在しない。
        // 超えていたら、コンテキスト長を出力上限に取り違えた値が紛れ込んでいる
        expect(model.maxOutputTokens, `${provider.id}/${model.id}`).toBeLessThanOrEqual(model.contextWindow);
      }
    }
  });

  it('出力上限に 1,000,000 以上のコンテキスト長由来の値が紛れ込んでいない', () => {
    for (const provider of AI_PROVIDERS) {
      for (const model of provider.models) {
        expect(model.maxOutputTokens, `${provider.id}/${model.id}`).toBeLessThan(1_000_000);
      }
    }
  });
});

describe('getMaxOutputTokens', () => {
  it('登録済みモデルはモデル定義の値を返す', () => {
    expect(getMaxOutputTokens('gemini', 'gemini-2.5-pro')).toBe(65536);
    expect(getMaxOutputTokens('claude', 'claude-opus-5')).toBe(128000);
    expect(getMaxOutputTokens('claude', 'claude-haiku-4-5-20251001')).toBe(64000);
    expect(getMaxOutputTokens('openai', 'gpt-4o')).toBe(16384);
    expect(getMaxOutputTokens('local', 'local-model')).toBe(8192);
  });

  it('コンテキスト長ではなく出力上限を返す', () => {
    // gemini-2.5-pro は 2M コンテキスト。ここが 2000000 を返すと不具合が再発している
    expect(findModel('gemini', 'gemini-2.5-pro')?.contextWindow).toBe(2000000);
    expect(getMaxOutputTokens('gemini', 'gemini-2.5-pro')).not.toBe(2000000);
  });

  it('未登録のモデルIDは既定値にフォールバックする', () => {
    // 更新で保存済みのモデルIDがリストから消えた場合を想定
    expect(getMaxOutputTokens('claude', 'claude-retired-model')).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(getMaxOutputTokens('unknown-provider', 'whatever')).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(getMaxOutputTokens(undefined, undefined)).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });
});

describe('resolveMaxOutputTokens', () => {
  it('設定値が上限以下ならそのまま使う', () => {
    expect(resolveMaxOutputTokens(settingsFor('claude', 'claude-opus-5', 3000))).toBe(3000);
  });

  it('設定値が上限を超えたら上限で頭打ちにする', () => {
    expect(resolveMaxOutputTokens(settingsFor('claude', 'claude-opus-5', 1000000))).toBe(128000);
    expect(resolveMaxOutputTokens(settingsFor('gemini', 'gemini-2.5-pro', 2000000))).toBe(65536);
  });

  it('ローカルLLMは 8,192 で頭打ちになる（従来の送信時クランプと同値）', () => {
    expect(resolveMaxOutputTokens(settingsFor('local', 'local-model', 32768))).toBe(8192);
    expect(resolveMaxOutputTokens(settingsFor('local', 'local-model', 4000))).toBe(4000);
  });

  it('未登録モデルは既定値で頭打ちにする', () => {
    expect(resolveMaxOutputTokens(settingsFor('local', 'm', 100))).toBe(100);
    expect(resolveMaxOutputTokens(settingsFor('local', 'm', 999999))).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('NaN や 0 以下は送らず既定値にフォールバックする', () => {
    // 数値入力を空にすると parseInt が NaN を返す。そのまま送ると原因の分かりにくい400になる
    expect(resolveMaxOutputTokens(settingsFor('claude', 'claude-opus-5', NaN))).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(settingsFor('claude', 'claude-opus-5', 0))).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(resolveMaxOutputTokens(settingsFor('claude', 'claude-opus-5', -1))).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    // フォールバック値もモデルの上限を超えない
    expect(resolveMaxOutputTokens(settingsFor('local', 'local-model', NaN))).toBe(8192);
  });
});
