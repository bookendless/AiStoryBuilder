/**
 * 先回り生成（Phase D）の入力シグネチャ
 *
 * 「次ステップへ離脱するたびに再生成して再課金する」のを避けるため、生成プロンプトを左右する
 * project スライスから安定した署名を作る。署名が前回と同じなら再生成しない（純粋なステップ往復で
 * 課金しない）。入力が実際に変わったときだけ署名が変わり、再生成される。
 */

import { Project } from '../../types/project';
import { PreemptiveTargetStep } from '../../types/preemptive';
import { findFirstUndraftedChapter } from './generatePreemptiveDraft';

export function computePreemptiveSignature(project: Project, targetStep: PreemptiveTargetStep): string {
  const charsDigest = project.characters.map(
    c => `${c.id}:${c.name}:${c.role}:${c.appearance}:${c.personality}:${c.background}`
  );

  if (targetStep === 'synopsis') {
    return JSON.stringify({ plot: project.plot, chars: charsDigest });
  }

  if (targetStep === 'chapter') {
    return JSON.stringify({
      plot: project.plot,
      chars: charsDigest,
      existing: project.chapters.map(c => `${c.title}:${c.summary}`),
    });
  }

  // draft: 最初の未草案章とその生成に効く情報
  const target = findFirstUndraftedChapter(project);
  return JSON.stringify({
    chapterId: target?.id ?? null,
    chapter: target
      ? { title: target.title, summary: target.summary, setting: target.setting, mood: target.mood, keyEvents: target.keyEvents, characters: target.characters }
      : null,
    plot: project.plot,
    chars: charsDigest,
    writingStyle: project.writingStyle ?? null,
    styleSample: project.styleSample ?? null,
    // 直前章の末尾は接続に効くため含める
    prevChapterId: target ? project.chapters[project.chapters.findIndex(c => c.id === target.id) - 1]?.id ?? null : null,
  });
}
