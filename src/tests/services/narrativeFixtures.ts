import type { Project } from '../../types/project';
import type { NarrativeDelta, NarrativeProposal, NarrativeSource } from '../../types/narrative';
import { applyNarrativeProposal, deriveNarrativeState, draftHash, emptyDelta, emptyMemory, itemsOf, proposalDependency } from '../../services/narrative/state';

export function narrativeProject(): Project {
  return {
    id: 'p1', title: '状態テスト', description: '', theme: '', imageBoard: [],
    progress: { character: 0, plot: 0, synopsis: 0, chapter: 0, draft: 0 },
    characters: [{ id: 'a', name: 'アキ', role: '', appearance: '', personality: '', background: '' }],
    plot: { theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '' }, synopsis: '', draft: '',
    chapters: [
      { id: 'c1', title: '第一章', summary: '旅立ち', draft: 'アキは鍵を受け取った。港にいた。' },
      { id: 'c2', title: '第二章', summary: '移動', draft: '鍵を渡した。アキは森へ移動した。' },
      { id: 'c3', title: '第三章', summary: '未来の計画', draft: '後続章だけの秘密。' },
    ],
    createdAt: new Date(0), updatedAt: new Date(0), narrativeMemory: { ...emptyMemory(), enabled: true },
  };
}
export function source(p: Project, chapterId = 'c1', quote?: string): NarrativeSource {
  const body = p.chapters.find(c => c.id === chapterId)!.draft!;
  const text = quote ?? body;
  const start = body.indexOf(text);
  return { kind: 'text', chapterId, quote: text, start, end: start + text.length, draftHash: draftHash(body) };
}
export function proposal(p: Project, chapterId = 'c1', delta: NarrativeDelta = emptyDelta()): NarrativeProposal {
  return { id: crypto.randomUUID(), projectId: p.id, chapterId, draftHash: draftHash(p.chapters.find(c => c.id === chapterId)!.draft!), basis: deriveNarrativeState(p, chapterId).fingerprint, dependency: proposalDependency(p, chapterId), delta, decisions: Object.fromEntries(itemsOf(delta).map(i => [i.id, 'accept'])), createdAt: new Date(0).toISOString() };
}
export function accept(p: Project, chapterId = 'c1', delta: NarrativeDelta = emptyDelta()): Project {
  const suggestion = proposal(p, chapterId, delta);
  const withProposal = { ...p, narrativeMemory: { ...p.narrativeMemory!, proposals: [...p.narrativeMemory!.proposals, suggestion] } };
  return { ...withProposal, ...applyNarrativeProposal(withProposal, suggestion.id) };
}
export function location(p: Project, chapterId: string, text: string): NarrativeDelta {
  const src = source(p, chapterId);
  return { ...emptyDelta(), characterChanges: [{ id: `location:${chapterId}`, source: src, warnings: [], characterId: 'a', field: 'location', operation: 'set', values: [{ id: `v:${chapterId}`, text, source: src }] }] };
}
