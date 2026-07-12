/**
 * リキャップのローカル計算部（AI呼び出しなし）
 *
 * 執筆再開地点・未回収伏線・表示可否の判定など、プロジェクトデータから
 * 即時に導出できる情報をここに集約する。モーダルはAI生成を待たずにこれらを先に表示する。
 */

import { Project, Foreshadowing } from '../../types/project';
import { NonHomeStep } from '../../types/common';
import { RecapResumePoint } from '../../types/recap';
import { findFirstUndraftedChapter } from '../preemptive/generatePreemptiveDraft';

/** リキャップ表示のギャップ閾値（前回アクセスからこの時間以上空いたら表示） */
export const RECAP_GAP_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** ステップの表示ラベル */
export const STEP_LABELS: Record<NonHomeStep, string> = {
    character: 'キャラクター',
    plot1: 'プロット（基本設定）',
    plot2: 'プロット（構成）',
    synopsis: 'あらすじ',
    chapter: '章立て',
    draft: '草案執筆',
    review: '講評',
    export: '出力',
};

/** 執筆再開地点をローカル計算する */
export function computeResumePoint(project: Project): RecapResumePoint {
    const step = project.currentStep;
    const lastDrafted = [...project.chapters].reverse().find(c => (c.draft ?? '').trim().length > 0);
    const next = findFirstUndraftedChapter(project);

    return {
        step,
        stepLabel: step ? STEP_LABELS[step] : undefined,
        lastDraftedChapterTitle: lastDrafted?.title,
        nextChapterTitle: next?.title,
    };
}

/** 未回収（設置済み・ヒント済み）の伏線を返す */
export function getOpenForeshadowings(project: Project): Foreshadowing[] {
    return (project.foreshadowings ?? []).filter(
        f => f.status === 'planted' || f.status === 'hinted'
    );
}

/** リキャップを表示する意味のあるコンテンツがあるか（作りたてのプロジェクトでは出さない） */
export function hasRecapContent(project: Project): boolean {
    if ((project.synopsis ?? '').trim().length > 0) return true;
    return project.chapters.some(
        c => (c.summary ?? '').trim().length > 0 || (c.draft ?? '').trim().length > 0
    );
}
