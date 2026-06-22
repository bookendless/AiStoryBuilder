/**
 * 先回りバックグラウンド生成（Phase D）の型定義
 *
 * あるステップを完了して次へ進んだとき、後続ステップ（あらすじ/章立て/草案）を
 * 裏で先回り生成し、到着時に「反映する／破棄する」を選べるようにする。
 */

import { Chapter } from './project/chapter';

/** 先回り生成の対象ステップ */
export type PreemptiveTargetStep = 'synopsis' | 'chapter' | 'draft';

/** あらすじ先回りの結果 */
export interface PreemptiveSynopsisResult {
  kind: 'synopsis';
  synopsis: string;
}

/** 章立て先回りの結果（既存章へ追記する章ドラフト群） */
export interface PreemptiveChaptersResult {
  kind: 'chapter';
  chapters: Chapter[];
}

/** 草案先回りの結果（最初の未草案章ひとつ分） */
export interface PreemptiveDraftResult {
  kind: 'draft';
  chapterId: string;
  chapterTitle: string;
  draft: string;
}

export type PreemptiveResult =
  | PreemptiveSynopsisResult
  | PreemptiveChaptersResult
  | PreemptiveDraftResult;
