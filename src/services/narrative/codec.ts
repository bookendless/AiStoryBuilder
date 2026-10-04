import type { Project } from '../../types/project';
import type { NarrativeDelta, NarrativeMemory } from '../../types/narrative';
import { FIELDS } from './state';

type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const array = (v: unknown, check: (v: unknown) => boolean): boolean => Array.isArray(v) && v.every(check);
const optionalString = (v: unknown) => v === undefined || str(v);
const optionalWarnings = (v: unknown) => v === undefined || strings(v);
const source = (v: unknown): boolean => obj(v) && ['text', 'author'].includes(String(v.kind)) && str(v.chapterId) && str(v.draftHash) && str(v.quote) && num(v.start) && num(v.end) && v.end >= v.start && optionalString(v.reason) && (v.alternatives === undefined || array(v.alternatives, num));
const item = (v: unknown): v is Obj => obj(v) && str(v.id) && source(v.source) && strings(v.warnings);
const value = (v: unknown) => obj(v) && str(v.id) && str(v.text) && source(v.source) && optionalString(v.relatedCharacterId) && (v.knowledge === undefined || ['known', 'believed', 'explicitlyUnknown'].includes(String(v.knowledge)));
export function isDelta(v: unknown): v is NarrativeDelta {
  return obj(v) && array(v.characterChanges, c => item(c) && str(c.characterId) && optionalString(c.characterName) && FIELDS.includes(c.field as never) && ['set', 'clear'].includes(String(c.operation)) && array(c.values, value))
    && array(v.addEvents, e => item(e) && str(e.description) && strings(e.characterIds) && optionalString(e.storyTime))
    && array(v.addRequirements, r => item(r) && str(r.description) && strings(r.characterIds) && ['clue', 'question', 'promise', 'confrontation', 'other'].includes(String(r.kind)) && ['open', 'resolved', 'deferred', 'dropped'].includes(String(r.status)) && optionalString(r.plannedChapterId) && optionalString(r.foreshadowingId) && (r.resolution === undefined || source(r.resolution)))
    && array(v.transitionRequirements, r => item(r) && str(r.requirementId) && ['open', 'resolved', 'deferred', 'dropped'].includes(String(r.status)) && optionalString(r.reason));
}
export function isMemory(v: unknown): v is NarrativeMemory {
  if (!obj(v) || v.schemaVersion !== 1 || typeof v.enabled !== 'boolean' || !num(v.revision)) return false;
  return array(v.records, r => obj(r) && str(r.chapterId) && num(r.revision) && str(r.proposalId) && str(r.draftHash) && str(r.basis) && str(r.acceptedAt) && isDelta(r.delta))
    && array(v.proposals, p => obj(p) && optionalWarnings(p.warnings) && str(p.id) && str(p.projectId) && str(p.chapterId) && str(p.draftHash) && str(p.basis) && str(p.dependency) && str(p.createdAt) && isDelta(p.delta) && obj(p.decisions) && Object.values(p.decisions).every(d => ['pending', 'accept', 'reject'].includes(String(d))))
    && array(v.jobs, j => obj(j) && optionalWarnings(j.warnings) && str(j.chapterId) && str(j.signature) && num(j.finished) && ['running', 'paused', 'error', 'completed'].includes(String(j.status)) && optionalString(j.error) && array(j.chunks, c => obj(c) && num(c.start) && num(c.end) && (c.delta === undefined || isDelta(c.delta))));
}
export function normalizeNarrativeProject<T extends Project>(project: T): T {
  if (project.narrativeMemory === undefined || isMemory(project.narrativeMemory)) return project;
  return { ...project, narrativeMemory: undefined, narrativeMemoryQuarantine: { data: project.narrativeMemory, message: '物語状態データの形式に対応していません。本文は保持しています。' } };
}
