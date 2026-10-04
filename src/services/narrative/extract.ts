import type { Project } from '../../types/project';
import type { NarrativeDelta, NarrativeExtractionJob, NarrativeField, NarrativeProposal, NarrativeSource, NarrativeState } from '../../types/narrative';
import type { NarrativeRunner } from './runner';
import { applyDelta, deriveNarrativeState, draftHash, emptyDelta, itemsOf, proposalDependency } from './state';
import { findQuote, normalizeMapped } from './source';
import { buildNarrativeExtractionPrompt, NARRATIVE_PROMPT_VERSION } from '../prompts/narrative';
import { parseJsonLoose } from '../../utils/jsonExtract';
import { isDelta } from './codec';

type Wire = Record<string, unknown>;
const object = (v: unknown): Wire => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('JSONオブジェクトが必要です');
  return v as Wire;
};
const text = (v: unknown): string => { if (typeof v !== 'string') throw new Error('文字列が必要です'); return v; };
const optional = (v: unknown) => v === undefined ? undefined : text(v);
const strings = (v: unknown): string[] => { if (!Array.isArray(v)) throw new Error('配列が必要です'); return v.map(text); };
const keys = (v: Wire, allowed: string[]) => { if (Object.keys(v).some(k => !allowed.includes(k))) throw new Error('未知のJSONフィールドがあります'); };

export function parseNarrativeDelta(raw: string, project: Project, chapterId: string, state: NarrativeState, start: number, end: number): NarrativeDelta {
  const data = object(parseJsonLoose(raw));
  const delta = emptyDelta();
  keys(data, Object.keys(delta));
  const chapter = project.chapters.find(c => c.id === chapterId)!;
  const body = chapter.draft ?? '';
  const source = (w: Wire): NarrativeSource => {
    const matches = findQuote(body.slice(start, end), text(w.quote), start);
    if (!matches.length) throw new Error('本文に存在しない引用があります');
    return { kind: 'text', chapterId, draftHash: draftHash(body), ...matches[0], ...(matches.length > 1 ? { alternatives: matches.map(m => m.start) } : {}) };
  };
  const common = (w: Wire) => {
    if (!['fact', 'belief', 'flashback', 'uncertain'].includes(text(w.interpretation))) throw new Error('解釈の種別が不正です');
    const src = source(w);
    const warnings: string[] = [];
    if (w.interpretation !== 'fact') warnings.push('台詞・推測・回想の可能性があります。現在の事実として扱えるか確認してください');
    if (src.alternatives?.length) warnings.push('同じ引用が複数あります。出典の位置を選択してください');
    return { id: crypto.randomUUID(), source: src, warnings };
  };
  const list = (name: keyof NarrativeDelta): Wire[] => {
    if (!Array.isArray(data[name])) throw new Error('4つの配列が必要です');
    return (data[name] as unknown[]).map(object);
  };
  const baseKeys = ['quote', 'interpretation'];
  for (const w of list('characterChanges')) {
    keys(w, [...baseKeys, 'characterId', 'characterName', 'field', 'operation', 'values']);
    const base = common(w);
    const characterId = text(w.characterId);
    const field = text(w.field) as NarrativeField;
    if (!Array.isArray(w.values)) throw new Error('人物の値には配列が必要です');
    const values = w.values.map(v => {
      const val = object(v); keys(val, ['text', 'knowledge', 'relatedCharacterId']);
      return { id: crypto.randomUUID(), text: text(val.text), knowledge: optional(val.knowledge) as 'known' | 'believed' | 'explicitlyUnknown' | undefined, relatedCharacterId: optional(val.relatedCharacterId), source: base.source };
    });
    if (!project.characters.some(c => c.id === characterId)) base.warnings.push('人物への紐付けが必要です');
    if (w.operation === 'clear' || state.characters[characterId]?.[field]?.length) base.warnings.push('既存の状態が変更・削除されます。旧値と比較してください');
    delta.characterChanges.push({ ...base, characterId, characterName: optional(w.characterName), field, operation: text(w.operation) as 'set' | 'clear', values });
  }
  for (const w of list('addEvents')) {
    keys(w, [...baseKeys, 'description', 'characterIds', 'storyTime']);
    const event = { ...common(w), description: text(w.description), characterIds: strings(w.characterIds), storyTime: optional(w.storyTime) };
    if (!state.events.some(e => e.description === event.description && e.source.chapterId === chapterId && e.source.start === event.source.start)) delta.addEvents.push(event);
  }
  const added = new Map<string, string>();
  for (const w of list('addRequirements')) {
    keys(w, [...baseKeys, 'key', 'description', 'kind', 'characterIds', 'plannedChapterId']);
    const key = text(w.key); if (!key || added.has(key)) throw new Error('追加キーが空または重複しています');
    const requirement = { ...common(w), description: text(w.description), kind: text(w.kind) as 'clue', characterIds: strings(w.characterIds), plannedChapterId: optional(w.plannedChapterId), status: 'open' as const };
    const duplicate = state.requirements.find(r => r.description === requirement.description && r.source.chapterId === chapterId && r.source.start === requirement.source.start);
    added.set(key, duplicate?.id ?? requirement.id);
    if (!duplicate) delta.addRequirements.push(requirement);
  }
  for (const w of list('transitionRequirements')) {
    keys(w, [...baseKeys, 'requirementId', 'status']);
    const base = common(w); base.warnings.push('回収・再開の根拠を確認してください');
    const id = text(w.requirementId);
    delta.transitionRequirements.push({ ...base, requirementId: added.get(id) ?? id, status: text(w.status) as 'resolved' });
  }
  if (!isDelta(delta)) throw new Error('状態差分の形式が不正です');
  // References can be corrected in the review UI; unknown requirement transitions cannot be applied.
  applyDelta(state, delta);
  return delta;
}

