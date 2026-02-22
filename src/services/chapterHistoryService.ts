/**
 * 章立て履歴サービス（セッションベース）
 *
 * アプリ起動中のみメモリ内に章立ての変更履歴を保持するシングルトンサービス。
 * コンポーネントのライフサイクルに依存せず、ステップ間の移動でも履歴が保持される。
 * アプリの再起動・リロードで自動的にクリアされるため、データの肥大化リスクがない。
 */

import { ChapterHistory } from '../components/steps/chapter/types';

/** 履歴の変更ソース種別 */
export type ChapterHistorySource = 'manual' | 'ai-generate' | 'ai-enhance' | 'restore';

/** ソース種別の日本語ラベル */
export const CHAPTER_HISTORY_SOURCE_LABELS: Record<ChapterHistorySource, string> = {
  'manual': '手動編集',
  'ai-generate': 'AI生成',
  'ai-enhance': 'AI強化',
  'restore': '復元',
};

/** 章ごとの最大履歴保持数 */
const MAX_SNAPSHOTS_PER_CHAPTER = 50;

/**
 * プロジェクトID → 章ID → 履歴配列のマップ
 * モジュールスコープの変数なので、コンポーネントのアンマウントに影響されない。
 */
const historyStore: Map<string, Map<string, ChapterHistory[]>> = new Map();

/**
 * 章の現在の状態をスナップショットとして保存する
 *
 * @param projectId - プロジェクトID
 * @param chapter - 保存する章のデータ
 * @param source - 変更のソース種別
 */
export function saveChapterSnapshot(
  projectId: string,
  chapter: {
    id: string;
    title: string;
    summary: string;
    characters?: string[];
    setting?: string;
    mood?: string;
    keyEvents?: string[];
  },
  source: ChapterHistorySource = 'manual'
): void {
  if (!projectId || !chapter.id) return;

  // プロジェクトのマップを取得または作成
  let projectMap = historyStore.get(projectId);
  if (!projectMap) {
    projectMap = new Map();
    historyStore.set(projectId, projectMap);
  }

  // 章の履歴配列を取得または作成
  let chapterHistories = projectMap.get(chapter.id);
  if (!chapterHistories) {
    chapterHistories = [];
    projectMap.set(chapter.id, chapterHistories);
  }

  // 新しいスナップショットを作成
  const snapshot: ChapterHistory = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    chapterId: chapter.id,
    timestamp: new Date(),
    source,
    data: {
      title: chapter.title,
      summary: chapter.summary,
      characters: chapter.characters || [],
      setting: chapter.setting || '',
      mood: chapter.mood || '',
      keyEvents: chapter.keyEvents || [],
    },
  };

  // 先頭に追加（新しいものが先頭）
  chapterHistories.unshift(snapshot);

  // 最大件数を超えた場合、古いものを削除
  if (chapterHistories.length > MAX_SNAPSHOTS_PER_CHAPTER) {
    chapterHistories.splice(MAX_SNAPSHOTS_PER_CHAPTER);
  }
}

/**
 * 特定の章のスナップショット一覧を取得する
 *
 * @param projectId - プロジェクトID
 * @param chapterId - 章ID
 * @returns 履歴の配列（新しいものが先頭）
 */
export function getChapterSnapshots(
  projectId: string,
  chapterId: string
): ChapterHistory[] {
  const projectMap = historyStore.get(projectId);
  if (!projectMap) return [];

  return projectMap.get(chapterId) || [];
}

/**
 * プロジェクト全体のスナップショットを取得する
 *
 * @param projectId - プロジェクトID
 * @returns 章IDをキーとした履歴マップ
 */
export function getAllProjectSnapshots(
  projectId: string
): { [chapterId: string]: ChapterHistory[] } {
  const projectMap = historyStore.get(projectId);
  if (!projectMap) return {};

  const result: { [chapterId: string]: ChapterHistory[] } = {};
  projectMap.forEach((histories, chapterId) => {
    result[chapterId] = [...histories];
  });
  return result;
}

/**
 * 全履歴をクリアする
 */
export function clearAllSnapshots(): void {
  historyStore.clear();
}

/**
 * 特定プロジェクトの履歴をクリアする
 *
 * @param projectId - プロジェクトID
 */
export function clearProjectSnapshots(projectId: string): void {
  historyStore.delete(projectId);
}

/**
 * 特定の章の履歴をクリアする
 *
 * @param projectId - プロジェクトID
 * @param chapterId - 章ID
 */
export function clearChapterSnapshots(projectId: string, chapterId: string): void {
  const projectMap = historyStore.get(projectId);
  if (projectMap) {
    projectMap.delete(chapterId);
  }
}
