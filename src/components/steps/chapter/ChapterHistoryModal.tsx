import React from 'react';
import { X, History, RotateCcw } from 'lucide-react';
import { useProject } from '../../../contexts/ProjectContext';
import { ChapterHistory } from './types';

interface ChapterHistoryModalProps {
  isOpen: boolean;
  selectedChapterId: string | null;
  histories: ChapterHistory[];
  onClose: () => void;
  onRestore: (history: ChapterHistory) => void;
}

export const ChapterHistoryModal: React.FC<ChapterHistoryModalProps> = ({
  isOpen,
  selectedChapterId,
  histories,
  onClose,
  onRestore,
}) => {
  const { currentProject } = useProject();

  if (!isOpen || !selectedChapterId) return null;

  const chapterHistories = histories || [];
  const currentChapter = currentProject?.chapters.find(c => c.id === selectedChapterId);

  return (
    <div
      className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="glass-strong glass-shimmer rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95">
        <div className="p-6 border-b border-white/20 dark:border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 w-10 h-10 rounded-full flex items-center justify-center">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                  変更履歴
                </h3>
                {currentProject && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                    {currentChapter?.title || '章の履歴'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {chapterHistories.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
                変更履歴がありません
              </p>
              <p className="text-gray-500 dark:text-gray-500 font-['Noto_Sans_JP']">
                章を編集すると、ここに履歴が表示されます
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 現在の状態 */}
              {currentChapter && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-semibold text-blue-800 dark:text-blue-300 font-['Noto_Sans_JP']">
                        現在の状態
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">タイトル:</span>
                      <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{currentChapter.title}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">概要:</span>
                      <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{currentChapter.summary || '（未設定）'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 履歴一覧 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 font-['Noto_Sans_JP']">
                  過去の履歴 ({chapterHistories.length}件)
                </h4>
                {chapterHistories.map((history, index) => (
                  <div
                    key={history.id}
                    className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                          #{chapterHistories.length - index}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                          {history.timestamp.toLocaleString('ja-JP', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('この履歴の状態に復元しますか？現在の状態は履歴として保存されます。')) {
                            onRestore(history);
                          }
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-['Noto_Sans_JP']"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>この状態に復元</span>
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">タイトル:</span>
                        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.title}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">概要:</span>
                        <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2">
                          {history.data.summary || '（未設定）'}
                        </p>
                      </div>
                      {history.data.setting && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">設定・場所:</span>
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.setting}</p>
                        </div>
                      )}
                      {history.data.mood && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">雰囲気・ムード:</span>
                          <p className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">{history.data.mood}</p>
                        </div>
                      )}
                      {history.data.characters.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">登場キャラクター:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {history.data.characters.map((characterId, idx) => {
                              const character = currentProject?.characters.find(c => c.id === characterId);
                              const characterName = character ? character.name : characterId;
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                                >
                                  {characterName}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {history.data.keyEvents.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">重要な出来事:</span>
                          <ul className="mt-1 space-y-1">
                            {history.data.keyEvents.map((event, idx) => (
                              <li key={idx} className="text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] text-sm">
                                • {event}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



