/** Offsets stay in the original document; no trim or line-ending conversion loses evidence positions. */
export function narrativeChunks(body: string, size: number): Array<{ start: number; end: number }> {
  if (size < 500) throw new Error('状態情報が入力上限を超えました。コンテキスト設定を調整してください');
  const chunks: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < body.length;) {
    let end = Math.min(body.length, start + size);
    if (end < body.length) {
      const window = body.slice(start, end);
      const boundary = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('。'));
      if (boundary > size / 2) end = start + boundary + 1;
    }
    chunks.push({ start, end });
    if (end === body.length) break;
    start = Math.max(start + 1, end - Math.min(200, Math.floor(size / 4)));
  }
  return chunks;
}

export async function extractNarrativeDelta(project: Project, chapterId: string, options: {
  run: NarrativeRunner; budget: number; signal?: AbortSignal;
  onCheckpoint: (job: NarrativeExtractionJob) => Promise<void>;
  previousJob?: NarrativeExtractionJob;
}): Promise<NarrativeProposal> {
  const initial = deriveNarrativeState(project, chapterId);
  if (initial.reason) throw new Error(initial.reason);
  const body = project.chapters.find(c => c.id === chapterId)?.draft ?? '';
  if (!body.trim()) throw new Error('本文がありません');
  const signature = [NARRATIVE_PROMPT_VERSION, draftHash(body), proposalDependency(project, chapterId), options.budget].join(':');
  const overhead = buildNarrativeExtractionPrompt(project, chapterId, initial.state, '').length + 1000;
  const chunks = narrativeChunks(body, Math.min(6000, options.budget - overhead));
  const previous = options.previousJob;
  const reusable = previous?.signature === signature && previous.chunks.length === chunks.length && chunks.every((c, i) => c.start === previous.chunks[i].start && c.end === previous.chunks[i].end);
  const job: NarrativeExtractionJob = reusable ? structuredClone(previous) : { chapterId, signature, status: 'running', finished: 0, chunks };
  job.status = 'running'; delete job.error;
  let state = initial.state;
  const total = emptyDelta();
  try {
    await options.onCheckpoint(structuredClone(job));
    for (const chunk of job.chunks) {
      if (options.signal?.aborted) throw new DOMException('中断しました', 'AbortError');
      if (!chunk.delta) {
        const prompt = buildNarrativeExtractionPrompt(project, chapterId, state, normalizeMapped(body.slice(chunk.start, chunk.end)).text);
        if (prompt.length > options.budget) throw new Error('章内の状態情報が入力上限を超えました。設定を調整して再解析してください');
        let repair = '';
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await options.run(prompt + repair, { signal: options.signal, projectId: project.id, chapterId });
          if (options.signal?.aborted) throw new DOMException('中断しました', 'AbortError');
          if (response.error || response.finishReason === 'length' || response.finishReason === 'blocked') throw new Error(response.error || 'AI応答が未完成です');
          try {
            chunk.delta = parseNarrativeDelta(response.content, project, chapterId, state, chunk.start, chunk.end);
            if (!response.finishReason || response.finishReason === 'unknown') {
              const warning = 'AIの終了理由を取得できませんでした。抽出内容を確認してください';
              job.warnings = [...new Set([...(job.warnings ?? []), warning])];
              for (const item of itemsOf(chunk.delta)) item.warnings.push(warning);
            }
            break;
          } catch (error) {
            if (attempt) throw error;
            repair = '\n前回の形式エラー: ' + String(error).slice(0, 200) + '。形式と引用を修正して出力してください。';
            if (prompt.length + repair.length > options.budget) throw error;
          }
        }
        job.finished = job.chunks.filter(c => c.delta).length;
        await options.onCheckpoint(structuredClone(job));
      }
      const delta = chunk.delta!;
      state = applyDelta(state, delta);
      for (const c of delta.characterChanges) {
        if (!total.characterChanges.some(old => old.characterId === c.characterId && old.field === c.field && old.operation === c.operation && old.source.start === c.source.start && old.source.end === c.source.end && JSON.stringify(old.values.map(v => [v.text, v.knowledge, v.relatedCharacterId])) === JSON.stringify(c.values.map(v => [v.text, v.knowledge, v.relatedCharacterId])))) total.characterChanges.push(c);
      }
      total.addEvents.push(...delta.addEvents);
      total.addRequirements.push(...delta.addRequirements); total.transitionRequirements.push(...delta.transitionRequirements);
    }
    job.status = 'completed'; await options.onCheckpoint(structuredClone(job));
    return { id: crypto.randomUUID(), projectId: project.id, chapterId, draftHash: draftHash(body), basis: initial.fingerprint, dependency: proposalDependency(project, chapterId), delta: total, decisions: Object.fromEntries(itemsOf(total).map(i => [i.id, 'pending'])), createdAt: new Date().toISOString(), warnings: job.warnings };
  } catch (error) {
    job.status = options.signal?.aborted ? 'paused' : 'error'; job.error = String(error);
    await options.onCheckpoint(structuredClone(job));
    throw error;
  }
}
