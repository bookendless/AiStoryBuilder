import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, X, ChevronUp, ChevronDown, Check, ClipboardCheck } from 'lucide-react';
import { useGeneration, GenerationTask } from '../../contexts/GenerationContext';
import { usePendingResult } from '../../contexts/PendingResultContext';

/**
 * GenerationStatusIndicator - 実行中AI生成 ＆ 反映待ち結果の常駐インジケータ
 *
 * 画面左下に常駐し、(1)実行中の生成（経過時間・進捗・キャンセル）と
 * (2)反映待ちの生成結果（確認/破棄）をまとめて表示する。
 * 完了トーストを消しても、反映待ち結果はここからいつでも確認・反映・破棄できる。
 */

// 経過秒数を mm:ss 形式に整形
const formatElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TaskRow: React.FC<{ task: GenerationTask; now: number; onCancel: () => void }> = ({
  task,
  now,
  onCancel,
}) => {
  const elapsed = Math.max(0, Math.floor((now - task.startedAt) / 1000));
  const progressPercentage = task.progress
    ? Math.round((task.progress.current / Math.max(1, task.progress.total)) * 100)
    : null;

  return (
    <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Loader2 className="h-4 w-4 text-ai-500 animate-spin flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP'] truncate">
              {task.label}
            </p>
            <p className="text-[10px] text-sumi-500 dark:text-usuzumi-400 font-['Noto_Sans_JP'] mt-0.5">
              {formatElapsed(elapsed)}
              {task.progress ? ` ・ ${task.progress.current}/${task.progress.total}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="この生成をキャンセル"
          title="キャンセル"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {progressPercentage !== null && (
        <div className="mt-1.5 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ai-400 to-ai-600 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

const PendingRow: React.FC<{
  label: string;
  onConfirm: () => void;
  onDiscard: () => void;
}> = ({ label, onConfirm, onDiscard }) => (
  <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700">
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <ClipboardCheck className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP'] truncate flex-1">
          {label}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onConfirm}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500 text-white hover:bg-purple-600 transition-colors text-[11px] font-['Noto_Sans_JP']"
          aria-label="生成結果を確認"
          title="確認する"
        >
          <Check className="h-3 w-3" />
          <span>確認</span>
        </button>
        <button
          onClick={onDiscard}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="生成結果を破棄"
          title="破棄する"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
);

export const GenerationStatusIndicator: React.FC = () => {
  const { tasks, cancelTask } = useGeneration();
  const { pendingResults, openResult, discardResult } = usePendingResult();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const runningCount = tasks.length;
  const pendingCount = pendingResults.length;
  const hasAny = runningCount > 0 || pendingCount > 0;

  // 経過時間表示用に1秒ごとに再描画（実行中タスクが無い時は止める）
  useEffect(() => {
    if (runningCount === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningCount]);

  if (!hasAny) return null;

  // ヘッダー要約: 実行中があればそれを主表示、無ければ確認待ちを主表示
  const headerText =
    runningCount > 0
      ? `AI生成中 ${runningCount}件${pendingCount > 0 ? ` ・ 確認待ち ${pendingCount}件` : ''}`
      : `確認待ち ${pendingCount}件`;

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-72 max-w-[calc(100vw-2rem)] pointer-events-auto">
      <div className="rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md overflow-hidden">
        {/* ヘッダー（クリックで展開/折りたたみ） */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              {runningCount > 0 ? (
                <Sparkles className="h-4 w-4 text-ai-500 animate-pulse" />
              ) : (
                <ClipboardCheck className="h-4 w-4 text-purple-500" />
              )}
            </div>
            <span className="text-xs font-semibold text-sumi-700 dark:text-usuzumi-200 font-['Noto_Sans_JP'] truncate">
              {headerText}
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* 一覧 */}
        {expanded && (
          <div className="max-h-80 overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                now={now}
                onCancel={() => cancelTask(task.id)}
              />
            ))}
            {pendingCount > 0 && (
              <div className="px-3 py-1.5 bg-purple-50/60 dark:bg-purple-900/10 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-300 font-['Noto_Sans_JP']">
                  反映待ちの生成結果
                </p>
              </div>
            )}
            {pendingResults.map((r) => (
              <PendingRow
                key={r.id}
                label={r.label}
                onConfirm={() => openResult(r.id)}
                onDiscard={() => discardResult(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
