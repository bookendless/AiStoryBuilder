import React from 'react';
import { ListChecks, X, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import type { ImprovementLog } from './types';
import { formatTimestamp } from './utils';

interface ImprovementLogModalProps {
  isOpen: boolean;
  chapterTitle: string | null;
  logs: ImprovementLog[];
  selectedLogId: string | null;
  onClose: () => void;
  onSelectLog: (logId: string | null) => void;
}

export const ImprovementLogModal: React.FC<ImprovementLogModalProps> = ({
  isOpen,
  chapterTitle,
  logs,
  selectedLogId,
  onClose,
  onSelectLog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* オーバーレイ */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* モーダルコンテンツ */}
        <div className="relative w-full max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          {/* モーダルヘッダー */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 gap-3">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 w-8 h-8 rounded-full flex items-center justify-center">
                <ListChecks className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  改善ログ
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                  {chapterTitle || '選択中の章'} - {logs.length}件のログ
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* モーダルボディ */}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              {logs.map((log, index) => {
                const isSelected = selectedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/80 dark:border-amber-500 dark:bg-amber-900/30'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* ログヘッダー */}
                    <button
                      type="button"
                      onClick={() => onSelectLog(isSelected ? null : log.id)}
                      className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                              #{logs.length - index}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            {log.originalLength}字 → {log.revisedLength}字
                            {log.revisedLength !== log.originalLength && (
                              <span className={`ml-2 ${log.revisedLength > log.originalLength ? 'text-green-600' : 'text-blue-600'}`}>
                                ({log.revisedLength > log.originalLength ? '+' : ''}{log.revisedLength - log.originalLength}字)
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* ログ詳細 */}
                    {isSelected && (
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        {/* フェーズ1：評価結果 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">1</span>
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                              フェーズ1：評価結果
                            </h4>
                          </div>
                          <div className="ml-8 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 max-h-64 overflow-y-auto whitespace-pre-wrap font-['Noto_Sans_JP'] leading-relaxed">
                            {log.phase1Critique}
                          </div>
                        </div>

                        {/* フェーズ2：改善戦略 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-amber-500 w-6 h-6 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">2</span>
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                              フェーズ2：改善戦略
                            </h4>
                          </div>
                          <div className="ml-8 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 font-['Noto_Sans_JP'] leading-relaxed">
                            {log.phase2Summary}
                          </div>
                        </div>

                        {/* 主な変更点 */}
                        {log.phase2Changes && log.phase2Changes.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-3 w-3 text-white" />
                              </div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                                主な変更点
                              </h4>
                            </div>
                            <ul className="ml-8 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2 font-['Noto_Sans_JP']">
                              {log.phase2Changes.map((change, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-amber-500 mt-1">•</span>
                                  <span className="flex-1">{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* モーダルフッター */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-['Noto_Sans_JP']"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

