/**
 * プロジェクト横断一括置換ユーティリティ
 *
 * キャラクター名の改名や表記ゆれの統一を、草案・あらすじ・章立て・
 * 用語集などプロジェクト全体に対して一括で適用する。
 * 検索は完全一致（大文字小文字を区別）で行う。
 */

import { Project, Chapter } from '../contexts/ProjectContext';

export type ReplaceScope =
  | 'basic'
  | 'characters'
  | 'plot'
  | 'synopsis'
  | 'chapters'
  | 'drafts'
  | 'glossary'
  | 'timeline'
  | 'world'
  | 'foreshadowings';

export interface ReplaceScopeInfo {
  scope: ReplaceScope;
  label: string;
  count: number;
}

export interface ReplacePreview {
  total: number;
  scopes: ReplaceScopeInfo[];
}

export const REPLACE_SCOPE_LABELS: Record<ReplaceScope, string> = {
  basic: '基本情報（タイトル・説明・テーマ）',
  characters: 'キャラクター',
  plot: 'プロット',
  synopsis: 'あらすじ',
  chapters: '章立て（タイトル・要約・設定）',
  drafts: '草案（本文）',
  glossary: '用語集',
  timeline: 'タイムライン',
  world: '世界観設定',
  foreshadowings: '伏線',
};

/** 出現回数をカウント（完全一致） */
export function countOccurrences(text: string | undefined | null, query: string): number {
  if (!text || !query) return 0;
  return text.split(query).length - 1;
}

/** プロット内の全文字列フィールドキー */
const PLOT_TEXT_KEYS = [
  'theme', 'setting', 'hook', 'protagonistGoal', 'mainObstacle', 'ending',
  'ki', 'sho', 'ten', 'ketsu',
  'act1', 'act2', 'act3',
  'fourAct1', 'fourAct2', 'fourAct3', 'fourAct4',
  'hj1', 'hj2', 'hj3', 'hj4', 'hj5', 'hj6', 'hj7', 'hj8',
  'bs1', 'bs2', 'bs3', 'bs4', 'bs5', 'bs6', 'bs7',
  'ms1', 'ms2', 'ms3', 'ms4', 'ms5', 'ms6', 'ms7',
] as const;

/** スコープごとの出現回数を数え上げてプレビューを作る */
export function buildReplacePreview(project: Project | null, query: string): ReplacePreview {
  if (!project || !query) {
    return { total: 0, scopes: [] };
  }

  const counts: Record<ReplaceScope, number> = {
    basic: 0,
    characters: 0,
    plot: 0,
    synopsis: 0,
    chapters: 0,
    drafts: 0,
    glossary: 0,
    timeline: 0,
    world: 0,
    foreshadowings: 0,
  };

  counts.basic =
    countOccurrences(project.title, query) +
    countOccurrences(project.description, query) +
    countOccurrences(project.theme, query);

  project.characters?.forEach(char => {
    counts.characters +=
      countOccurrences(char.name, query) +
      countOccurrences(char.role, query) +
      countOccurrences(char.appearance, query) +
      countOccurrences(char.personality, query) +
      countOccurrences(char.background, query) +
      countOccurrences(char.speechStyle, query);
  });

  if (project.plot) {
    PLOT_TEXT_KEYS.forEach(key => {
      counts.plot += countOccurrences(project.plot[key], query);
    });
  }

  counts.synopsis = countOccurrences(project.synopsis, query);

  project.chapters?.forEach(chapter => {
    counts.chapters +=
      countOccurrences(chapter.title, query) +
      countOccurrences(chapter.summary, query) +
      countOccurrences(chapter.setting, query) +
      countOccurrences(chapter.mood, query) +
      (chapter.keyEvents?.reduce((sum, e) => sum + countOccurrences(e, query), 0) ?? 0);
    counts.drafts += countOccurrences(chapter.draft, query);
  });
  counts.drafts += countOccurrences(project.draft, query);

  project.glossary?.forEach(term => {
    counts.glossary +=
      countOccurrences(term.term, query) +
      countOccurrences(term.reading, query) +
      countOccurrences(term.definition, query) +
      countOccurrences(term.notes, query);
  });

  project.timeline?.forEach(event => {
    counts.timeline +=
      countOccurrences(event.title, query) +
      countOccurrences(event.description, query);
  });

  project.worldSettings?.forEach(setting => {
    counts.world +=
      countOccurrences(setting.title, query) +
      countOccurrences(setting.content, query);
  });

  project.foreshadowings?.forEach(foreshadowing => {
    counts.foreshadowings +=
      countOccurrences(foreshadowing.title, query) +
      countOccurrences(foreshadowing.description, query) +
      countOccurrences(foreshadowing.notes, query) +
      countOccurrences(foreshadowing.plannedPayoffDescription, query) +
      foreshadowing.points.reduce((sum, p) => sum + countOccurrences(p.description, query), 0);
  });

  const scopes = (Object.keys(counts) as ReplaceScope[])
    .map(scope => ({ scope, label: REPLACE_SCOPE_LABELS[scope], count: counts[scope] }))
    .filter(info => info.count > 0);

  return {
    total: scopes.reduce((sum, info) => sum + info.count, 0),
    scopes,
  };
}

