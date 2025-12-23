import React, { useState } from 'react';
import { Save, RotateCcw, Trash2 } from 'lucide-react';
import type { Change } from 'diff';
import type { ChapterHistoryEntry } from './types';
import { HISTORY_BADGE_CLASSES } from './constants';
import { formatTimestamp } from './utils';
import { ConfirmDialog } from '../../common/ConfirmDialog';

interface ChapterInfo {
  id: string;
  title: string;
}

interface HistoryTabPanelProps {
  selectedChapterId: string | null;
  currentChapter: ChapterInfo | null;
  historyEntries: ChapterHistoryEntry[];
  selectedHistoryEntryId: string | null;
  setSelectedHistoryEntryId: React.Dispatch<React.SetStateAction<string | null>>;
  onManualSnapshot: () => void;
  onRestoreHistoryEntry: () => void;
  onDeleteHistoryEntry: (entryId: string) => void;
  hasHistoryDiff: boolean;
  historyDiffSegments: Change[];
}

export const HistoryTabPanel: React.FC<HistoryTabPanelProps> = ({
  selectedChapterId,
  currentChapter,
  historyEntries,
  selectedHistoryEntryId,
  setSelectedHistoryEntryId,
  onManualSnapshot,
  onRestoreHistoryEntry,
  onDeleteHistoryEntry,
  hasHistoryDiff,
  historyDiffSegments,
}) => {
  const [deletingHistoryEntryId, setDeletingHistoryEntryId] = useState<string | null>(null);

  if (!selectedChapterId || !currentChapter) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
        章を選択すると履歴を表示できます。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">差分履歴</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
            現在の草案と過去のスナップショットを比較し復元します。
          </p>
        </div>
        <button
          type="button"
          onClick={onManualSnapshot}
          disabled={!selectedChapterId}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs font-semibold font-['Noto_Sans_JP'] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          現在の状態を保存
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {historyEntries.length > 0 ? (
          historyEntries.map((entry) => {
            const preview =
              entry.content && entry.content.trim().length > 0
                ? `${entry.content.replace(/\s+/g, ' ').slice(0, 50)}${entry.content.length > 50 ? '…' : ''}`
                : '（空の草案）';
            const isActive = selectedHistoryEntryId === entry.id;

            return (
              <div
                key={entry.id}
                className={`group relative w-full px-3 py-2 rounded-lg border transition-all duration-150 font-['Noto_Sans_JP'] ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-100'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedHistoryEntryId(entry.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${HISTORY_BADGE_CLASSES[entry.type]}`}>
                      {entry.label}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-[10px]">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{preview}</div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingHistoryEntryId(entry.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 dark:hover:bg-red-900/50"
                  title="履歴を削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center py-4">履歴はまだありません</div>
        )}
      </div>

      {selectedHistoryEntryId && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onRestoreHistoryEntry}
            disabled={!hasHistoryDiff}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-lg border-2 border-emerald-500 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors font-semibold font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4" />
            このバージョンに復元
          </button>

          {hasHistoryDiff && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900/40">
              {historyDiffSegments.map((segment, index) => {
                const diffClass = segment.added
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : segment.removed
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                    : 'text-gray-800 dark:text-gray-100';
                const prefix = segment.added ? '+ ' : segment.removed ? '- ' : '  ';
                return (
                  <div key={`${index}-${segment.value}`} className={diffClass}>
                    <pre className="whitespace-pre-wrap px-3 py-1 text-xs font-mono">{`${prefix}${segment.value || ''}`}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={deletingHistoryEntryId !== null}
        onClose={() => setDeletingHistoryEntryId(null)}
        onConfirm={() => {
          if (deletingHistoryEntryId) {
            onDeleteHistoryEntry(deletingHistoryEntryId);
            setDeletingHistoryEntryId(null);
          }
        }}
        title="この履歴を削除しますか？"
        message=""
        type="warning"
        confirmLabel="削除"
      />
    </div>
  );
};


