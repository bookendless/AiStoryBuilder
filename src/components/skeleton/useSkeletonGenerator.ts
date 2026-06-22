/**
 * AIおまかせ骨組み生成のReact結線フック（Phase B）
 *
 * GenerationContext（実行中の可視化・任意キャンセル・ステップ移動でも継続）と
 * PendingResultContext（完了→確認→反映/破棄）を結線し、services層の generateSkeleton を駆動する。
 *
 * NewProjectModal から、プロジェクト作成・plot1 遷移の直後にキックされる。
 * 反映処理（onApply）は最新の updateProject / currentProject を ref 経由で参照するため、
 * 生成完了が遅延してもアンマウントや状態更新の遅れで取りこぼさない。
 */

import { useCallback, useRef } from 'react';
import { useAI } from '../../contexts/AIContext';
import { useProject } from '../../contexts/ProjectContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { usePendingResult } from '../../contexts/PendingResultContext';
import { useToast } from '../Toast';
import { SkeletonSeed, SkeletonResult } from '../../types/skeleton';
import { Project } from '../../types/project';
import { generateSkeleton } from '../../services/skeleton/generateSkeleton';
import { createSkeletonRunner } from '../../services/skeleton/createSkeletonRunner';
import { buildSkeletonPreview } from './skeletonPreview';

export function useSkeletonGenerator() {
    const { settings, isConfigured } = useAI();
    const { updateProject, currentProject } = useProject();
    const { startTask, updateTask, completeTask } = useGeneration();
    const { proposeResult } = usePendingResult();
    const { showWarning, showError } = useToast();

    // 反映時に最新値を参照するための ref（生成完了が遅延しても古いクロージャを使わない）
    const updateProjectRef = useRef(updateProject);
    updateProjectRef.current = updateProject;
    const currentProjectRef = useRef(currentProject);
    currentProjectRef.current = currentProject;

    // 骨組みをプロジェクトへ反映（plot1 6項目 + 構成 + キャラクター）
    // targetProjectId: 生成を開始したプロジェクト。別プロジェクトを開いた状態での
    // 誤反映（キャラ配列の全置換による破壊）を防ぐためのガード。
    const applySkeleton = useCallback(async (result: SkeletonResult, targetProjectId: string) => {
        if (currentProjectRef.current?.id !== targetProjectId) {
            showWarning('別のプロジェクトを開いているため、骨組みは反映されませんでした。対象のプロジェクトを開いてから反映してください。', 6000);
            return;
        }
        const basePlot = currentProjectRef.current?.plot ?? {
            theme: '', setting: '', hook: '', protagonistGoal: '', mainObstacle: '',
        };
        const plotPatch: Project['plot'] = {
            ...basePlot,
            theme: result.plot.theme || basePlot.theme,
            setting: result.plot.setting || basePlot.setting,
            hook: result.plot.hook || basePlot.hook,
            protagonistGoal: result.plot.protagonistGoal || basePlot.protagonistGoal,
            mainObstacle: result.plot.mainObstacle || basePlot.mainObstacle,
            ending: result.plot.ending || basePlot.ending,
        };
        if (result.structure) {
            plotPatch.structure = result.structure.structure;
            Object.assign(plotPatch, result.structure.fields);
        }

        const patch: Partial<Project> = { plot: plotPatch };
        if (result.characters.length > 0) {
            patch.characters = result.characters;
        }
        await updateProjectRef.current(patch, true);
    }, [showWarning]);

    /**
     * 骨組み生成を開始する。説明（種）が空 or AI未設定なら何もしない。
     * 作成・遷移の直後に同期的に呼ぶ想定。
     * @param targetProjectId 反映対象のプロジェクトID（誤反映ガード用）
     */
    const startSkeletonGeneration = useCallback(
        (seed: SkeletonSeed, targetProjectId: string) => {
            if (!seed.description.trim()) return;
            if (!isConfigured) {
                showWarning('AI設定が未完了のため、おまかせ骨組み生成をスキップしました。', 5000);
                return;
            }

            const { id: taskId, signal } = startTask({
                key: `skeleton:${Date.now()}`,
                label: '骨組みを生成中',
                step: 'plot1',
            });
            const run = createSkeletonRunner(settings, signal);

            void (async () => {
                try {
                    const result = await generateSkeleton(seed, {
                        settings,
                        run,
                        signal,
                        onProgress: (p) =>
                            updateTask(taskId, {
                                label: p.phase,
                                progress: { current: p.current, total: p.total },
                            }),
                    });
                    if (signal.aborted) return;

                    proposeResult({
                        label: 'AIおまかせ骨組み',
                        preview: buildSkeletonPreview(result),
                        onApply: () => applySkeleton(result, targetProjectId),
                        applySuccessMessage: '骨組みを反映しました',
                    });
                } catch (err) {
                    if (err instanceof DOMException && err.name === 'AbortError') return;
                    if (err instanceof Error && err.name === 'AbortError') return;
                    console.error('骨組み生成エラー:', err);
                    showError('おまかせ骨組みの生成に失敗しました。');
                } finally {
                    completeTask(taskId);
                }
            })();
        },
        [
            isConfigured,
            settings,
            startTask,
            updateTask,
            completeTask,
            proposeResult,
            applySkeleton,
            showWarning,
            showError,
        ]
    );

    return { startSkeletonGeneration };
}
