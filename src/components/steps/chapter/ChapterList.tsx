import React, { RefObject, useMemo } from 'react';
import { List, Plus, Edit3, Trash2, ChevronUp, ChevronDown, History, ChevronRight, Search, Sparkles, Scissors } from 'lucide-react';
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
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, chapterId: string) => void;
  onAddChapter: () => void;
  onEnhance?: (chapter: Chapter, index: number) => void;
  onSplitDraft?: (chapter: Chapter) => void;
}

// 個別の章アイテムコンポーネント（メモ化）
interface ChapterItemProps {
  chapter: Chapter;
  originalIndex: number;
  isExpanded: boolean;
  isDragged: boolean;
  chapterRefs: RefObject<{ [key: string]: HTMLDivElement | null }>;
  onToggleExpansion: (chapterId: string) => void;
  onEdit: (chapter: Chapter) => void;
  onDelete: (chapterId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onOpenHistory: (chapterId: string) => void;
  onDragStart: (e: React.DragEvent, chapterId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, chapterId: string) => void;
  totalChapters: number;
  onEnhance?: (chapter: Chapter, index: number) => void;
  onSplitDraft?: (chapter: Chapter) => void;
}

const ChapterItem = React.memo<ChapterItemProps>(({
  chapter,
  originalIndex,
  isExpanded,
  isDragged,
  chapterRefs,
  onToggleExpansion,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onOpenHistory,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  totalChapters,
  onEnhance,
  onSplitDraft,
}) => {
  const { currentProject } = useProject();

  return (
    <div
      ref={(el) => {
        if (chapterRefs.current) {
          chapterRefs.current[chapter.id] = el;
        }
      }}
      className={`bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600 ${isDragged ? 'opacity-50 scale-95' : ''
        }`}
      draggable
      onDragStart={(e) => onDragStart(e, chapter.id)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, chapter.id)}
    >
      {/* 章ヘッダー（常に表示） */}
      <div
        className="p-4 sm:p-6 cursor-pointer"
        onClick={() => onToggleExpansion(chapter.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit(chapter);
        }}
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-0">
          <div className="flex items-start space-x-3 sm:space-x-4 flex-1 w-full sm:w-auto">
            <div className="bg-gradient-to-br from-blue-500 to-teal-600 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-base sm:text-lg">
                {originalIndex + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1 sm:mb-2">
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
                <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white font-['Noto_Sans_JP'] truncate">
                  {chapter.title}
                </h4>
              </div>
              {!isExpanded && (
                <div className="ml-7">
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP'] line-clamp-2 break-all">
                    {chapter.summary}
                  </p>
                  {chapter.characters && chapter.characters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {chapter.characters.slice(0, 3).map((characterId: string) => {
                        const character = currentProject?.characters.find(c => c.id === characterId);
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

          <div className="flex items-center justify-end space-x-2 ml-0 sm:ml-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700">
            <div className="flex space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp(originalIndex);
                }}
                disabled={originalIndex === 0}
                className="p-2 sm:p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none border sm:border-none border-gray-200 dark:border-gray-600"
                title="上に移動"
              >
                <ChevronUp className="h-4 w-4 sm:h-3 sm:w-3 mx-auto" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown(originalIndex);
                }}
                disabled={originalIndex === totalChapters - 1}
                className="p-2 sm:p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none border sm:border-none border-gray-200 dark:border-gray-600"
                title="下に移動"
              >
                <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3 mx-auto" />
              </button>
            </div>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2 hidden sm:block"></div>
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
            {onEnhance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEnhance(chapter, originalIndex);
                }}
                className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                title="AI強化"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            {onSplitDraft && chapter.draft?.trim() && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSplitDraft(chapter);
                }}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="本文を章に分割"
              >
                <Scissors className="h-4 w-4" />
              </button>
            )}
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
                  {chapter.keyEvents.map((event: string, eventIndex: number) => {
                    // 伏線イベントの判定とスタイリング
                    const isForeshadowingEvent = event.startsWith('【伏線：');
                    if (isForeshadowingEvent) {
                      // 伏線タイプに応じた色設定
                      let bgColor = 'bg-blue-50 dark:bg-blue-900/20';
                      let textColor = 'text-blue-700 dark:text-blue-300';
                      let borderColor = 'border-blue-200 dark:border-blue-700';
                      let badgeColor = 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300';
                      let icon = '📍';

                      if (event.startsWith('【伏線：ヒント】')) {
                        bgColor = 'bg-amber-50 dark:bg-amber-900/20';
                        textColor = 'text-amber-700 dark:text-amber-300';
                        borderColor = 'border-amber-200 dark:border-amber-700';
                        badgeColor = 'bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-300';
                        icon = '💡';
                      } else if (event.startsWith('【伏線：回収予定】')) {
                        bgColor = 'bg-purple-50 dark:bg-purple-900/20';
                        textColor = 'text-purple-700 dark:text-purple-300';
                        borderColor = 'border-purple-200 dark:border-purple-700';
                        badgeColor = 'bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300';
                        icon = '🎯';
                      } else if (event.startsWith('【伏線：回収】')) {
                        bgColor = 'bg-green-50 dark:bg-green-900/20';
                        textColor = 'text-green-700 dark:text-green-300';
                        borderColor = 'border-green-200 dark:border-green-700';
                        badgeColor = 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300';
                        icon = '🎯';
                      }

                      // プレフィックスとコンテンツを分離
                      const prefixMatch = event.match(/^(【伏線：[^】]+】)/);
                      const prefix = prefixMatch ? prefixMatch[1] : '';
                      const content = event.replace(/^【伏線：[^】]+】/, '').trim();

                      return (
                        <div
                          key={eventIndex}
                          className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${bgColor} ${borderColor} ${textColor}`}
                        >
                          <span className="text-sm flex-shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor} font-['Noto_Sans_JP'] mb-0.5`}>
                              {prefix.replace(/[【】]/g, '')}
                            </span>
                            <p className={`text-sm ${textColor} font-['Noto_Sans_JP'] break-all`}>
                              {content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // 通常のイベント
                    return (
                      <div key={eventIndex} className="text-sm text-gray-600 dark:text-gray-400 font-['Noto_Sans_JP']">
                        • {event}
                      </div>
                    );
                  })}
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
                  const character = currentProject?.characters.find(c => c.id === characterId);
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
}, (prevProps, nextProps) => {
  // カスタム比較関数：変更があった場合のみ再レンダリング
  return (
    prevProps.chapter.id === nextProps.chapter.id &&
    prevProps.chapter.title === nextProps.chapter.title &&
    prevProps.chapter.summary === nextProps.chapter.summary &&
    prevProps.chapter.setting === nextProps.chapter.setting &&
    prevProps.chapter.mood === nextProps.chapter.mood &&
    JSON.stringify(prevProps.chapter.characters) === JSON.stringify(nextProps.chapter.characters) &&
    JSON.stringify(prevProps.chapter.keyEvents) === JSON.stringify(nextProps.chapter.keyEvents) &&
    // 本文分割ボタンの表示可否に影響するため、draft の有無も比較する
    !!prevProps.chapter.draft === !!nextProps.chapter.draft &&
    prevProps.originalIndex === nextProps.originalIndex &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isDragged === nextProps.isDragged &&
    prevProps.totalChapters === nextProps.totalChapters
  );
});

ChapterItem.displayName = 'ChapterItem';

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
  onDragEnd,
  onDrop,
  onAddChapter,
  onEnhance,
  onSplitDraft,
}) => {
  const { currentProject } = useProject();

  // メモ化：originalIndicesの計算を最適化
  // Hooksは常に同じ順序で呼び出す必要があるため、早期リターンの前に配置
  const originalIndices = useMemo(() => {
    if (!currentProject) return new Map<string, number>();
    return new Map(filteredChapters.map(ch => [ch.id, currentProject.chapters.findIndex(c => c.id === ch.id)]));
  }, [filteredChapters, currentProject]);

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
        const isDragged = draggedChapterId === chapter.id;

        return (
          <ChapterItem
            key={chapter.id}
            chapter={chapter}
            originalIndex={originalIndex}
            isExpanded={isExpanded}
            isDragged={isDragged}
            chapterRefs={chapterRefs}
            onToggleExpansion={onToggleExpansion}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onOpenHistory={onOpenHistory}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            totalChapters={currentProject.chapters.length}
            onEnhance={onEnhance}
            onSplitDraft={onSplitDraft}
          />
        );
      })}
    </div>
  );
};

