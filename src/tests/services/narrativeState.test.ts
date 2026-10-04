import { describe, expect, it } from 'vitest';
import { applyDelta, applyNarrativeProposal, copyNarrativeMemory, deriveNarrativeState, emptyDelta, emptyState, proposalIsCurrent, verifySource } from '../../services/narrative/state';
import { normalizeNarrativeProject } from '../../services/narrative/codec';
import { findQuote, normalizeMapped } from '../../services/narrative/source';
import { sanitizeInputForPrompt } from '../../utils/securityUtils';
import { accept, location, narrativeProject, proposal, source } from './narrativeFixtures';

describe('narrative state replay and provenance', () => {
  it('only replays earlier chapters and preserves the history at each point', () => {
    let p = narrativeProject(); p = accept(p, 'c1', location(p, 'c1', '港')); p = accept(p, 'c2', location(p, 'c2', '森'));
    expect(deriveNarrativeState(p, 'c1').state.characters).toEqual({});
    expect(deriveNarrativeState(p, 'c2').state.characters.a.location?.[0].text).toBe('港');
    expect(deriveNarrativeState(p, 'c3').state.characters.a.location?.[0].text).toBe('森');
  });
  it.each(['body', 'empty', 'order', 'delete', 'settings'] as const)('invalidates dependent state on %s changes', kind => {
    let p = accept(narrativeProject()); p = accept(p, 'c2');
    if (kind === 'body' || kind === 'empty') p.chapters[0].draft = kind === 'body' ? '改稿' : '';
    if (kind === 'order') p.chapters = [p.chapters[1], p.chapters[0], p.chapters[2]];
    if (kind === 'delete') p.chapters = p.chapters.slice(1);
    if (kind === 'settings') p.characters[0].name = '改名';
    expect(deriveNarrativeState(p, 'c3').reason).toBeTruthy();
  });
  it('keeps approved facts valid when plans change but invalidates pending proposals', () => {
    const p = accept(narrativeProject()); const suggestion = proposal(p, 'c2');
    p.chapters[1].summary = '新しい計画';
    expect(deriveNarrativeState(p, 'c2').reason).toBeUndefined();
    expect(proposalIsCurrent(p, suggestion)).toBe(false);
  });
  it('requires every decision, validates sources, and accepts empty changes idempotently', () => {
    const p = narrativeProject(); const suggestion = proposal(p, 'c1', location(p, 'c1', '港'));
    p.narrativeMemory!.proposals.push(suggestion);
    suggestion.decisions['location:c1'] = 'pending';
    expect(() => applyNarrativeProposal(p, suggestion.id)).toThrow('未判断');
    suggestion.decisions['location:c1'] = 'reject';
    const applied = { ...p, ...applyNarrativeProposal(p, suggestion.id) };
    expect(applied.narrativeMemory!.records[0].delta.characterChanges).toEqual([]);
    expect(applyNarrativeProposal(applied, suggestion.id)).toEqual({});
  });
  it('clears one field, preserves others, and safely handles imported identifiers', () => {
    const p = narrativeProject(), delta = location(p, 'c1', '港');
    delta.characterChanges[0].characterId = '__proto__';
    const populated = applyDelta(emptyState(), delta);
    expect(Object.prototype.hasOwnProperty.call(populated.characters, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(populated.characters)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'location')).toBe(false);
    const clear = structuredClone(delta); clear.characterChanges[0].operation = 'clear'; clear.characterChanges[0].values = [];
    expect(applyDelta(populated, clear).characters.__proto__.location).toBeUndefined();
  });
  it('keeps an earlier promise open even after a later resolution', () => {
    let p = narrativeProject(); const s = source(p);
    p = accept(p, 'c1', { ...emptyDelta(), addRequirements: [{ id: 'promise', source: s, warnings: [], description: '鍵を返す', kind: 'promise', characterIds: ['a'], status: 'open' }] });
    p = accept(p, 'c2', { ...emptyDelta(), transitionRequirements: [{ id: 'resolve', source: source(p, 'c2'), warnings: [], requirementId: 'promise', status: 'resolved' }] });
    expect(deriveNarrativeState(p, 'c2').state.requirements[0].status).toBe('open');
    expect(deriveNarrativeState(p, 'c3').state.requirements[0].status).toBe('resolved');
    expect(() => applyDelta(emptyState(), { ...emptyDelta(), transitionRequirements: [{ id: 'bad', source: s, warnings: [], requirementId: 'missing', status: 'resolved' }] })).toThrow();
  });
  it('round-trips JSON, copies only approved history and quarantines incompatible metadata', () => {
    const p = accept(narrativeProject());
    const loaded = normalizeNarrativeProject(JSON.parse(JSON.stringify(p)) as typeof p);
    expect(deriveNarrativeState(loaded, 'c2').reason).toBeUndefined();
    expect(copyNarrativeMemory(p)?.proposals).toEqual([]);
    expect(copyNarrativeMemory(p, [])?.records).toEqual([]);
    const bad = { ...p, narrativeMemory: { schemaVersion: 99 } } as unknown as typeof p;
    const normalized = normalizeNarrativeProject(bad);
    expect(normalized.chapters).toBe(p.chapters);
    expect(normalized.narrativeMemory).toBeUndefined();
    expect(normalized.narrativeMemoryQuarantine?.data).toEqual({ schemaVersion: 99 });
  });
  it('maps sanitized quotes to exact raw offsets without silently resolving duplicate matches', () => {
    const raw = '  アキ<港>へ。\n\n\n鍵     を得た。\n鍵     を得た。 ';
    expect(normalizeMapped(raw).text).toBe(sanitizeInputForPrompt(raw));
    const matches = findQuote(raw, '鍵 を得た。'); expect(matches).toHaveLength(2);
    for (const m of matches) expect(raw.slice(m.start, m.end)).toBe(m.quote);
    const p = narrativeProject(); p.chapters[0].draft = raw;
    expect(verifySource({ ...source(p, 'c1', matches[0].quote), alternatives: matches.map(m => m.start) }, p)).toBe(false);
  });
});
