import React from 'react';
import { Target } from 'lucide-react';
import { Modal } from '../../../../common/Modal';
import type { PayoffResult } from '../../types';
import type { Foreshadowing } from '../../../../../contexts/ProjectContext';

interface PayoffResultModalProps {
  isOpen: boolean;
  payoffResult: PayoffResult | null;
  selectedForPayoff: Foreshadowing | null;
  onClose: () => void;
}

export const PayoffResultModal: React.FC<PayoffResultModalProps> = ({
  isOpen,
  payoffResult,
  selectedForPayoff,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <Target className="h-6 w-6 text-green-500" />
          <span className="font-['Noto_Sans_JP']">回収タイミング提案: {selectedForPayoff?.title}</span>
        </div>
      }
      size="lg"
      className="z-[60]"
    >
      {payoffResult && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 推奨タイミング */}
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 font-['Noto_Sans_JP']">
              🎯 推奨回収タイミング
            </h4>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">
              {payoffResult.recommendedChapter}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-['Noto_Sans_JP']">
              {payoffResult.timing}
            </p>
          </div>

          {/* 回収方法 */}
          {payoffResult.payoffMethods.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                📖 回収方法の提案
              </h4>
              <div className="space-y-3">
                {payoffResult.payoffMethods.map((method, i) => (
                  <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="font-medium text-gray-900 dark:text-white font-['Noto_Sans_JP'] mb-2">
                      {i + 1}. {method.method}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-2">
                      {method.description}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">
                      💥 インパクト: {method.impact}
                    </p>
                    {method.prerequisites.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">前提条件:</p>
                        <ul className="text-xs text-gray-500 dark:text-gray-400">
                          {method.prerequisites.map((p, j) => (
                            <li key={j} className="font-['Noto_Sans_JP']">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 回収前のヒント */}
          {payoffResult.hintsBeforePayoff.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                💡 回収前に入れるべきヒント
              </h4>
              <div className="space-y-2">
                {payoffResult.hintsBeforePayoff.map((hint, i) => (
                  <div key={i} className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="font-medium text-amber-700 dark:text-amber-300 font-['Noto_Sans_JP']">
                      {hint.chapter}:
                    </span>
                    <span className="text-sm text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                      {hint.hint}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 避けるべきタイミング */}
          {payoffResult.avoidTiming.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2 font-['Noto_Sans_JP']">
                ❌ 避けるべきタイミング
              </h4>
              <ul className="space-y-1">
                {payoffResult.avoidTiming.map((avoid, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-400 font-['Noto_Sans_JP']">
                    • {avoid}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
