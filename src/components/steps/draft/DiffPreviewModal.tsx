import React, { useMemo } from 'react';
import { GitCompareArrows, Check, X } from 'lucide-react';
import { diffLines, type Change } from 'diff';
import { Modal } from '../../common/Modal';

interface DiffPreviewModalProps {
  isOpen: boolean;
  oldText: string;
  newText: string;
  onApply: () => void;
  onDiscard: () => void;
}

/**
 * AI提案の差分プレビューモーダル。
 * リライト・改善などでAIが返した本文を適用する前に、
 * 現在の草案との差分を確認して「適用」または「破棄」を選べる。
 */
export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
  isOpen,
  oldText,
  newText,
  onApply,
  onDiscard,
}) => {
  const segments = useMemo<Change[]>(() => {
    if (!isOpen) return [];
    return diffLines(oldText ?? '', newText ?? '');
  }, [isOpen, oldText, newText]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    segments.forEach(segment => {
      if (segment.added) added += segment.value.length;
      if (segment.removed) removed += segment.value.length;
    });
    return { added, removed };
  }, [segments]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDiscard}
      title={
        <span className="flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5 text-ai-600 dark:text-ai-400" />
          AI提案の差分プレビュー
        </span>
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 text-sm font-['Noto_Sans_JP']">
          <span className="text-gray-600 dark:text-gray-400">
            {oldText.length.toLocaleString()}文字 → {newText.length.toLocaleString()}文字
          </span>
          <span className="text-green-700 dark:text-green-400">+{stats.added.toLocaleString()}</span>
          <span className="text-red-600 dark:text-red-400">-{stats.removed.toLocaleString()}</span>
        </div>

        {/* 差分表示 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-[50vh] overflow-y-auto bg-white dark:bg-gray-900">
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed p-3 font-['Noto_Sans_JP']">
            {segments.map((segment, index) => (
              <span
                key={index}
                className={
                  segment.added
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200'
                    : segment.removed
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-300 line-through'
                      : 'text-gray-700 dark:text-gray-300'
                }
              >
                {segment.value}
              </span>
            ))}
          </pre>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
          「適用」すると草案がこの内容に置き換わり保存されます。「破棄」するとAI提案は捨てられ、現在の草案が維持されます。
        </p>

        {/* フッター */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onDiscard}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-['Noto_Sans_JP']"
          >
            <X className="h-4 w-4" />
            破棄
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-['Noto_Sans_JP']"
          >
            <Check className="h-4 w-4" />
            適用
          </button>
        </div>
      </div>
    </Modal>
  );
};
