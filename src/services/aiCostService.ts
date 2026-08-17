/**
 * AI利用コスト記録サービス
 *
 * AI生成のたびにトークン使用量を記録し、プロバイダー・モデル別／月別に
 * 概算コストを集計する。本体スキーマのマイグレーションを避けるため専用DBを用いる。
 */

import Dexie from 'dexie';
import { estimateCost } from '../utils/aiPricingUtils';
import { AIUsagePurpose } from '../types/ai';
import {
  AI_USAGE_PURPOSE_LABELS,
  UNCLASSIFIED_PURPOSE,
  TalliedPurpose,
} from '../constants/aiLogTypes';

export interface UsageEvent {
  id?: number;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  /** 按分の集計単位。未指定の呼び出しは「未分類」に入る */
  projectId?: string;
  /**
   * 工程。**AIRequest.type ではなく purpose を保存する**。
   * type は「プロンプト種別」で、AI校正も type='draft' のため、
   * type で工程別コストを出すと校正の費用が本文生成に混ざる。
   */
  purpose?: AIUsagePurpose;
  chapterId?: string;
}

/** 作品別・工程別の集計行 */
export interface UsageBreakdownRow {
  /** 集計キー（projectId または工程キー）。未指定分は UNCLASSIFIED_PURPOSE / '' */
  key: string;
  label: string;
  calls: number;
  totalTokens: number;
  cost: number;
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
    // v2: 作品別・工程別の按分用にインデックスを追加。
    // 既存行は projectId / purpose が undefined のまま残り、「未分類」として集計される
    this.version(2).stores({
      usageEvents: '++id, timestamp, provider, model, projectId, purpose',
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
  projectId?: string;
  purpose?: AIUsagePurpose;
  chapterId?: string;
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
      projectId: params.projectId,
      purpose: params.purpose,
      chapterId: params.chapterId,
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

/** 指定月のイベントをそのまま返す（作品別・工程別を1回の読み込みで出すため） */
export async function getMonthlyEvents(monthKey: string): Promise<UsageEvent[]> {
  try {
    const [yearStr, monthStr] = monthKey.split('-');
    const start = new Date(Number(yearStr), Number(monthStr) - 1, 1).getTime();
    const end = new Date(Number(yearStr), Number(monthStr), 1).getTime();
    return await getDb().usageEvents
      .where('timestamp')
      .between(start, end, true, false)
      .toArray();
  } catch (error) {
    console.warn('AI利用コストの読み込みに失敗:', error);
    return [];
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

/** キー抽出関数で任意の軸に集計する共通処理 */
function breakdownBy(
  events: UsageEvent[],
  keyOf: (event: UsageEvent) => string,
  labelOf: (key: string) => string
): UsageBreakdownRow[] {
  const map = new Map<string, UsageBreakdownRow>();

  for (const event of events) {
    const key = keyOf(event);
    const existing = map.get(key) ?? { key, label: labelOf(key), calls: 0, totalTokens: 0, cost: 0 };
    existing.calls += 1;
    existing.totalTokens += event.totalTokens;
    existing.cost += estimateCost(event.provider, event.model, event.promptTokens, event.completionTokens);
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

/** 作品IDから表示名を引くための対応表（未知のIDは「削除済みの作品」扱い） */
export const UNASSIGNED_PROJECT_KEY = '';

/**
 * 作品別の内訳。
 * projectId を持たない記録（この機能より前のもの・作品IDを渡していない経路）は
 * 「未分類」にまとめる。0件として消すと、合計と内訳の和が合わなくなる。
 */
export function summarizeByProject(
  events: UsageEvent[],
  projectTitles: Map<string, string>
): UsageBreakdownRow[] {
  return breakdownBy(
    events,
    event => event.projectId ?? UNASSIGNED_PROJECT_KEY,
    key => {
      if (key === UNASSIGNED_PROJECT_KEY) return '未分類';
      return projectTitles.get(key) ?? '削除済みの作品';
    }
  );
}

/** 工程別の内訳。purpose 未指定は「未分類」にまとめる */
export function summarizeByPurpose(events: UsageEvent[]): UsageBreakdownRow[] {
  return breakdownBy(
    events,
    event => event.purpose ?? UNCLASSIFIED_PURPOSE,
    key => AI_USAGE_PURPOSE_LABELS[key as TalliedPurpose] ?? key
  );
}
