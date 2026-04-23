import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useModalNavigation } from '../../../hooks/useKeyboardNavigation';
import type { ContextSettings } from './types';

interface ContextSettingsModalProps {
  isOpen: boolean;
  contextSettings: ContextSettings;
  charCounts: { glossary: number; relationships: number; worldSettings: number; timeline: number };
  onClose: () => void;
  onSettingsChange: (settings: ContextSettings) => void;
  onReset: () => void;
}

interface ContextItem {
  key: keyof ContextSettings;
  label: string;
  description: string;
  isNew?: boolean;
}

const CONTEXT_ITEMS: ContextItem[] = [
  { key: 'glossary', label: '用語集', description: '重要な用語と定義' },
  { key: 'relationships', label: 'キャラクター相関図', description: 'キャラクター間の関係性' },
  { key: 'worldSettings', label: '世界観設定', description: '世界の地理・文化・社会など' },
  { key: 'timeline', label: 'タイムライン', description: '物語の時系列イベント', isNew: true },
];

export const ContextSettingsModal: React.FC<ContextSettingsModalProps> = ({
  isOpen,
  contextSettings,
  charCounts,
  onClose,
  onSettingsChange,
  onReset,
}) => {
  const { modalRef } = useModalNavigation({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  const handleToggle = (key: keyof ContextSettings) => {
    onSettingsChange({ ...contextSettings, [key]: !contextSettings[key] });
  };

  const totalEnabledChars = CONTEXT_ITEMS
    .filter(item => contextSettings[item.key])
    .reduce((sum, item) => sum + charCounts[item.key], 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 glass-overlay transition-opacity duration-300"
          onClick={onClose}
        />

        <div
          ref={modalRef}
          className="relative w-full max-w-lg glass-strong glass-shimmer rounded-2xl transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/10 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-8 h-8 rounded-full flex items-center justify-center">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  コンテキスト設定
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  プロンプトに含めるデータを選択
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ボディ */}
          <div className="p-6 overflow-y-auto custom-scrollbar">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mb-5 leading-relaxed">
              プロンプトが長すぎるとAIの出力品質が低下する場合があります。不要なデータをオフにしてプロンプトを最適化できます。
            </p>

            <div className="space-y-3">
              {CONTEXT_ITEMS.map((item) => (
                <label
                  key={item.key}
                  htmlFor={`context-${item.key}`}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                    contextSettings[item.key]
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`context-${item.key}`}
                      checked={contextSettings[item.key]}
                      onChange={() => handleToggle(item.key)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                          {item.label}
                        </span>
                        {item.isNew && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                            新機能
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    charCounts[item.key] > 0
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                  }`}>
                    {charCounts[item.key] > 0
                      ? `${charCounts[item.key].toLocaleString()}文字`
                      : 'データなし'
                    }
                  </span>
                </label>
              ))}
            </div>

            {/* 合計文字数 */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm font-['Noto_Sans_JP']">
                <span className="text-gray-600 dark:text-gray-400">選択中のコンテキスト</span>
                <span className={`font-semibold ${
                  totalEnabledChars > 3000
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  約 {totalEnabledChars.toLocaleString()} 文字
                </span>
              </div>
              {totalEnabledChars > 3000 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-['Noto_Sans_JP'] mt-1">
                  コンテキストが多めです。品質低下が見られる場合は一部をオフにしてください。
                </p>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-end p-6 border-t border-white/20 dark:border-white/10 shrink-0 space-x-3">
            <button
              onClick={onReset}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-['Noto_Sans_JP'] text-sm"
            >
              リセット
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-['Noto_Sans_JP'] text-sm"
            >
              保存して閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