/**
 * 指定スコープに一括置換を適用し、更新すべきフィールドのみの
 * Partial<Project> を返す（updateProject へそのまま渡せる）
 */
export function applyReplace(
  project: Project,
  query: string,
  replacement: string,
  scopes: Set<ReplaceScope>
): Partial<Project> {
  // 空クエリは split('') が全文字間に replacement を挿入し全フィールドを破壊するため早期リターン
  if (!query) return {};
  const rep = (text: string): string => text.split(query).join(replacement);
  const repOpt = <T extends string | undefined>(text: T): T =>
    (text ? rep(text) : text) as T;

  const updates: Partial<Project> = {};

  if (scopes.has('basic')) {
    if (countOccurrences(project.title, query)) updates.title = rep(project.title);
    if (countOccurrences(project.description, query)) updates.description = rep(project.description);
    if (countOccurrences(project.theme, query)) updates.theme = rep(project.theme);
  }

  if (scopes.has('characters') && project.characters?.length) {
    updates.characters = project.characters.map(char => ({
      ...char,
      name: rep(char.name),
      role: rep(char.role),
      appearance: rep(char.appearance),
      personality: rep(char.personality),
      background: rep(char.background),
      speechStyle: repOpt(char.speechStyle),
    }));
  }

  if (scopes.has('plot') && project.plot) {
    const plot = { ...project.plot };
    PLOT_TEXT_KEYS.forEach(key => {
      const value = plot[key];
      if (value) {
        (plot as Record<string, unknown>)[key] = rep(value);
      }
    });
    updates.plot = plot;
  }

  if (scopes.has('synopsis') && countOccurrences(project.synopsis, query)) {
    updates.synopsis = rep(project.synopsis);
  }

  // 章立てと草案は同じ chapters 配列を共有するためまとめて処理する
  if ((scopes.has('chapters') || scopes.has('drafts')) && project.chapters?.length) {
    updates.chapters = project.chapters.map((chapter): Chapter => {
      const next = { ...chapter };
      if (scopes.has('chapters')) {
        next.title = rep(chapter.title);
        next.summary = rep(chapter.summary);
        next.setting = repOpt(chapter.setting);
        next.mood = repOpt(chapter.mood);
        next.keyEvents = chapter.keyEvents?.map(rep);
      }
      if (scopes.has('drafts')) {
        next.draft = repOpt(chapter.draft);
      }
      return next;
    });
  }

  if (scopes.has('drafts') && countOccurrences(project.draft, query)) {
    updates.draft = rep(project.draft);
  }

  if (scopes.has('glossary') && project.glossary?.length) {
    updates.glossary = project.glossary.map(term => ({
      ...term,
      term: rep(term.term),
      reading: repOpt(term.reading),
      definition: rep(term.definition),
      notes: repOpt(term.notes),
    }));
  }

  if (scopes.has('timeline') && project.timeline?.length) {
    updates.timeline = project.timeline.map(event => ({
      ...event,
      title: rep(event.title),
      description: rep(event.description),
    }));
  }

  if (scopes.has('world') && project.worldSettings?.length) {
    updates.worldSettings = project.worldSettings.map(setting => ({
      ...setting,
      title: rep(setting.title),
      content: rep(setting.content),
    }));
  }

  if (scopes.has('foreshadowings') && project.foreshadowings?.length) {
    updates.foreshadowings = project.foreshadowings.map(foreshadowing => ({
      ...foreshadowing,
      title: rep(foreshadowing.title),
      description: rep(foreshadowing.description),
      notes: repOpt(foreshadowing.notes),
      plannedPayoffDescription: repOpt(foreshadowing.plannedPayoffDescription),
      points: foreshadowing.points.map(point => ({
        ...point,
        description: rep(point.description),
      })),
    }));
  }

  return updates;
}
