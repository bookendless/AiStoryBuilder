import type { Project } from '../../types/project';
import type { NarrativeDelta, NarrativeField, NarrativeItem, NarrativeMemory, NarrativeProposal, NarrativeRequirement, NarrativeSource, NarrativeState, NarrativeValue } from '../../types/narrative';
import { fnv1a64 } from '../rag/hash';
import { normalizeMapped } from './source';

export const FIELDS: NarrativeField[] = ['location', 'goal', 'relationships', 'knowledge', 'possessions', 'condition'];
export const FIELD_LABELS: Record<NarrativeField, string> = { location: '現在地', goal: '目標', relationships: '関係', knowledge: '認識', possessions: '所持品', condition: '身体・感情' };
export const emptyDelta = (): NarrativeDelta => ({ characterChanges: [], addEvents: [], addRequirements: [], transitionRequirements: [] });
export const emptyMemory = (): NarrativeMemory => ({ schemaVersion: 1, enabled: false, revision: 0, records: [], proposals: [], jobs: [] });
export const itemsOf = (d: NarrativeDelta): NarrativeItem[] => [...d.characterChanges, ...d.addEvents, ...d.addRequirements, ...d.transitionRequirements];
export const draftHash = (text: string): string => 'lf1:' + fnv1a64(text.replace(/\r\n?/g, '\n'));
const hash = (value: unknown) => fnv1a64(JSON.stringify(value));
export const settingsHash = (p: Project) => hash([p.characters, p.relationships ?? [], p.worldSettings ?? [], p.glossary ?? [], p.timeline ?? []]);
export const emptyState = (): NarrativeState => ({ characters: {}, events: [], requirements: [] });

export function applyDelta(state: NarrativeState, delta: NarrativeDelta): NarrativeState {
  const result = structuredClone(state);
  for (const change of delta.characterChanges) {
    const character = Object.prototype.hasOwnProperty.call(result.characters, change.characterId) ? result.characters[change.characterId] : {};
    if (change.operation === 'clear') delete character[change.field];
    else {
      const old = character[change.field] ?? [];
      character[change.field] = change.values.map(v => old.find(o => o.text === v.text && o.knowledge === v.knowledge && o.relatedCharacterId === v.relatedCharacterId) ?? v);
    }
    // defineProperty handles imported identifiers such as __proto__ without prototype mutation.
    Object.defineProperty(result.characters, change.characterId, { value: character, enumerable: true, configurable: true, writable: true });
  }
  for (const event of delta.addEvents) {
    if (result.events.some(e => e.id === event.id)) throw new Error('出来事IDが重複しています');
    result.events.push(structuredClone(event));
  }
  for (const requirement of delta.addRequirements) {
    if (result.requirements.some(r => r.id === requirement.id)) throw new Error('約束IDが重複しています');
    result.requirements.push(structuredClone(requirement));
  }
  for (const change of delta.transitionRequirements) {
    const target = result.requirements.find(r => r.id === change.requirementId);
    if (!target) throw new Error('変更対象の約束がありません');
    target.status = change.status;
    target.resolution = change.source;
  }
  return result;
}

export function verifySource(source: NarrativeSource, project: Project): boolean {
  const chapter = project.chapters.find(c => c.id === source.chapterId);
  if (!chapter || source.draftHash !== draftHash(chapter.draft ?? '')) return false;
  if (source.kind === 'author') return !!source.reason?.trim();
  return !source.alternatives?.length && normalizeMapped(source.quote).text.length > 0 && normalizeMapped(source.quote).text.length <= 200 && Number.isInteger(source.start) && Number.isInteger(source.end) && source.start >= 0 && source.end > source.start && (chapter.draft ?? '').slice(source.start, source.end) === source.quote;
}

