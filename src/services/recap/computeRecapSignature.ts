/**
 * リキャップ入力シグネチャ
 *
 * 「プロジェクトを開くたびに再生成して再課金する」のを避けるため、リキャップ生成の
 * 入力を左右するプロジェクトスライスから安定した署名を作る（computePreemptiveSignature と同じ発想）。
 * 署名が前回と同じならキャッシュを再利用し、AI呼び出しは行わない。
 */

import { Project } from '../../types/project';

export function computeRecapSignature(project: Project): string {
    return JSON.stringify({
        title: project.title,
        synopsisLen: project.synopsis?.length ?? 0,
        chapters: project.chapters.map(
            c => `${c.id}:${c.title}:${c.summary?.length ?? 0}:${c.draft?.length ?? 0}`
        ),
        currentStep: project.currentStep ?? null,
    });
}
