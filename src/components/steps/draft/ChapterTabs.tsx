import React, { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Chapter {
  id: string;
  title: string;
  summary?: string;
}

interface ChapterTabsProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  chapterDrafts: Record<string, string>;
  onChapterSelect: (chapterId: string) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  currentChapterIndex: number;
}

export const ChapterTabs: React.FC<ChapterTabsProps> = ({
  chapters,
  selectedChapterId,
  chapterDrafts,
  onChapterSelect,
  onPrevChapter,
  onNextChapter,
  currentChapterIndex,
}) => {
  const chapterTabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  // スクロールボタンの状態を更新
  const updateScrollButtons = useCallback(() => {
    const container = chapterTabsContainerRef.current;
    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // 選択章を中央に自動スクロール
  useEffect(() => {
    if (!chapterTabsContainerRef.current || !selectedChapterId) {
      updateScrollButtons();
      return;
    }
    const container = chapterTabsContainerRef.current;
    const activeTab = container.querySelector<HTMLButtonElement>(`[data-chapter-id="${selectedChapterId}"]`);
    if (!activeTab) {
      updateScrollButtons();
      return;
    }

    const tabLeft = activeTab.offsetLeft;
    const tabWidth = activeTab.offsetWidth;
    const tabCenter = tabLeft + tabWidth / 2;
    const containerWidth = container.clientWidth;
    const scrollLeft = tabCenter - containerWidth / 2;

    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    
    // スクロール完了後にボタン状態を更新
    setTimeout(updateScrollButtons, 300);
  }, [selectedChapterId, updateScrollButtons]);

  // スクロール時にボタン状態を更新
  useEffect(() => {
    const container = chapterTabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateScrollButtons();
    };

    container.addEventListener('scroll', handleScroll);
    // 初期状態を更新
    updateScrollButtons();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateScrollButtons]);

  // ウィンドウリサイズ時にスクロール状態を更新
  useEffect(() => {
    const handleResize = () => {
      updateScrollButtons();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateScrollButtons]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 font-['Noto_Sans_JP']">
            章を選択
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            ショートカット: Ctrl + ← / → で章を切り替え
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevChapter}
            disabled={
              !selectedChapterId ||
              chapters.length === 0 ||
              chapters[0]?.id === selectedChapterId
            }
            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="前の章へ"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="font-['Noto_Sans_JP']">前の章</span>
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 font-['Noto_Sans_JP']">
            {currentChapterIndex >= 0
              ? `第${currentChapterIndex + 1}章 / 全${chapters.length}章`
              : `全${chapters.length}章`}
          </span>
          <button
            type="button"
            onClick={onNextChapter}
            disabled={
              !selectedChapterId ||
              chapters.length === 0 ||
              chapters[chapters.length - 1]?.id === selectedChapterId
            }
            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="次の章へ"
          >
            <span className="font-['Noto_Sans_JP']">次の章</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* スクロール可能な章タブエリア */}
        <div className="relative">
          {/* 左スクロールボタン */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => {
                const container = chapterTabsContainerRef.current;
                if (container) {
                  container.scrollBy({ left: -300, behavior: 'smooth' });
                }
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="左にスクロール"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}

          {/* 右スクロールボタン */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => {
                const container = chapterTabsContainerRef.current;
                if (container) {
                  container.scrollBy({ left: 300, behavior: 'smooth' });
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="右にスクロール"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}

          <div
            ref={chapterTabsContainerRef}
            role="tablist"
            aria-label="章一覧"
            className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {chapters.map((chapter, index) => {
              const isSelected = selectedChapterId === chapter.id;
              const hasContent = Boolean(chapterDrafts[chapter.id] && chapterDrafts[chapter.id].trim());
              return (
                <button
                  key={chapter.id}
                  type="button"
                  data-chapter-id={chapter.id}
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  onClick={() => onChapterSelect(chapter.id)}
                  className={`group flex min-w-[200px] flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 font-['Noto_Sans_JP'] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-400/60 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{`第${index + 1}章`}</span>
                    {hasContent && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        草案あり
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {chapter.title || `章 ${index + 1}`}
                  </div>
                  {chapter.summary && (
                    <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 max-h-10 overflow-hidden">
                      {chapter.summary}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 章数が多い場合のドロップダウン（モバイル表示） */}
        {chapters.length > 5 && (
          <div className="mt-3 sm:hidden">
            <select
              value={selectedChapterId || ''}
              onChange={(e) => onChapterSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-['Noto_Sans_JP'] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">章を選択してください</option>
              {chapters.map((chapter, index) => (
                <option key={chapter.id} value={chapter.id}>
                  第{index + 1}章: {chapter.title || `章 ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 章数が多い場合のデスクトップ用ドロップダウン */}
        {chapters.length > 8 && (
          <div className="hidden sm:block mt-3">
            <select
              value={selectedChapterId || ''}
              onChange={(e) => onChapterSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-['Noto_Sans_JP'] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">章を選択してください（クイック選択）</option>
              {chapters.map((chapter, index) => (
                <option key={chapter.id} value={chapter.id}>
                  第{index + 1}章: {chapter.title || `章 ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <select
        value={selectedChapterId || ''}
        onChange={(e) => onChapterSelect(e.target.value)}
        className="sr-only"
        aria-label="章を選択"
      >
        <option value="">章を選択してください</option>
        {chapters.map(chapter => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.title}
          </option>
        ))}
      </select>
    </div>
  );
};

