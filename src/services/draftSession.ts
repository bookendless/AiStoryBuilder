import type { Project } from '../types/project';

export type DraftUpdater = (updates: Partial<Project> | ((project: Project) => Partial<Project>), immediate?: boolean, projectId?: string) => Promise<void>;

/** ProjectContext is the shared draft buffer; disk persistence is independently debounced. */
export function updateDraft(project: Project, chapterId: string, text: string): Partial<Project> {
  if (!project.chapters.some(c => c.id === chapterId)) throw new Error('章が削除されています');
  return { chapters: project.chapters.map(c => c.id === chapterId ? { ...c, draft: text } : c), draft: text };
}

export async function flushDraft(update: DraftUpdater, projectId: string, chapterId: string): Promise<string> {
  let text = '';
  await update(latest => {
    const chapter = latest.chapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('章が削除されています');
    text = chapter.draft ?? '';
    return {};
  }, true, projectId);
  return text;
}