export function validateDelta(delta: NarrativeDelta, project: Project, state: NarrativeState, chapterId: string): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of itemsOf(delta)) {
    if (ids.has(item.id)) errors.push('項目IDが重複しています');
    ids.add(item.id);
    if (item.source.chapterId !== chapterId || !verifySource(item.source, project)) errors.push('出典が未確定、または本文が変わっています');
  }
  const characterExists = (id: string) => project.characters.some(c => c.id === id);
  for (const change of delta.characterChanges) {
    if (!characterExists(change.characterId)) errors.push('人物への紐付けが必要です');
    if (!FIELDS.includes(change.field)) errors.push('不正な人物フィールドです');
    if (change.operation === 'set' && !change.values.length) errors.push('設定する値がありません');
    if (change.operation === 'clear' && change.values.length) errors.push('クリアする項目には値を指定しないでください');
    if (['location', 'goal'].includes(change.field) && change.values.length > 1) errors.push('現在地と目標は1つずつ指定してください');
    for (const value of change.values) {
      if (!value.text.trim() || !verifySource(value.source, project)) errors.push('値または出典が無効です');
      if (value.relatedCharacterId && !characterExists(value.relatedCharacterId)) errors.push('相手の人物がありません');
      if (change.field === 'knowledge' && !value.knowledge) errors.push('認識の種別が必要です');
    }
  }
  for (const item of [...delta.addEvents, ...delta.addRequirements]) {
    if (!item.description.trim() || item.characterIds.some(id => !characterExists(id))) errors.push('出来事/約束の内容または人物が無効です');
  }
  for (const r of delta.addRequirements) {
    if (r.status !== 'open') errors.push('追加する約束は未解決から始めてください');
    if (r.plannedChapterId && !project.chapters.some(c => c.id === r.plannedChapterId)) errors.push('回収予定の章がありません');
  }
  for (const change of delta.transitionRequirements) {
    if (['deferred', 'dropped'].includes(change.status) && !change.reason?.trim()) errors.push('持ち越し/取り下げには理由が必要です');
  }
  try { applyDelta(state, delta); } catch (e) { errors.push(String(e)); }
  return [...new Set(errors)];
}

export interface StateResult { state: NarrativeState; fingerprint: string; blockedChapterId?: string; reason?: string }
export function deriveNarrativeState(project: Project, beforeChapterId?: string): StateResult {
  let state = emptyState();
  let fingerprint = settingsHash(project);
  const end = beforeChapterId ? project.chapters.findIndex(c => c.id === beforeChapterId) : project.chapters.length;
  if (end < 0) return { state, fingerprint, reason: '章がありません', blockedChapterId: beforeChapterId };
  for (const chapter of project.chapters.slice(0, end)) {
    const records = project.narrativeMemory?.records.filter(r => r.chapterId === chapter.id) ?? [];
    const record = records[records.length - 1];
    if (!chapter.draft?.trim() || !record || record.draftHash !== draftHash(chapter.draft) || record.basis !== fingerprint || validateDelta(record.delta, project, state, chapter.id).length) {
      return { state, fingerprint, blockedChapterId: chapter.id, reason: `「${chapter.title}」の物語状態を確認してください` };
    }
    state = applyDelta(state, record.delta);
    fingerprint = hash([fingerprint, chapter.id, record.draftHash, record.revision, record.delta]);
  }
  return { state, fingerprint };
}

export function proposalDependency(p: Project, chapterId: string): string {
  const chapter = p.chapters.find(c => c.id === chapterId);
  return hash([deriveNarrativeState(p, chapterId).fingerprint, p.plot, p.styleSample, p.writingStyle, p.chapters.map(c => [c.id, c.title, c.summary]), chapter ? { ...chapter, draft: undefined } : null]);
}
export function proposalIsCurrent(project: Project, proposal: NarrativeProposal): boolean {
  const result = deriveNarrativeState(project, proposal.chapterId);
  const chapter = project.chapters.find(c => c.id === proposal.chapterId);
  return project.id === proposal.projectId && !!chapter && !result.reason && result.fingerprint === proposal.basis && draftHash(chapter.draft ?? '') === proposal.draftHash && proposalDependency(project, proposal.chapterId) === proposal.dependency;
}

