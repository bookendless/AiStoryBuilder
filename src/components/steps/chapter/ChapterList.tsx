import React, { RefObject } from 'react';
import { List, Plus, Edit3, Trash2, ChevronUp, ChevronDown, History, ChevronRight, Search } from 'lucide-react';
import { useProject, Chapter } from '../../../contexts/ProjectContext';
import { EmptyState } from '../../common/EmptyState';

interface ChapterListProps {
  filteredChapters: Chapter[];
  searchQuery: string;
  expandedChapters: Set<string>;
  draggedChapterId: string | null;
  chapterRefs: RefObject<{ [key: string]: HTMLDivElement | null }>;
  onToggleExpansion: (chapterId: string) => void;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onOpenHistory: (chapterId: string) => void;
  onDragStart: (e: React.DragEvent, chapterId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, chapterId: string) => void;
  onAddChapter: () => void;
}

export const ChapterList: React.FC<ChapterListProps> = ({
  filteredChapters,
  searchQuery,
  expandedChapters,
  draggedChapterId,
  chapterRefs,
  onToggleExpansion,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onOpenHistory,
  onDragStart,
  onDragOver,
  onDrop,
  onAddChapter,
}) => {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  if (currentProject.chapters.length === 0) {
    return (
      <div className="text-center py-12">
        <List className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4 font-['Noto_Sans_JP']">
          まだ章が作成されていません
        </p>
        <p className="text-gray-500 dark:text-gray-500 mb-6 font-['Noto_Sans_JP']">
          最初の章を作成して物語の構成を始めましょう
        </p>
        <button
          onClick={onAddChapter}
          className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors font-['Noto_Sans_JP']"
        >
          <Plus className="h-5 w-5" />
          <span>最初の章を作成</span>
        </button>
      </div>
    );
  }

  const chaptersToDisplay = filteredChapters;
  const originalIndices = new Map(chaptersToDisplay.map(ch => [ch.id, currentProject.chapters.findIndex(c => c.id === ch.id)]));

  if (chaptersToDisplay.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <EmptyState
          icon={Search}
          iconColor="text-gray-400 dark:text-gray-500"
          title="検索結果が見つかりませんでした"
          description={`「${searchQuery}」に一致する章はありません。別のキーワードで検索するか、検索条件を変更してください。`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chaptersToDisplay.map((chapter) => {
        const originalIndex = originalIndices.get(chapter.id) ?? 0;
        const isExpanded = expandedChapters.has(chapter.id);

        return (
          <div
            key={chapter.id}
            ref={(el) => {
              if (chapterRefs.current) {
                chapterRefs.current[chapter.id] = el;
              }
            }}
            className={`bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600 ${draggedChapterId === chapter.id ? 'opacity-50 scale-95' : ''
              }`}
            draggable
            onDragStart={(e) => onDragStart(e, chapter.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, chapter.id)}
          >
            {/* 章ヘッダー（常に表示） */}
            <div
              className="p-6 cursor-pointer"
              onClick={() => onToggleExpansion(chapter.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onEdit(chapter);
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">
                      {originalIndex + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpansion(chapter.id);
                        }}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP']">
                        {chapter.title}
                      </h4>
                    </div>
                    {!isExpanded && (
                      <div className="ml-7">
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2">
                          {chapter.summary}
                        </p>
                        {chapter.characters && chapter.characters.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {chapter.characters.slice(0, 3).map((characterId: string) => {
                              const character = currentProject.characters.find(c => c.id === characterId);
                              const characterName = character ? character.name : characterId;
                              return (
                                <span
                                  key={characterId}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                                >
                                  {characterName}
                                </span>
                              );
                            })}
                            {chapter.characters.length > 3 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                                +{chapter.characters.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveUp(originalIndex);
                      }}
                      disabled={originalIndex === 0}
                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="上に移動"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveDown(originalIndex);
                      }}
                      disabled={originalIndex === currentProject.chapters.length - 1}
                      className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="下に移動"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenHistory(chapter.id);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="変更履歴"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(chapter);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="編集"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(chapter.id);
                    }}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 章の詳細（折りたたみ可能） */}
            {isExpanded && (
              <div className="px-6 pb-6 pt-0 border-t border-gray-200 dark:border-gray-600">
                <div className="ml-16 space-y-3">
                  <p className="text-gray-700 dark:text-gray-300 font-['Noto_Sans_JP']">
                    {chapter.summary}
                  </p>

                  {/* 設定・場所 */}
                  {chapter.setting && (
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        設定・場所:
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                        {chapter.setting}
                      </p>
                    </div>
                  )}

                  {/* 雰囲気・ムード */}
                  {chapter.mood && (
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        雰囲気・ムード:
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] mt-1">
                        {chapter.mood}
                      </p>
                    </div>
                  )}

                  {/* 重要な出来事 */}
                  {chapter.keyEvents && chapter.keyEvents.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        重要な出来事:
                      </span>
                      <div className="mt-1 space-y-1">
                        {chapter.keyEvents.map((event: string, eventIndex: number) => (
                          <div key={eventIndex} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                            • {event}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 登場キャラクター */}
                  {chapter.characters && chapter.characters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
                        登場キャラクター:
                      </span>
                      {chapter.characters.map((characterId: string) => {
                        const character = currentProject.characters.find(c => c.id === characterId);
                        const characterName = character ? character.name : characterId;
                        return (
                          <span
                            key={characterId}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-['Noto_Sans_JP']"
                          >
                            {characterName}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

