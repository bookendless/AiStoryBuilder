import { useCallback, useEffect, useRef } from 'react';
import { useProject } from '../../../../contexts/useProject';
import { usePendingResult } from '../../../../contexts/usePendingResult';
import type { Project } from '../../../../types/project';
import { updateDraft } from '../../../../services/draftSession';
import { generationSignature } from '../../../../services/narrative/context';

interface Options {
  review?: boolean;
  notice?: string;
  /** 適用判断に影響しない補足（例: 入力上限で省いた過去の出来事の件数） */
  info?: string;
  signature?: string;
  blockedReason?: string;
  onApplied?: () => void;
}

/** Results belong to their source chapter, not to the lifetime of its sidebar. */
export function useDraftResult(project: Project | null, chapterId: string | null, oldText: string) {
  const { commitProjectUpdate, getCurrentProject } = useProject();
  const { proposeResult, openResult, removeResult } = usePendingResult();
  const mounted = useRef(false);
  const active = useRef({ projectId: project?.id, chapterId });
  active.current = { projectId: project?.id, chapterId };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  return useCallback(async (newText: string, successMessage: string, options: Options = {}) => {
    if (!project || !chapterId) throw new Error('生成元の章がありません');
    // A failed disk write may already have updated the shared buffer. Allow retry
    // only for our own attempted text, and still recheck all narrative inputs.
    let attempted = false;
    const save = async () => {
      if (options.blockedReason) throw new Error(options.blockedReason);
      await commitProjectUpdate(latest => {
        const chapter = latest.chapters.find(c => c.id === chapterId);
        if (!chapter) throw new Error('生成元の章が削除されています');
        const currentText = chapter.draft ?? '';
        const retry = attempted && currentText === newText;
        if (currentText !== oldText && !retry) throw new Error('生成後に草案が編集されています。確認待ちの本文をコピーして変更内容を確認してください');
        const basis = retry ? { ...latest, chapters: latest.chapters.map(c => c.id === chapterId ? { ...c, draft: oldText } : c) } : latest;
        if (options.signature && generationSignature(basis, chapterId) !== options.signature) throw new Error('生成後に設定・確定状態が変わりました。確認待ちの本文をコピーして内容を確認してください');
        attempted = true;
        return updateDraft(latest, chapterId, newText);
      }, project.id);
      options.onApplied?.();
    };
    let inFlight: Promise<void> | undefined;
    const onApply = () => {
      inFlight ??= save().finally(() => { inFlight = undefined; });
      return inFlight;
    };
    const id = proposeResult({
      projectId: project.id, label: `草案「${project.chapters.find(c => c.id === chapterId)?.title ?? ''}」`,
      preview: newText, draftPreview: { oldText, newText, notice: options.notice, info: options.info },
      applyBlockedReason: options.blockedReason, onApply, applySuccessMessage: successMessage,
    });
    const latest = getCurrentProject();
    const visible = mounted.current && active.current.projectId === project.id && active.current.chapterId === chapterId && latest?.id === project.id;
    const unchanged = latest?.chapters.find(c => c.id === chapterId)?.draft ?? '';
    if (options.review || options.blockedReason || !visible || unchanged !== oldText) {
      if (visible) openResult(id);
      return false;
    }
    // Keep legacy auto-apply for an empty chapter, while retaining a recoverable
    // result if persistence fails. Other actions use explicit global review.
    try { await onApply(); }
    catch (error) { if (visible) openResult(id); throw error; }
    removeResult(id);
    return true;
  }, [project, chapterId, oldText, commitProjectUpdate, getCurrentProject, proposeResult, openResult, removeResult]);
}
