/**
 * スナップショット差分ユーティリティ
 *
 * 2つのプロジェクト（バックアップ時点と現在）を比較し、
 * どのセクションがどう変わったかを人間が読める要約にする。
 * 復元前に「何が失われるか / 何が増えたか」を確認するために使う。
 */

import { Project, Chapter, Character } from '../contexts/ProjectContext';

export type ChangeKind = 'added' | 'removed' | 'modified' | 'unchanged';

export interface SectionDiff {
  /** セクション名（例: 「あらすじ」「第1章の草案」） */
  label: string;
  kind: ChangeKind;
  /** 補足（例: 「1,200文字 → 1,450文字」「3件追加」） */
  detail?: string;
}

export interface SnapshotDiffResult {
  /** 変更のあったセクションのみ */
  changes: SectionDiff[];
  /** 変更総数 */
  changedCount: number;
}

/** 文字数の増減を「A文字 → B文字（+N）」形式で表す */
function lengthDetail(before: string, after: string): string {
  const b = before.length;
  const a = after.length;
  const delta = a - b;
  const sign = delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString();
  return `${b.toLocaleString()}文字 → ${a.toLocaleString()}文字（${sign}）`;
}

/** 文字列フィールドを比較して SectionDiff を返す（変化なしなら null） */
function diffText(label: string, before: string | undefined, after: string | undefined): SectionDiff | null {
  const b = before ?? '';
  const a = after ?? '';
  if (b === a) return null;
  if (!b && a) return { label, kind: 'added', detail: `${a.length.toLocaleString()}文字を追加` };
  if (b && !a) return { label, kind: 'removed', detail: `${b.length.toLocaleString()}文字を削除` };
  return { label, kind: 'modified', detail: lengthDetail(b, a) };
}

/** ID付き配列の追加・削除・変更件数を数える */
function diffCollection<T extends { id: string }>(
  label: string,
  before: T[] | undefined,
  after: T[] | undefined,
  isEqual: (x: T, y: T) => boolean
): SectionDiff | null {
  const beforeList = before ?? [];
  const afterList = after ?? [];
  const beforeMap = new Map(beforeList.map(item => [item.id, item]));
  const afterMap = new Map(afterList.map(item => [item.id, item]));

  let added = 0;
  let removed = 0;
  let modified = 0;

  afterMap.forEach((item, id) => {
    const prev = beforeMap.get(id);
    if (!prev) added++;
    else if (!isEqual(prev, item)) modified++;
  });
  beforeMap.forEach((_item, id) => {
    if (!afterMap.has(id)) removed++;
  });

  if (added === 0 && removed === 0 && modified === 0) return null;

  const parts: string[] = [];
  if (added > 0) parts.push(`${added}件追加`);
  if (removed > 0) parts.push(`${removed}件削除`);
  if (modified > 0) parts.push(`${modified}件変更`);

  const kind: ChangeKind =
    added > 0 && removed === 0 && modified === 0
      ? 'added'
      : removed > 0 && added === 0 && modified === 0
        ? 'removed'
        : 'modified';

  return { label, kind, detail: parts.join('・') };
}

function charactersEqual(a: Character, b: Character): boolean {
  return (
    a.name === b.name &&
    a.role === b.role &&
    a.appearance === b.appearance &&
    a.personality === b.personality &&
    a.background === b.background &&
    a.speechStyle === b.speechStyle
  );
}

/** プロットオブジェクトの変更フィールド数を数える */
function diffPlot(before: Project['plot'] | undefined, after: Project['plot'] | undefined): SectionDiff | null {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  let changed = 0;
  keys.forEach(key => {
    if (JSON.stringify(b[key] ?? '') !== JSON.stringify(a[key] ?? '')) changed++;
  });
  if (changed === 0) return null;
  return { label: 'プロット', kind: 'modified', detail: `${changed}項目を変更` };
}

/**
 * 2つのプロジェクトを比較して差分要約を返す。
 * @param before バックアップ時点のプロジェクト
 * @param after 現在のプロジェクト
 */
export function diffSnapshots(before: Project, after: Project): SnapshotDiffResult {
  const changes: SectionDiff[] = [];

  // 基本情報
  const titleDiff = diffText('タイトル', before.title, after.title);
  if (titleDiff) changes.push(titleDiff);
  const descDiff = diffText('作品説明', before.description, after.description);
  if (descDiff) changes.push(descDiff);

  // プロット
  const plotDiff = diffPlot(before.plot, after.plot);
  if (plotDiff) changes.push(plotDiff);

  // あらすじ
  const synopsisDiff = diffText('あらすじ', before.synopsis, after.synopsis);
  if (synopsisDiff) changes.push(synopsisDiff);

  // キャラクター
  const charDiff = diffCollection('キャラクター', before.characters, after.characters, charactersEqual);
  if (charDiff) changes.push(charDiff);

  // 章立て（メタ情報の変更件数）
  const chapterMetaDiff = diffCollection(
    '章立て',
    before.chapters,
    after.chapters,
    (x: Chapter, y: Chapter) => x.title === y.title && x.summary === y.summary
  );
  if (chapterMetaDiff) changes.push(chapterMetaDiff);

  // 各章の草案（本文）は個別に文字数差分を出す（最重要）
  const beforeChapters = new Map((before.chapters ?? []).map(c => [c.id, c]));
  (after.chapters ?? []).forEach((chapter, index) => {
    const prev = beforeChapters.get(chapter.id);
    const draftDiff = diffText(
      `第${index + 1}章「${chapter.title || '無題'}」の草案`,
      prev?.draft,
      chapter.draft
    );
    if (draftDiff) changes.push(draftDiff);
  });

  // 各種ツール系コレクション
  const glossaryDiff = diffCollection(
    '用語集',
    before.glossary,
    after.glossary,
    (x, y) => x.term === y.term && x.definition === y.definition
  );
  if (glossaryDiff) changes.push(glossaryDiff);

  const timelineDiff = diffCollection(
    'タイムライン',
    before.timeline,
    after.timeline,
    (x, y) => x.title === y.title && x.description === y.description
  );
  if (timelineDiff) changes.push(timelineDiff);

  const worldDiff = diffCollection(
    '世界観設定',
    before.worldSettings,
    after.worldSettings,
    (x, y) => x.title === y.title && x.content === y.content
  );
  if (worldDiff) changes.push(worldDiff);

  const foreshadowingDiff = diffCollection(
    '伏線',
    before.foreshadowings,
    after.foreshadowings,
    (x, y) => x.title === y.title && x.status === y.status && x.description === y.description
  );
  if (foreshadowingDiff) changes.push(foreshadowingDiff);

  return { changes, changedCount: changes.length };
}
