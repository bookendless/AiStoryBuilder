import React, { useState } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { usePendingResult } from '../../contexts/PendingResultContext';
import { CreativePointCards } from './CreativePointCards';
import { CreativePointSelection } from '../../types/creativePoint';

/**
 * PendingResultModal - 重いAI生成の結果を「反映する / 破棄する」で確認するグローバルモーダル。
 *
 * App ルートに常駐し、PendingResultContext の activeResult を購読して表示する。
 * 生成元パネルがアンマウント済みでも、ここから反映/破棄できる。
 */
export const PendingResultModal: React.FC = () => {
  const { activeResult, applyResult, discardResult, removeResult, closeActive } = usePendingResult();
  const [isApplying, setIsApplying] = useState(false);

  if (!activeResult) return null;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await applyResult(activeResult.id);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = () => {
    discardResult(activeResult.id);
  };

  // 別案で再生成：選択した複数別案をまとめて1回だけ再実行し、現在の保留結果は静かに除去する
  // （再生成完了後に新しい確認モーダルが開く）
  const handleRegenerate = (selections: CreativePointSelection[]) => {
    if (selections.length === 0) return;
    const current = activeResult;
    removeResult(current.id);
    void current.onRegenerateWithSelections?.(selections);
  };

  return (
    <Modal
      isOpen={true}
      onClose={closeActive}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          {activeResult.label}の生成結果
        </span>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">
          以下の内容を作品に反映しますか？
        </p>

        {/* プレビュー */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-4 max-h-[50vh] overflow-y-auto custom-scrollbar text-sm text-gray-800 dark:text-gray-100 font-['Noto_Sans_JP'] whitespace-pre-wrap break-words">
          {activeResult.preview}
        </div>

        {/* 創造ポイント（Phase C）。あれば本文プレビューの下にカードを表示 */}
        {activeResult.creativePoints && activeResult.creativePoints.length > 0 && (
          <CreativePointCards
            points={activeResult.creativePoints}
            onRegenerate={handleRegenerate}
            disabled={isApplying}
          />
        )}

        {/* アクション */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isApplying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-['Noto_Sans_JP'] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            <span>破棄する</span>
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:scale-105 transition-all duration-200 shadow-md font-['Noto_Sans_JP'] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Check className="h-4 w-4" />
            <span>{isApplying ? '適用中...' : (activeResult.applyLabel ?? '反映する')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
