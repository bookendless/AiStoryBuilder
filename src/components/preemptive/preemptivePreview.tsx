/**
 * 先回り生成結果の確認モーダル用プレビュー（Phase D）
 *
 * PendingResultModal に渡す ReactNode。あらすじ抜粋 / 追加章タイトル一覧 / 草案抜粋を簡潔に表示する。
 */

import React from 'react';
import { PreemptiveResult } from '../../types/preemptive';

const EXCERPT_LEN = 300;

function excerpt(text: string, len = EXCERPT_LEN): string {
  const t = text.trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}

export function buildPreemptivePreview(result: PreemptiveResult): React.ReactNode {
  if (result.kind === 'synopsis') {
    return (
      <div className="space-y-2">
        <p className="text-sm whitespace-pre-wrap text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
          {excerpt(result.synopsis)}
        </p>
        <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] pt-1">
          「反映する」であらすじに設定されます。
        </p>
      </div>
    );
  }

  if (result.kind === 'chapter') {
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
          {result.chapters.length}章を追加
        </div>
        <ol className="list-decimal list-inside space-y-1">
          {result.chapters.map((ch, i) => (
            <li key={ch.id ?? i} className="text-sm text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
              {ch.title}
              {ch.summary ? <span className="text-xs text-sumi-500 dark:text-usuzumi-400">（{excerpt(ch.summary, 40)}）</span> : null}
            </li>
          ))}
        </ol>
        <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] pt-1">
          「反映する」で既存の章立てに追記されます。
        </p>
      </div>
    );
  }

  // draft
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP']">
        「{result.chapterTitle}」の草案
      </div>
      <p className="text-sm whitespace-pre-wrap text-sumi-600 dark:text-usuzumi-300 font-['Noto_Sans_JP']">
        {excerpt(result.draft)}
      </p>
      <p className="text-xs text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] pt-1">
        「反映する」でこの章の草案に設定されます。
      </p>
    </div>
  );
}
