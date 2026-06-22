/**
 * 先回りバックグラウンド生成のトリガー（Phase D）
 *
 * App 直下に常駐し、StepChangeAutoSave と同型（previousStepRef でステップ移動を検知）に、
 * 「完了したステップから次へ離脱した」イベントで後続ステップの先回り生成をキックする。
 *
 * 対象遷移（重い3つのみ）:
 *   plot2 完了 → あらすじ / あらすじ完了 → 章立て / 章立て完了 → 草案
 *
 * 状態を level-watch せずイベント駆動にするのは、getStepCompletion を毎更新で監視すると
 * 編集中にフラグがバタついて誤発火するため。UI は描画しない（null を返す）。
 */

import React, { useEffect, useRef } from 'react';
import { Step } from '../../types/common';
import { useProject } from '../../contexts/ProjectContext';
import { useAI } from '../../contexts/AIContext';
import { useGeneration } from '../../contexts/GenerationContext';
import { PreemptiveTargetStep } from '../../types/preemptive';
import { usePreemptiveGenerator } from './usePreemptiveGenerator';

// 離脱元ステップ → 先回りで生成する後続ステップ
const SOURCE_TO_TARGET: Partial<Record<Step, PreemptiveTargetStep>> = {
  plot2: 'synopsis',
  synopsis: 'chapter',
  chapter: 'draft',
};

interface Props {
  currentStep: Step;
}

export const PreemptiveGenerationManager: React.FC<Props> = ({ currentStep }) => {
  const { currentProject, getStepCompletion } = useProject();
  const { settings, isConfigured } = useAI();
  const { isKeyActive } = useGeneration();
  const { startPreempt } = usePreemptiveGenerator();

  const previousStepRef = useRef<Step>(currentStep);

  useEffect(() => {
    const prevStep = previousStepRef.current;
    previousStepRef.current = currentStep;

    // 同一ステップ（初回含む）は何もしない
    if (prevStep === currentStep) return;
    if (!currentProject) return;
    if (settings.preemptiveGenerationEnabled !== true || !isConfigured) return;

    const targetStep = SOURCE_TO_TARGET[prevStep];
    if (!targetStep) return;

    // 離脱元（完了済み）→ 後続（未完了）のときだけ先回り
    if (!getStepCompletion(currentProject, prevStep)) return;
    if (getStepCompletion(currentProject, targetStep)) return;

    // 既に同keyの先回りが実行中なら二重起動しない
    const key = `preempt:${currentProject.id}:${targetStep}`;
    if (isKeyActive(key)) return;

    startPreempt(targetStep, currentProject.id);
  }, [currentStep, currentProject, settings.preemptiveGenerationEnabled, isConfigured, getStepCompletion, isKeyActive, startPreempt]);

  return null;
};
