import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, MessageCircle } from 'lucide-react';
import { WeaknessItem } from '../../../types/draft';

interface CritiqueSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedWeaknesses: WeaknessItem[]) => void;
  weaknesses: WeaknessItem[];
  critiqueSummary: string;
  isFixing?: boolean;
}

export const CritiqueSelectionModal: React.FC<CritiqueSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  weaknesses,
  critiqueSummary,
  isFixing = false,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // 初期化時にすべての項目を選択状態にする
  useEffect(() => {
    if (isOpen && weaknesses.length > 0) {
      setSelectedIndices(new Set(weaknesses.map((_, index) => index)));
    }
  }, [isOpen, weaknesses]);

  if (!isOpen) return null;

  const handleToggle = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === weaknesses.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(weaknesses.map((_, index) => index)));
    }
  };

  const handleConfirm = () => {
    const selectedItems = weaknesses.filter((_, index) => selectedIndices.has(index));
    onConfirm(selectedItems);
  };

  // スコアに基づく色分け
  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'text-gray-500';
    if (score >= 8) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 5) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] flex items-center">
            <MessageCircle className="w-5 h-5 mr-2 text-indigo-500" />
            AIによる批評と修正案
          </h2>
          <button
            onClick={onClose}
            disabled={isFixing}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 概要 */}
          {critiqueSummary && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2 font-['Noto_Sans_JP']">
                全体評価
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP'] whitespace-pre-wrap">
                {critiqueSummary}
              </p>
            </div>
          )}

          {/* 弱点リスト */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                特定された改善点 ({weaknesses.length}件)
              </h3>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-['Noto_Sans_JP'] font-medium"
              >
                {selectedIndices.size === weaknesses.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>

            {weaknesses.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                <p>明らかな改善点は見つかりませんでした。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {weaknesses.map((weakness, index) => (
                  <div 
                    key={index}
                    className={`
                      relative rounded-lg border transition-all duration-200 cursor-pointer
                      ${selectedIndices.has(index) 
                        ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-900/20' 
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}
                    `}
                    onClick={() => handleToggle(index)}
                  >
                    <div className="p-3 flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIndices.has(index) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                        {selectedIndices.has(index) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                            {weakness.aspect || '改善点'}
                          </span>
                          {weakness.score !== undefined && (
                            <span className={`text-xs font-bold ${getScoreColor(weakness.score)}`}>
                              スコア: {weakness.score}/10
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-['Noto_Sans_JP']">
                          <span className="font-semibold text-gray-500 dark:text-gray-400">問題: </span>
                          {weakness.problem}
                        </div>
                        
                        {weakness.solutions && weakness.solutions.length > 0 && (
                          <div className="bg-white dark:bg-gray-900/50 rounded p-2 text-xs text-gray-600 dark:text-gray-300 font-['Noto_Sans_JP']">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">改善案:</span>
                            <ul className="list-disc list-inside space-y-0.5 pl-1">
                              {weakness.solutions.map((solution, i) => (
                                <li key={i}>{solution}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isFixing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isFixing || selectedIndices.size === 0}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isFixing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                修正中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                選択した {selectedIndices.size} 件を修正
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
