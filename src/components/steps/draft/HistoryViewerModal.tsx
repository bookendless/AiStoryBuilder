import React from 'react';
import { Copy, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Modal } from '../../common/Modal';
import type { ChapterHistoryEntry } from './types';
import type { Change } from 'diff';
import { HISTORY_BADGE_CLASSES } from './constants';
import { formatTimestamp } from './utils';

interface HistoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ChapterHistoryEntry | null;
  entries?: ChapterHistoryEntry[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  diffSegments?: Change[];
  currentDraft?: string;
}

export const HistoryViewerModal: React.FC<HistoryViewerModalProps> = ({
  isOpen,
  onClose,
  entry,
  entries,
  currentIndex,
  onNavigate,
  diffSegments,
  currentDraft,
}) => {
  const [activeTab, setActiveTab] = React.useState<'content' | 'diff'>('content');

  if (!entry) return null;

  const canNavigatePrev = entries && currentIndex !== undefined && currentIndex > 0;
  const canNavigateNext = entries && currentIndex !== undefined && currentIndex < entries.length - 1;
  const hasDiff = diffSegments && diffSegments.length > 0 && diffSegments.some(s => s.added || s.removed);

  const handleCopy = () => {
    const historyText = `【履歴 - ${entry.label}】
時刻: ${formatTimestamp(entry.timestamp)}
タイプ: ${entry.type}

【内容】
${entry.content || '（空の草案）'}`;
    navigator.clipboard.writeText(historyText);
  };

  const handlePrev = () => {
    if (canNavigatePrev && onNavigate && currentIndex !== undefined) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (canNavigateNext && onNavigate && currentIndex !== undefined) {
      onNavigate(currentIndex + 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Save className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className={`px-2 py-1 rounded text-xs font-medium ${HISTORY_BADGE_CLASSES[entry.type]}`}>
                {entry.label}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
            {/* 前へ/次へナビゲーション */}
            {entries && currentIndex !== undefined && (
              <>
                <button
                  onClick={handlePrev}
                  disabled={!canNavigatePrev}
                  className={`p-2 rounded-lg transition-colors ${
                    canNavigatePrev
                      ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                  title="前の履歴"
                  aria-label="前の履歴"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {currentIndex + 1} / {entries.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!canNavigateNext}
                  className={`p-2 rounded-lg transition-colors ${
                    canNavigateNext
                      ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                  title="次の履歴"
                  aria-label="次の履歴"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            {/* コピーボタン */}
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="履歴をコピー"
              aria-label="履歴をコピー"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pb-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-['Noto_Sans_JP']">
            時刻: {formatTimestamp(entry.timestamp)}
          </span>
          <span className="font-['Noto_Sans_JP']">
            タイプ: {entry.type}
          </span>
          {entry.content && (
            <span className="font-['Noto_Sans_JP']">
              文字数: {entry.content.length}字
            </span>
          )}
        </div>

        {/* タブ切り替え（差分がある場合のみ） */}
        {hasDiff && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${
                activeTab === 'content'
                  ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              本文
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-4 py-2 text-sm font-medium transition-colors font-['Noto_Sans_JP'] ${
                activeTab === 'diff'
                  ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              差分
            </button>
          </div>
        )}

        {/* 本文表示 */}
        {activeTab === 'content' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
              履歴の内容
            </h3>
            {entry.content && entry.content.trim().length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed break-words">
                  {entry.content}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP'] text-center">
                （空の草案）
              </div>
            )}
          </div>
        )}

        {/* 差分表示 */}
        {activeTab === 'diff' && hasDiff && diffSegments && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
              現在の草案との差分
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-900/40 custom-scrollbar">
              {diffSegments.map((segment, index) => {
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
          </div>
        )}
      </div>
    </Modal>
  );
};
