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
import { useAI } from '../../contexts/AIContext';
import { useProject } from '../../contexts/ProjectContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { usePendingResult } from '../../contexts/PendingResultContext';
import { useToast } from '../Toast';
import { AIRequest } from '../../types/ai';
import { PreemptiveTargetStep, PreemptiveResult } from '../../types/preemptive';
import { createPreemptiveRunner } from '../../services/preemptive/createPreemptiveRunner';
import { computePreemptiveSignature } from '../../services/preemptive/computeSignature';
import { generatePreemptiveSynopsis } from '../../services/preemptive/generatePreemptiveSynopsis';
import { generatePreemptiveChapters } from '../../services/preemptive/generatePreemptiveChapters';
import { generatePreemptiveDraft } from '../../services/preemptive/generatePreemptiveDraft';
import { buildPreemptivePreview } from './preemptivePreview';

const STEP_META: Record<PreemptiveTargetStep, { label: string; type: AIRequest['type'] }> = {
  synopsis: { label: 'あらすじ', type: 'synopsis' },
  chapter: { label: '章立て', type: 'chapter' },
  draft: { label: '草案', type: 'draft' },
};

export function usePreemptiveGenerator() {
  const { settings, isConfigured } = useAI();
  const { updateProject, currentProject } = useProject();
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
        return;
      }
      if (result.kind === 'synopsis') {
        await updateProjectRef.current({ synopsis: result.synopsis }, true);
      } else if (result.kind === 'chapter') {
        await updateProjectRef.current({ chapters: [...proj.chapters, ...result.chapters] }, true);
      } else {
        const updatedChapters = proj.chapters.map(c =>
          c.id === result.chapterId ? { ...c, draft: result.draft } : c
        );
        await updateProjectRef.current({ chapters: updatedChapters }, true);
      }
    },
    [showWarning]
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
        try {
          let result: PreemptiveResult | null;
          if (targetStep === 'synopsis') {
            result = await generatePreemptiveSynopsis(proj, { run, signal });
          } else if (targetStep === 'chapter') {
            result = await generatePreemptiveChapters(proj, { run, signal });
          } else {
            result = await generatePreemptiveDraft(proj, { run, signal });
          }
          if (signal.aborted || !result) return;

          const finalResult = result;
          const pendingId = proposeResult({
            label: `先回り: ${meta.label}`,
            preview: buildPreemptivePreview(finalResult),
            onApply: () => applyResult(finalResult, targetProjectId),
            applySuccessMessage: `${meta.label}を反映しました`,
          });
          pendingByKeyRef.current.set(key, { id: pendingId, signature });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (err instanceof Error && err.name === 'AbortError') return;
          // 先回りは裏処理のため、失敗は静かにログのみ（ユーザーを煩わせない）
          console.error('先回り生成エラー:', err);
        } finally {
          completeTask(taskId);
        }
      })();
    },
    [isConfigured, settings, startTask, completeTask, proposeResult, removeResult, applyResult]
  );

  return { startPreempt };
}
