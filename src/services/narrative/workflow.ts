import type { Project } from '../../types/project';
import type { AISettings } from '../../types/ai';
import type { ProjectContextType } from '../../contexts/useProject';
import { extractNarrativeDelta } from './extract';
import { createNarrativeRunner, narrativeBudget } from './runner';
import { draftHash, emptyMemory, proposalDependency, proposalIsCurrent } from './state';

export async function extractAndSaveNarrative(projectId: string, chapterId: string, settings: AISettings, commit: ProjectContextType['commitProjectUpdate'], getProject: () => Project | null, signal: AbortSignal) {
  const saved = await commit(() => ({}), projectId);
  const snapshot = saved.project;
  const signature = `${proposalDependency(snapshot, chapterId)}:${draftHash(snapshot.chapters.find(c => c.id === chapterId)?.draft ?? '')}`;
  const assertCurrent = (p: Project) => {
    if (p.id !== projectId || !p.narrativeMemory?.enabled || signature !== `${proposalDependency(p, chapterId)}:${draftHash(p.chapters.find(c => c.id === chapterId)?.draft ?? '')}`) throw new Error('解析中に本文または設定が変わりました。再解析してください');
  };
  assertCurrent(snapshot);
  const proposal = await extractNarrativeDelta(snapshot, chapterId, {
    run: createNarrativeRunner(settings), budget: narrativeBudget(settings), signal,
    previousJob: snapshot.narrativeMemory?.jobs.find(j => j.chapterId === chapterId),
    onCheckpoint: async job => {
      const current = getProject();
      if (!current || current.id !== projectId) throw new Error('プロジェクトが切り替わりました');
      await commit(p => {
        assertCurrent(p);
        const memory = p.narrativeMemory ?? emptyMemory();
        return { narrativeMemory: { ...memory, jobs: [...memory.jobs.filter(j => j.chapterId !== chapterId), job] } };
      }, projectId);
    },
  });
  if (signal.aborted) throw new DOMException('中断しました', 'AbortError');
  await commit(p => {
    assertCurrent(p);
    if (!proposalIsCurrent(p, proposal)) throw new Error('前提が変わりました。再解析してください');
    const memory = p.narrativeMemory!;
    return { narrativeMemory: { ...memory, proposals: [...memory.proposals, proposal] } };
  }, projectId);
  return proposal;
}
