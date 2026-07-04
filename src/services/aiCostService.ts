/**
 * AI利用コスト記録サービス
 *
 * AI生成のたびにトークン使用量を記録し、プロバイダー・モデル別／月別に
 * 概算コストを集計する。本体スキーマのマイグレーションを避けるため専用DBを用いる。
 */

import Dexie from 'dexie';
import { estimateCost } from '../utils/aiPricingUtils';

export interface UsageEvent {
  id?: number;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
}

export interface UsageSummaryRow {
  provider: string;
  model: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

export interface UsageSummary {
  rows: UsageSummaryRow[];
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
}

class AICostDatabase extends Dexie {
  usageEvents!: Dexie.Table<UsageEvent, number>;

  constructor() {
    super('AICostDB');
    this.version(1).stores({
      usageEvents: '++id, timestamp, provider, model',
    });
  }
}

let db: AICostDatabase | null = null;

function getDb(): AICostDatabase {
  if (!db) {
    db = new AICostDatabase();
  }
  return db;
}

/**
 * トークン使用量を記録する（fire-and-forget・失敗しても例外を投げない）。
 * usage が無い / トークン0 の呼び出しは記録しない。
 */
export async function recordUsage(params: {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}): Promise<void> {
  try {
    const promptTokens = params.promptTokens ?? 0;
    const completionTokens = params.completionTokens ?? 0;
    const totalTokens = params.totalTokens ?? promptTokens + completionTokens;
    if (totalTokens <= 0) return;

    await getDb().usageEvents.add({
      provider: params.provider,
      model: params.model,
      promptTokens,
      completionTokens,
      totalTokens,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('AI利用コストの記録に失敗:', error);
  }
}

/** 'YYYY-MM' 形式の月キー（省略時は現在月） */
export function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 指定月（'YYYY-MM'）のプロバイダー・モデル別サマリーを返す。
 */
export async function getMonthlySummary(monthKey: string): Promise<UsageSummary> {
  try {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month + 1, 1).getTime();

    const events = await getDb().usageEvents
      .where('timestamp')
      .between(start, end, true, false)
      .toArray();

    return summarizeEvents(events);
  } catch (error) {
    console.warn('AI利用コストの集計に失敗:', error);
    return { rows: [], totalCalls: 0, totalTokens: 0, totalCost: 0 };
  }
}

/** 記録済みのすべての月キーを新しい順で返す */
export async function getAvailableMonths(): Promise<string[]> {
  try {
    const events = await getDb().usageEvents.toArray();
    const months = new Set(events.map(e => currentMonthKey(new Date(e.timestamp))));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

/** すべての利用記録を削除する */
export async function clearUsage(): Promise<void> {
  await getDb().usageEvents.clear();
}

/**
 * イベント配列をプロバイダー・モデル別に集計する（純粋な集計ロジック）。
 * テスト容易性のため export する。
 */
export function summarizeEvents(events: UsageEvent[]): UsageSummary {
  const map = new Map<string, UsageSummaryRow>();

  for (const event of events) {
    const key = `${event.provider}:${event.model}`;
    const existing = map.get(key) ?? {
      provider: event.provider,
      model: event.model,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };
    existing.calls += 1;
    existing.promptTokens += event.promptTokens;
    existing.completionTokens += event.completionTokens;
    existing.totalTokens += event.totalTokens;
    existing.cost += estimateCost(event.provider, event.model, event.promptTokens, event.completionTokens);
    map.set(key, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  return {
    rows,
    totalCalls: rows.reduce((s, r) => s + r.calls, 0),
    totalTokens: rows.reduce((s, r) => s + r.totalTokens, 0),
    totalCost: rows.reduce((s, r) => s + r.cost, 0),
  };
}
