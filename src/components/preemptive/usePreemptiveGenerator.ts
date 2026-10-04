/**
 * 先回りバックグラウンド生成（Phase D）のReact結線フック
 *
 * useSkeletonGenerator を雛形に、GenerationContext（可視化・任意キャンセル・ステップ移動でも継続）と
 * PendingResultContext（完了→確認→反映/破棄）を結線し、services層の generatePreemptive* を駆動する。
 *
 * - トリガーは PreemptiveGenerationManager（ステップ離脱イベント）が担当。本フックは実行のみ。
 * - 反映処理（onApply）は最新の updateProject / currentProject を ref で参照し、完了が遅延しても取りこぼさない。
 * - supersede: 同keyの再実行時は GenerationContext がタスクを置換するが、完了済みの PendingResult は
 *   別管理で残るため、key→pendingResultId の Map を保持し再実行時に古い保留結果を removeResult する。
 */

import { useCallback, useRef } from 'react';
import { useAI } from '../../contexts/useAI';
import { useProject } from '../../contexts/useProject';
import { useGeneration } from '../../contexts/useGeneration';
import { usePendingResult } from '../../contexts/usePendingResult';
import { useToast } from '../useToast';
import { AIRequest } from '../../types/ai';
import { PreemptiveTargetStep, PreemptiveResult } from '../../types/preemptive';
import { createPreemptiveRunner } from '../../services/preemptive/createPreemptiveRunner';
import { computePreemptiveSignature } from '../../services/preemptive/computeSignature';
import { generatePreemptiveSynopsis } from '../../services/preemptive/generatePreemptiveSynopsis';
import { generatePreemptiveChapters } from '../../services/preemptive/generatePreemptiveChapters';
import { generatePreemptiveDraft } from '../../services/preemptive/generatePreemptiveDraft';
import { buildPreemptivePreview } from './preemptivePreview';
import { generationSignature, NarrativeGenerationError } from '../../services/narrative/context';
import { updateDraft } from '../../services/draftSession';

const STEP_META: Record<PreemptiveTargetStep, { label: string; type: AIRequest['type'] }> = {
  synopsis: { label: 'あらすじ', type: 'synopsis' },
  chapter: { label: '章立て', type: 'chapter' },
  draft: { label: '草案', type: 'draft' },
};