export function selectedDelta(p: NarrativeProposal): NarrativeDelta {
  const accepted = (item: NarrativeItem) => p.decisions[item.id] === 'accept';
  return { characterChanges: p.delta.characterChanges.filter(accepted), addEvents: p.delta.addEvents.filter(accepted), addRequirements: p.delta.addRequirements.filter(accepted), transitionRequirements: p.delta.transitionRequirements.filter(accepted) };
}
export function applyNarrativeProposal(project: Project, proposalId: string): Partial<Project> {
  const memory = project.narrativeMemory;
  if (!memory?.enabled) throw new Error('物語状態管理が無効です');
  const p = memory.proposals.find(p => p.id === proposalId);
  if (!p || !proposalIsCurrent(project, p)) throw new Error('本文または前提が変わりました。再解析してください');
  if (memory.records.some(r => r.proposalId === proposalId)) return {}; // save retry only
  if (itemsOf(p.delta).some(i => !['accept', 'reject'].includes(p.decisions[i.id]))) throw new Error('未判断の項目があります');
  const delta = selectedDelta(p);
  const errors = validateDelta(delta, project, deriveNarrativeState(project, p.chapterId).state, p.chapterId);
  if (errors.length) throw new Error(errors.join('。'));
  const revision = memory.revision + 1;
  return { narrativeMemory: { ...memory, revision, records: [...memory.records, { chapterId: p.chapterId, revision, proposalId, draftHash: p.draftHash, basis: p.basis, delta, acceptedAt: new Date().toISOString() }] } };
}

/** Copy only accepted, relevant history. Proposals and running jobs never cross project boundaries. */
export function copyNarrativeMemory(project: Project, chapterIds = project.chapters.map(c => c.id)): NarrativeMemory | undefined {
  const m = project.narrativeMemory;
  return m ? structuredClone({ ...m, records: m.records.filter(r => chapterIds.includes(r.chapterId)), proposals: [], jobs: [] }) : undefined;
}

export const STATUS_LABELS: Record<NarrativeRequirement['status'], string> = { open: '未解決', resolved: '解決', deferred: '持ち越し', dropped: '取り下げ' };
export const KNOWLEDGE_LABELS: Record<NonNullable<NarrativeValue['knowledge']>, string> = { known: '知っている', believed: '信じている', explicitlyUnknown: '知らないと明記' };
/** Generation-task key shared by the review modal and the draft sidebar. */
export const narrativeExtractKey = (projectId: string | undefined) => `${projectId ?? 'none'}:narrative:extract`;

export type ChapterNarrativeStatus = 'confirmed' | 'pending' | 'stale' | 'unanalyzed';
export type NarrativeStatusSummary =
  | { kind: 'off' }
  | { kind: 'running'; chapterId: string; finished: number; total: number }
  | { kind: 'blocked'; chapterId: string; hasDraft: boolean }
  | { kind: 'ready'; characters: number; openRequirements: number; events: number; chapter: ChapterNarrativeStatus };

/** Sidebar summary for the chapter being written. Uses deriveNarrativeState so staleness matches generation. */
export function summarizeNarrativeStatus(project: Project, chapterId: string, running: boolean): NarrativeStatusSummary {
  const memory = project.narrativeMemory;
  if (!memory?.enabled) return { kind: 'off' };
  if (running) {
    const job = [...memory.jobs].reverse().find(j => j.status === 'running');
    // 最初のチェックポイント保存前は進捗が未記録。total 0 で「準備中」として扱う
    return job ? { kind: 'running', chapterId: job.chapterId, finished: job.finished, total: job.chunks.length } : { kind: 'running', chapterId, finished: 0, total: 0 };
  }
  const before = deriveNarrativeState(project, chapterId);
  if (before.blockedChapterId) {
    const blocked = project.chapters.find(c => c.id === before.blockedChapterId);
    return { kind: 'blocked', chapterId: before.blockedChapterId, hasDraft: !!blocked?.draft?.trim() };
  }
  const index = project.chapters.findIndex(c => c.id === chapterId);
  const through = deriveNarrativeState(project, project.chapters[index + 1]?.id);
  let chapter: ChapterNarrativeStatus = 'confirmed';
  if (through.blockedChapterId === chapterId) {
    const proposal = memory.proposals.filter(p => p.chapterId === chapterId && !memory.records.some(r => r.proposalId === p.id)).pop();
    // 確定記録はあるが本文・設定・前章が変わって失効した章も「再解析が必要」として扱う
    if (proposal) chapter = proposalIsCurrent(project, proposal) ? 'pending' : 'stale';
    else chapter = memory.records.some(r => r.chapterId === chapterId) ? 'stale' : 'unanalyzed';
  }
  const { state } = before;
  return {
    kind: 'ready',
    characters: Object.keys(state.characters).length,
    openRequirements: state.requirements.filter(r => r.status === 'open' || r.status === 'deferred').length,
    events: state.events.length,
    chapter,
  };
}
