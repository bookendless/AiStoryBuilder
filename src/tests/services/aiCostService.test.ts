import { describe, it, expect } from 'vitest';
import { summarizeEvents, currentMonthKey, UsageEvent } from '../../services/aiCostService';

const event = (over: Partial<UsageEvent>): UsageEvent => ({
  provider: 'claude',
  model: 'claude-opus-4-8',
  promptTokens: 1000,
  completionTokens: 500,
  totalTokens: 1500,
  timestamp: Date.now(),
  ...over,
});

describe('summarizeEvents', () => {
  it('プロバイダー・モデル別に集計する', () => {
    const summary = summarizeEvents([
      event({}),
      event({}),
      event({ provider: 'openai', model: 'gpt-5.5' }),
    ]);
    expect(summary.rows).toHaveLength(2);
    expect(summary.totalCalls).toBe(3);
    expect(summary.totalTokens).toBe(4500);
  });

  it('同じモデルの呼び出しはトークンを合算する', () => {
    const summary = summarizeEvents([event({}), event({})]);
    const opus = summary.rows.find(r => r.model === 'claude-opus-4-8');
    expect(opus?.calls).toBe(2);
    expect(opus?.promptTokens).toBe(2000);
    expect(opus?.completionTokens).toBe(1000);
  });

  it('コストの高い順にソートされる', () => {
    const summary = summarizeEvents([
      event({ provider: 'local', model: 'local-model' }),
      event({ provider: 'claude', model: 'claude-opus-4-8' }),
    ]);
    expect(summary.rows[0].provider).toBe('claude');
    expect(summary.rows[1].provider).toBe('local');
  });

  it('空配列は合計0', () => {
    const summary = summarizeEvents([]);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalCalls).toBe(0);
    expect(summary.rows).toEqual([]);
  });
});

describe('currentMonthKey', () => {
  it('YYYY-MM形式で返す', () => {
    expect(currentMonthKey(new Date(2026, 6, 15))).toBe('2026-07');
    expect(currentMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});
