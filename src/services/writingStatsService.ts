/**
 * 執筆統計サービス
 *
 * 日次の総文字数サンプルと執筆目標を IndexedDB（Dexie）に永続化する。
 * 本体スキーマ（StoryBuilderDB）のマイグレーションを避けるため、
 * autoBackupService と同様に専用DBを用いる。
 */

import Dexie from 'dexie';
import { Project } from '../contexts/ProjectContext';
import {
  DailySample,
  toDateKey,
  computeTotalDraftChars,
} from '../utils/writingStatsUtils';

export interface WritingGoal {
  projectId: string;
  /** 1日あたりの目標文字数（0 で未設定） */
  dailyGoal: number;
  /** 目標章数（0/未設定で無効） */
  targetChapters: number;
}

interface StoredDailyStat {
  /** `${projectId}:${date}` */
  key: string;
  projectId: string;
  date: string;
  totalChars: number;
  updatedAt: number;
}

class WritingStatsDatabase extends Dexie {
  dailyStats!: Dexie.Table<StoredDailyStat, string>;
  goals!: Dexie.Table<WritingGoal, string>;

  constructor() {
    super('WritingStatsDB');
    this.version(1).stores({
      dailyStats: 'key, projectId, date',
      goals: 'projectId',
    });
  }
}

let db: WritingStatsDatabase | null = null;

function getDb(): WritingStatsDatabase {
  if (!db) {
    db = new WritingStatsDatabase();
  }
  return db;
}

/**
 * 現在のプロジェクト状態から「今日」の総文字数サンプルを記録する。
 * 同じ日に複数回呼ばれた場合は最新の値で上書きする（最終時点を採用）。
 * 保存処理から fire-and-forget で呼ぶ想定のため、失敗しても例外を投げない。
 */
export async function recordDailySnapshot(project: Project): Promise<void> {
  try {
    const totalChars = computeTotalDraftChars(project.chapters, project.draft);
    const date = toDateKey(new Date());
    const key = `${project.id}:${date}`;

    await getDb().dailyStats.put({
      key,
      projectId: project.id,
      date,
      totalChars,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn('執筆統計の記録に失敗:', error);
  }
}

/**
 * プロジェクトの日次サンプルを取得する（日付昇順）。
 */
export async function getDailySamples(projectId: string): Promise<DailySample[]> {
  try {
    const rows = await getDb().dailyStats
      .where('projectId')
      .equals(projectId)
      .toArray();
    return rows
      .map(r => ({ date: r.date, totalChars: r.totalChars }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.warn('執筆統計の取得に失敗:', error);
    return [];
  }
}

/** プロジェクトの執筆目標を取得する（未設定時は0） */
export async function getWritingGoal(projectId: string): Promise<WritingGoal> {
  try {
    const goal = await getDb().goals.get(projectId);
    if (goal) return goal;
  } catch (error) {
    console.warn('執筆目標の取得に失敗:', error);
  }
  return { projectId, dailyGoal: 0, targetChapters: 0 };
}

/** プロジェクトの執筆目標を保存する */
export async function saveWritingGoal(goal: WritingGoal): Promise<void> {
  await getDb().goals.put(goal);
}
