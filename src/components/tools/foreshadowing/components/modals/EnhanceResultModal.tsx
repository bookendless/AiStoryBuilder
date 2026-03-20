import React from 'react';
import { Wand2 } from 'lucide-react';
import { Modal } from '../../../../common/Modal';
import type { EnhanceResult } from '../../types';
import type { Foreshadowing } from '../../../../../contexts/ProjectContext';

interface EnhanceResultModalProps {
  isOpen: boolean;
  enhanceResult: EnhanceResult | null;
  selectedForEnhance: Foreshadowing | null;
  onClose: () => void;
}

export const EnhanceResultModal: React.FC<EnhanceResultModalProps> = ({
  isOpen,
  enhanceResult,
  selectedForEnhance,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <Wand2 className="h-6 w-6 text-purple-500" />
          <span className="font-['Noto_Sans_JP']">伏線強化提案: {selectedForEnhance?.title}</span>
        </div>
      }
      size="lg"
      className="z-[60]"
    >
      {enhanceResult && (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 強化された説明 */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
              💎 強化された説明
            </h4>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                {enhanceResult.enhancedDescription}
              </p>
            </div>
          </div>

          {/* 追加できる層 */}
          {enhanceResult.additionalLayers.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                🎭 追加できる深み
              </h4>
              <div className="space-y-2">
                {enhanceResult.additionalLayers.map((layer, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="font-medium text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">{layer.layer}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{layer.description}</p>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-['Noto_Sans_JP']">
                      ✨ {layer.effect}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 接続機会 */}
          {enhanceResult.connectionOpportunities.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                🔗 接続の機会
              </h4>
              <div className="space-y-2">
                {enhanceResult.connectionOpportunities.map((conn, i) => (
                  <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="font-medium text-blue-800 dark:text-blue-200 font-['Noto_Sans_JP']">→ {conn.target}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 font-['Noto_Sans_JP']">{conn.connection}</p>
                    <p className="text-sm text-blue-500 dark:text-blue-400 mt-1 font-['Noto_Sans_JP']">
                      💡 {conn.benefit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 強化方法 */}
          {enhanceResult.strengthenMethods.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 font-['Noto_Sans_JP']">
                ⬆️ 強化方法
              </h4>
              <div className="space-y-2">
                {enhanceResult.strengthenMethods.map((method, i) => (
                  <div key={i} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">現在:</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">{method.current}</span>
                    </div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm text-green-600 dark:text-green-400 font-['Noto_Sans_JP']">改善:</span>
                      <span className="text-sm text-green-700 dark:text-green-300 font-['Noto_Sans_JP']">{method.improved}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                      理由: {method.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 注意点 */}
          {enhanceResult.warnings.length > 0 && (
            <div>
              <h4 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 font-['Noto_Sans_JP']">
                ⚠️ 注意点
              </h4>
              <ul className="space-y-1">
                {enhanceResult.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP']">
                    • {w}
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
