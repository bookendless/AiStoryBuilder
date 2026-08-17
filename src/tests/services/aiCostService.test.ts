import { describe, it, expect } from 'vitest';
import {
  summarizeEvents,
  summarizeByProject,
  summarizeByPurpose,
  currentMonthKey,
  UsageEvent,
} from '../../services/aiCostService';

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

/**
 * 作品別・工程別の按分。
 * 未指定の記録を捨てないことが要点。捨てると「合計」と内訳の和がずれ、
 * どこで使ったか分からない費用が見えないまま消える。
 */
describe('summarizeByProject', () => {
  const titles = new Map([['p1', '銀の航跡'], ['p2', '夜明けの塔']]);

  it('作品ごとに集計し、作品名で表示する', () => {
    const rows = summarizeByProject(
      [event({ projectId: 'p1' }), event({ projectId: 'p1' }), event({ projectId: 'p2' })],
      titles
    );
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.key === 'p1')?.label).toBe('銀の航跡');
    expect(rows.find(r => r.key === 'p1')?.calls).toBe(2);
  });

  it('projectId の無い記録は「未分類」にまとめる（合計と内訳の和を合わせるため）', () => {
    const rows = summarizeByProject([event({}), event({ projectId: 'p1' })], titles);
    const unassigned = rows.find(r => r.label === '未分類');
    expect(unassigned?.calls).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.calls, 0)).toBe(2);
  });

  it('削除済みの作品IDでも記録を落とさない', () => {
    const rows = summarizeByProject([event({ projectId: 'gone' })], titles);
    expect(rows[0].label).toBe('削除済みの作品');
    expect(rows[0].calls).toBe(1);
  });

  it('コストの高い順にソートされる', () => {
    const rows = summarizeByProject(
      [
        event({ projectId: 'p1', provider: 'local', model: 'local-model' }),
        event({ projectId: 'p2' }),
      ],
      titles
    );
    expect(rows[0].key).toBe('p2');
  });
});

describe('summarizeByPurpose', () => {
  it('工程ごとに集計し、日本語ラベルを付ける', () => {
    const rows = summarizeByPurpose([
      event({ purpose: 'prose' }),
      event({ purpose: 'prose' }),
      event({ purpose: 'proofread' }),
    ]);
    expect(rows.find(r => r.key === 'prose')?.calls).toBe(2);
    expect(rows.find(r => r.key === 'prose')?.label).not.toBe('prose');
    expect(rows.find(r => r.key === 'proofread')?.calls).toBe(1);
  });

  it('purpose の無い記録は「未分類」にまとめる', () => {
    const rows = summarizeByPurpose([event({}), event({ purpose: 'prose' })]);
    expect(rows.reduce((sum, r) => sum + r.calls, 0)).toBe(2);
    expect(rows.some(r => r.label === '未分類')).toBe(true);
  });

  it('空配列は空の内訳', () => {
    expect(summarizeByPurpose([])).toEqual([]);
  });
});

describe('内訳と合計の整合', () => {
  it('どの軸でも回数・トークンの合計が一致する', () => {
    const events = [
      event({ projectId: 'p1', purpose: 'prose' }),
      event({ projectId: 'p2', purpose: 'proofread' }),
      event({}),
    ];
    const total = summarizeEvents(events);
    const project = summarizeByProject(events, new Map());
    const purpose = summarizeByPurpose(events);

    for (const rows of [project, purpose]) {
      expect(rows.reduce((s, r) => s + r.calls, 0)).toBe(total.totalCalls);
      expect(rows.reduce((s, r) => s + r.totalTokens, 0)).toBe(total.totalTokens);
    }
  });
});

describe('currentMonthKey', () => {
  it('YYYY-MM形式で返す', () => {
    expect(currentMonthKey(new Date(2026, 6, 15))).toBe('2026-07');
    expect(currentMonthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });
});