export function usePreemptiveGenerator() {
  const { settings, isConfigured } = useAI();
  const { updateProject, currentProject, commitProjectUpdate, getCurrentProject } = useProject();
  const { startTask, completeTask } = useGeneration();
  const { proposeResult, removeResult } = usePendingResult();
  const { showWarning } = useToast();

  // 反映時に最新値を参照（生成完了が遅延しても古いクロージャを使わない）
  const updateProjectRef = useRef(updateProject);
  updateProjectRef.current = updateProject;
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  // key -> 直近の保留結果（id と入力シグネチャ）。supersede と再課金防止に使う。
  const pendingByKeyRef = useRef<Map<string, { id: string; signature: string }>>(new Map());

  /** targetProjectId ガード付きで結果を反映 */
  const applyResult = useCallback(
    async (result: PreemptiveResult, targetProjectId: string) => {
      const proj = currentProjectRef.current;
      if (proj?.id !== targetProjectId) {
        showWarning('別のプロジェクトを開いているため、先回り生成は反映されませんでした。対象のプロジェクトを開いてから反映してください。', 6000);
        throw new Error('生成元のプロジェクトを開いてから反映してください');
      }
      if (result.kind === 'synopsis') {
        await updateProjectRef.current({ synopsis: result.synopsis }, true, targetProjectId);
      } else if (result.kind === 'chapter') {
        await updateProjectRef.current({ chapters: [...proj.chapters, ...result.chapters] }, true, targetProjectId);
      } else {
        if (proj.narrativeMemory?.enabled && !result.narrativeSignature) throw new Error('状態管理を有効にする前の提案です。再生成してください');
        if (result.narrativeSignature) {
          await commitProjectUpdate(latest => {
            if (generationSignature(latest, result.chapterId) !== result.narrativeSignature || latest.chapters.find(c => c.id === result.chapterId)?.draft?.trim()) throw new Error('本文または確定状態が変わりました。再生成してください');
            return updateDraft(latest, result.chapterId, result.draft);
          }, targetProjectId);
          return;
        }
        const updatedChapters = proj.chapters.map(c =>
          c.id === result.chapterId ? { ...c, draft: result.draft } : c
        );
        await updateProjectRef.current({ chapters: updatedChapters }, true, targetProjectId);
      }
    },
    [showWarning, commitProjectUpdate]
  );

  /**
   * 次ステップの先回り生成を開始する。
   * @param targetStep 生成対象（あらすじ/章立て/草案）
   * @param targetProjectId 反映対象プロジェクトID（誤反映ガード用）
   */
  const startPreempt = useCallback(
    (targetStep: PreemptiveTargetStep, targetProjectId: string) => {
      if (!isConfigured) return;

      const meta = STEP_META[targetStep];
      const key = `preempt:${targetProjectId}:${targetStep}`;

      const proj = currentProjectRef.current;
      // 開始時点で対象プロジェクトが切り替わっていたら何もしない
      if (!proj || proj.id !== targetProjectId) return;

      // 入力シグネチャで再課金を防ぐ。前回と同じ入力なら再生成しない（純粋なステップ往復で課金しない）。
      const signature = computePreemptiveSignature(proj, targetStep);
      const existing = pendingByKeyRef.current.get(key);
      if (existing) {
        if (existing.signature === signature) return; // 同入力 → 何もしない
        // 入力が変わった → 古い保留結果を静かに消して作り直す
        removeResult(existing.id);
        pendingByKeyRef.current.delete(key);
      }

      const { id: taskId, signal } = startTask({
        key,
        label: `次のステップを先回り生成中…（${meta.label}）`,
        step: targetStep,
      });
      const run = createPreemptiveRunner(settings, signal, meta.type);

      void (async () => {
        let receivedDraft: string | undefined;
        try {
          let result: PreemptiveResult | null;
          if (targetStep === 'synopsis') {
            result = await generatePreemptiveSynopsis(proj, { run, signal });
          } else if (targetStep === 'chapter') {
            result = await generatePreemptiveChapters(proj, { run, signal });
          } else {
            let source = proj;
            if (proj.narrativeMemory?.enabled) {
              source = (await commitProjectUpdate(() => ({}), targetProjectId)).project;
              if (computePreemptiveSignature(source, targetStep) !== signature) throw new Error('保存中に生成の前提が変わりました');
            }
            result = await generatePreemptiveDraft(source, { run, signal, settings });
          }
          if (signal.aborted || !result) return;
          if (result.kind === 'draft') receivedDraft = result.draft;
          if (result.kind === 'draft' && result.narrativeSignature) {
            const latest = getCurrentProject();
            if (!latest || latest.id !== targetProjectId || generationSignature(latest, result.chapterId) !== result.narrativeSignature) throw new Error('生成中に前提が変わりました');
          }

          const finalResult = result;
          const pendingId = proposeResult({
            label: `先回り: ${meta.label}`,
            preview: (finalResult.kind === 'draft' && finalResult.completionUnknown ? 'AIの終了理由が不明です。末尾まで完成していることを確認してから反映してください。\n\n' : '') + buildPreemptivePreview(finalResult),
            applyLabel: finalResult.kind === 'draft' && finalResult.completionUnknown ? '末尾まで確認して反映' : undefined,
            projectId: targetProjectId,
            onApply: () => applyResult(finalResult, targetProjectId),
            applySuccessMessage: `${meta.label}を反映しました`,
          });
          pendingByKeyRef.current.set(key, { id: pendingId, signature });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof Error && err.name === 'AbortError') return;
          // Keep the existing completion/apply guards. Failed validation leaves
          // a read-only copy instead of discarding an already received draft.
          const received = err instanceof NarrativeGenerationError ? err.response.content : receivedDraft;
          if (received?.trim()) {
            const reason = err instanceof Error ? err.message : '生成結果を適用できませんでした';
            proposeResult({ label: '先回り: 草案（受信内容の確認）', projectId: targetProjectId,
              preview: received, draftPreview: { oldText: '', newText: received, notice: reason },
              applyBlockedReason: reason, onApply: () => { throw new Error(reason); } });
          }
          // 先回りは裏処理のため、失敗は静かにログのみ（ユーザーを煩わせない）
          console.error('先回り生成エラー:', err);
        } finally {
          completeTask(taskId);
        }
      })();
    },
    [isConfigured, settings, startTask, completeTask, proposeResult, removeResult, applyResult, commitProjectUpdate, getCurrentProject]
  );

  return { startPreempt };
}
